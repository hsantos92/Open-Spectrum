import * as THREE from "../node_modules/three/build/three.module.js";
import { EffectComposer } from "../node_modules/three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "../node_modules/three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "../node_modules/three/examples/jsm/postprocessing/UnrealBloomPass.js";
import catalog from "../presets/builtin.json" with { type: "json" };
export const presets = catalog;
import { procedural } from "./procedural.mjs";
const TAU = Math.PI * 2;
export class Visuals {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 100);
    this.camera.position.set(0, 0, 13);
    this.scene = new THREE.Scene();
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(1280, 850),
      0.8,
      0.5,
      0.25,
    );
    this.composer.addPass(this.bloom);
    this.bins = new Float32Array(96);
    this.level = 0;
    this.mode = 1;
    this.quality = 1;
    this.palette = "rainbow";
    this.paletteColors = ["#65dbc6", "#a674ec"];
    this.features = { bass: 0, beat: 0, waveform: [] };
    this.tuning = { speed: 1, deform: 1, bloom: 0.8 };
    this.setPreset(0);
    this.resize();
  }
  resize() {
    const c = this.renderer.domElement;
    this.renderer.setSize(c.clientWidth, c.clientHeight, false);
    this.camera.aspect = c.clientWidth / c.clientHeight;
    this.camera.updateProjectionMatrix();
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(c.clientWidth, c.clientHeight);
  }
  dispose() {
    for (const o of [...this.group.children]) {
      this.group.remove(o);
      o.geometry?.dispose();
      o.material?.dispose();
    }
    this.updateFn = null;
  }
  lines(count, points = false) {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(count * 3),
      c = new Float32Array(count * 3);
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    g.setAttribute("color", new THREE.BufferAttribute(c, 3));
    const m = points
      ? new THREE.PointsMaterial({
          size: 0.045,
          vertexColors: true,
          transparent: true,
          opacity: 0.9,
          sizeAttenuation: true,
          blending: THREE.AdditiveBlending,
        })
      : new THREE.LineBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity: 0.8,
        });
    const obj = points ? new THREE.Points(g, m) : new THREE.LineSegments(g, m);
    this.group.add(obj);
    return { p, c, obj, g };
  }
  color(c, i, h, brightness = 1) {
    const col = new THREE.Color();
    if (this.mode % 2 === 0) col.setRGB(brightness, brightness, brightness);
    else if (this.palette === "custom")
      col
        .set(this.paletteColors[0])
        .lerp(
          new THREE.Color(this.paletteColors[1]),
          (Math.sin(h * TAU) + 1) / 2,
        );
    else col.setHSL((h + 0.54) % 1, 0.9, 0.56);
    if (this.mode >= 2) col.multiplyScalar(this.mode % 2 === 0 ? 0.25 : 0.65);
    c[i * 3] = col.r;
    c[i * 3 + 1] = col.g;
    c[i * 3 + 2] = col.b;
  }
  setPreset(id) {
    this.dispose();
    this.id = id;
    this.config = presets[id];
    const config = this.config,
      kind = config.kind;
    this.group.rotation.set(0, 0, 0);
    const amp = (i) =>
      Math.min(
        1.8,
        this.bins[((Math.floor(i) % 96) + 96) % 96] *
          (config.deform ?? 1) *
          this.tuning.deform,
      );
    if (["cells", "blobs", "kaleidoscope", "plasma"].includes(kind)) {
      const p = procedural(kind);
      this.group.add(p.mesh);
      this.updateFn = (t) => {
        p.uniforms.time.value = t;
        p.uniforms.energy.value = this.level;
        p.uniforms.bass.value = this.features.bass;
        p.uniforms.mode.value = this.mode;
        p.uniforms.aspect.value = this.camera.aspect;
        p.uniforms.deform.value = config.deform * this.tuning.deform;
        p.uniforms.palette.value = this.palette === "custom" ? 1 : 0;
        p.uniforms.first.value.set(this.paletteColors[0]);
        p.uniforms.second.value.set(this.paletteColors[1]);
      };
    } else if (["terrain", "waterfall", "contours"].includes(kind)) {
      const rows = Math.round(48 * config.density),
        cols = 80,
        v = this.lines(rows * (cols - 1) * 2);
      const hist = Array.from({ length: rows }, () => new Float32Array(96));
      let last = -1;
      this.updateFn = (t) => {
        if (Math.floor(t * 24) !== last) {
          hist.pop();
          hist.unshift(Float32Array.from(this.bins));
          last = Math.floor(t * 24);
        }
        let k = 0;
        for (let z = 0; z < rows; z++)
          for (let x = 0; x < cols - 1; x++)
            for (let q = 0; q < 2; q++) {
              const xx = x + q,
                frequency = Math.floor((xx / cols) * 96),
                a = kind === "waterfall" ? hist[z][frequency] : amp(frequency);
              v.p[k * 3] = (xx - cols / 2) * 0.18;
              v.p[k * 3 + 1] =
                (kind === "contours"
                  ? Math.sin(xx * 0.15 + t + z * 0.18) * 0.22
                  : Math.sin(xx * 0.1 + t + z * 0.2) * 0.12) +
                a *
                  (kind === "waterfall" ? 2.8 : 1.8) *
                  Math.sin(z * 0.12 + t * 0.6);
              v.p[k * 3 + 2] = (z - rows / 2) * 0.22;
              this.color(v.c, k++, (xx / cols) * 0.7, 0.35 + (z / rows) * 0.65);
            }
        this.group.rotation.x = 0.55;
        this.group.rotation.y = Math.sin(t * 0.09) * 0.12;
        this.group.position.y = -0.6;
        v.g.attributes.position.needsUpdate = true;
        v.g.attributes.color.needsUpdate = true;
      };
    } else if (["stars", "sphere", "pixels"].includes(kind)) {
      const count = Math.round(
          (kind === "sphere" ? 7000 : 3500) * config.density,
        ),
        v = this.lines(count, true),
        seeds = Array.from({ length: count }, (_, i) => {
          const a = i * 2.399963,
            r = Math.sqrt((i + 0.5) / count);
          return {
            a,
            r,
            x: Math.sin(i * 17.13) * 6,
            y: Math.cos(i * 7.73) * 4,
            z: (i / count) * 20,
          };
        });
      this.updateFn = (t) => {
        for (let i = 0; i < count; i++) {
          const s = seeds[i],
            a = amp(i);
          if (kind === "sphere") {
            const y = 1 - (2 * (i + 0.5)) / count,
              rr = Math.sqrt(1 - y * y),
              radius = 3.2 + a * 0.8;
            v.p.set(
              [
                Math.cos(s.a + t * 0.08) * rr * radius,
                y * radius,
                Math.sin(s.a + t * 0.08) * rr * radius,
              ],
              i * 3,
            );
          } else if (kind === "pixels") {
            v.p.set(
              [s.x, s.y - ((t * 0.6 + i * 0.001) % 8) + 4, Math.sin(i) * 3],
              i * 3,
            );
          } else {
            const z = ((s.z + t * (1 + this.level * 4)) % 20) - 12;
            v.p.set(
              [
                s.x * (0.4 + Math.abs(z) * 0.05),
                s.y * (0.4 + Math.abs(z) * 0.05),
                z,
              ],
              i * 3,
            );
          }
          this.color(v.c, i, i / count, 0.4 + a * 0.6);
        }
        v.obj.material.size =
          kind === "pixels" ? 0.085 : 0.028 + this.level * 0.03;
        this.group.position.y = 0;
        v.g.attributes.position.needsUpdate = true;
        v.g.attributes.color.needsUpdate = true;
      };
    } else if (["globe", "crystals", "prisms", "cubes"].includes(kind)) {
      const count =
          kind === "globe"
            ? 3
            : kind === "cubes"
              ? 27
              : Math.round(16 * config.density),
        objects = [];
      for (let i = 0; i < count; i++) {
        const g =
          kind === "globe"
            ? new THREE.DodecahedronGeometry(1.6, 1)
            : kind === "cubes"
              ? new THREE.BoxGeometry(0.7, 0.7, 0.7)
              : new THREE.IcosahedronGeometry(0.45 + (i % 3) * 0.12, 0);
        const wire = new THREE.LineSegments(
          new THREE.EdgesGeometry(g),
          new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.8,
          }),
        );
        g.dispose();
        this.group.add(wire);
        objects.push(wire);
      }
      this.updateFn = (t) => {
        objects.forEach((o, i) => {
          if (kind === "globe") {
            o.position.set((i - 1) * 3.4, Math.sin(t * 0.5 + i) * 0.3, 0);
          } else if (kind === "cubes") {
            o.position.set(
              ((i % 3) - 1) * 1.8,
              ((Math.floor(i / 3) % 3) - 1) * 1.8,
              (Math.floor(i / 9) - 1) * 1.8,
            );
          } else {
            o.position.set(
              Math.cos(i * 2.4 + t * 0.1) * (2 + (i % 3)),
              Math.sin(i * 2.4 + t * 0.12) * (1.5 + (i % 3) * 0.6),
              Math.sin(i * 1.7) * 2,
            );
          }
          o.rotation.set(t * 0.15 + i, t * 0.2 + i * 0.4, t * 0.07);
          o.scale.setScalar(1 + amp(i * 5) * 0.6);
          o.material.color.set(
            this.mode % 2 === 0
              ? this.mode >= 2
                ? 0x333333
                : 0xffffff
              : this.palette === "custom"
                ? new THREE.Color(this.paletteColors[0]).lerp(
                    new THREE.Color(this.paletteColors[1]),
                    i / count,
                  )
                : new THREE.Color().setHSL(
                    (i / count + t * 0.02) % 1,
                    0.85,
                    0.6,
                  ),
          );
        });
        this.group.rotation.y = kind === "cubes" ? t * 0.1 : 0;
        this.group.position.y = 0;
      };
    } else if (kind === "network") {
      const n = Math.round(120 * config.density),
        v = this.lines(n * 3 * 2),
        points = this.lines(n, true);
      this.updateFn = (t) => {
        for (let i = 0; i < n; i++) {
          const a = i * 2.39996,
            y = 1 - (2 * i) / n,
            r = Math.sqrt(1 - y * y) * (3 + amp(i) * 0.8);
          points.p.set(
            [Math.cos(a + t * 0.1) * r, y * 3, Math.sin(a + t * 0.1) * r],
            i * 3,
          );
          this.color(points.c, i, i / n);
        }
        let k = 0;
        for (let i = 0; i < n; i++)
          for (const offset of [1, 5, 13])
            for (const j of [i, (i + offset) % n]) {
              v.p.set(points.p.subarray(j * 3, j * 3 + 3), k * 3);
              this.color(v.c, k++, i / n, 0.6);
            }
        for (const z of [points, v]) {
          z.g.attributes.position.needsUpdate = true;
          z.g.attributes.color.needsUpdate = true;
        }
        this.group.rotation.z = Math.sin(t * 0.1) * 0.2;
        this.group.position.y = 0;
      };
    } else if (kind === "hex") {
      const v = this.lines(17 * 11 * 6 * 2);
      this.updateFn = (t) => {
        let k = 0;
        for (let y = 0; y < 11; y++)
          for (let x = 0; x < 17; x++) {
            const cx = (x - 8) * 0.6,
              cy = (y - 5) * 0.69 + (x % 2) * 0.345,
              r = 0.33 + amp(x + y * 4) * 0.1;
            for (let j = 0; j < 6; j++)
              for (let q = 0; q < 2; q++) {
                const a = ((j + q) * TAU) / 6;
                v.p.set(
                  [
                    cx + Math.cos(a) * r,
                    cy + Math.sin(a) * r,
                    Math.sin(x * 0.4 + y * 0.3 + t) * this.level,
                  ],
                  k * 3,
                );
                this.color(v.c, k++, x / 17);
              }
          }
        v.g.attributes.position.needsUpdate = true;
        v.g.attributes.color.needsUpdate = true;
        this.group.position.y = 0;
      };
    } else {
      const paths =
        kind === "halos"
          ? 9
          : kind === "bars"
            ? 96
            : kind === "ribbons" || kind === "wave"
              ? 6
              : kind === "tunnel"
                ? 32
                : kind === "orbits"
                  ? 12
                  : kind === "satellite"
                    ? 18
                    : kind === "vortex"
                      ? 24
                      : kind === "liquid"
                        ? 8
                        : kind === "rings"
                          ? 16
                          : 1;
      const segments = kind === "bars" ? 1 : kind === "radial" ? 192 : 240,
        v = this.lines(paths * segments * 2);
      this.updateFn = (t) => {
        let k = 0;
        for (let j = 0; j < paths; j++)
          for (let i = 0; i < segments; i++)
            for (let q = 0; q < 2; q++) {
              const u = (i + q) / segments,
                a = u * TAU,
                f = amp(u * 95 + j * 3);
              let x,
                y,
                z = 0;
              if (kind === "bars") {
                x = (j - 48) * 0.12;
                y = (q ? amp(j) * 4 : 0) - 1.8;
              } else if (kind === "wave" && this.features.waveform.length) {
                x = (u - 0.5) * 12;
                y =
                  (this.features.waveform[
                    Math.min(
                      this.features.waveform.length - 1,
                      Math.floor(u * this.features.waveform.length),
                    )
                  ] || 0) *
                    3 +
                  (j - 2.5) * 0.38;
              } else if (kind === "wave" || kind === "ribbons") {
                x = (u - 0.5) * 12;
                y =
                  Math.sin(u * TAU * (2 + j * 0.4) + t * (0.5 + j * 0.1)) *
                    (0.2 + f * 2) +
                  (j - 2.5) * 0.38;
                z = kind === "ribbons" ? Math.cos(u * TAU + t + j) * 0.7 : 0;
              } else if (kind === "radial") {
                const radius = q ? 2 + f * 3 : 1.8;
                x = Math.cos((i / segments) * TAU) * radius;
                y = Math.sin((i / segments) * TAU) * radius * 0.55;
                z = Math.sin((i / segments) * TAU) * radius * 0.45;
              } else if (kind === "tunnel") {
                const r = 1.5 + ((j / paths + t * 0.1) % 1) * 7;
                x = Math.cos(a + t * 0.12) * r;
                y = Math.sin(a + t * 0.12) * r;
                z = -((j / paths + t * 0.1) % 1) * 20 + 6;
              } else if (kind === "halos") {
                const r = 0.75 + f * 0.35;
                x = ((j % 3) - 1) * 3 + Math.cos(a) * r;
                y = (Math.floor(j / 3) - 1) * 2.3 + Math.sin(a) * r;
              } else if (kind === "flower") {
                const r = 2.2 + 0.65 * Math.sin(a * 8 + t) + f;
                x = Math.cos(a) * r;
                y = Math.sin(a) * r;
                z = Math.sin(a * 4 + t) * 0.8;
              } else {
                const r =
                  kind === "satellite"
                    ? 1 + j * 0.16
                    : kind === "liquid"
                      ? 2.4 + j * 0.07
                      : kind === "vortex"
                        ? 0.5 + j * 0.15
                        : 1.1 + j * 0.16;
                const twist = kind === "vortex" ? j * 0.19 + t * 0.3 : 0;
                const deform =
                  kind === "liquid"
                    ? Math.sin(a * 3 + t + j * 0.3) * (0.4 + this.level)
                    : f * 0.65;
                x = Math.cos(a + twist) * (r + deform);
                y =
                  Math.sin(a + twist) *
                  (r + deform) *
                  (kind === "orbits" ? 0.35 : 1);
                z =
                  kind === "satellite"
                    ? Math.sin(a) * r * 0.6
                    : Math.sin(a * 3 + t + j * 0.2) * this.level * 0.7;
                if (kind === "orbits") {
                  y += Math.sin(j) * 0.6;
                  z = Math.sin(a + j) * r * 0.6;
                }
              }
              v.p.set([x, y, z], k * 3);
              this.color(
                v.c,
                k++,
                u * 0.8 + (j / paths) * 0.2,
                0.45 + 0.55 * (1 - j / paths),
              );
            }
        this.group.rotation.x = kind === "rings" ? 0.6 : 0;
        this.group.rotation.z = kind === "orbits" ? t * 0.08 : 0;
        this.group.position.y = 0;
        v.g.attributes.position.needsUpdate = true;
        v.g.attributes.color.needsUpdate = true;
      };
    }
  }
  render(t, bins, level, features = { bass: 0, beat: 0, waveform: [] }) {
    this.features = features;
    for (let i = 0; i < 96; i++) this.bins[i] = bins[i];
    this.level += (level - this.level) * 0.18;
    this.scene.background = new THREE.Color(
      this.mode >= 2 ? 0xf2f1ef : 0x000000,
    );
    this.group.rotation.set(0, 0, 0);
    this.updateFn(t * (this.config.speed ?? 1) * this.tuning.speed);
    if (
      !["cells", "blobs", "kaleidoscope", "plasma"].includes(this.config.kind)
    ) {
      this.group.scale.setScalar(
        (this.config.scale ?? 1) * (1 + (features.beat || 0) * 0.045),
      );
      this.group.rotation.x += this.config.tilt ?? 0;
      this.group.rotation.z += this.config.twist ?? 0;
    }
    for (const o of this.group.children) {
      if (o.isPoints)
        o.material.blending =
          this.mode >= 2 ? THREE.NormalBlending : THREE.AdditiveBlending;
    }
    this.bloom.strength = this.tuning.bloom;
    this.bloom.enabled = this.mode < 2;
    if (this.mode < 2) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
  diagnostics() {
    const gl = this.renderer.getContext(),
      ext = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      renderer: ext
        ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER),
      webglError: gl.getError(),
      drawCalls: this.renderer.info.render.calls,
    };
  }
  thumbnail() {
    const source = this.renderer.domElement;
    const c = document.createElement("canvas");
    c.width = 480;
    c.height = 280;
    const ctx = c.getContext("2d");
    const w = source.width * 0.82,
      h = w / 1.714;
    ctx.drawImage(
      source,
      (source.width - w) / 2,
      (source.height - h) / 2,
      w,
      h,
      0,
      0,
      480,
      280,
    );
    return c.toDataURL("image/png");
  }
}

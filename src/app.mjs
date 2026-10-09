import { AudioFeatures } from "./audio-features.mjs";
import { validatePreset } from "./preset-schema.mjs";
import { Visuals, presets } from "./visuals.mjs";
const $ = (id) => document.getElementById(id),
  bridge = window.desktop;
const restoredSession = await bridge.windowSession();
const transparentWindow =
  new URLSearchParams(location.search).get("background") === "transparent";
document.documentElement.classList.toggle(
  "transparentWindow",
  transparentWindow,
);
const defaults = {
  preset: 0,
  mode: 1,
  gain: 1.5,
  duration: 90,
  quality: 1.5,
  shuffle: false,
  showClock: false,
  showTrack: true,
  enabled: presets.map((p) => p.id),
  custom: [],
  palette: "rainbow",
  colorA: "#65dbc6",
  colorB: "#a674ec",
  speed: 1,
  deform: 1,
  bloom: 0.8,
  autoHide: true,
  fpsLimit: 60,
  attack: 0.035,
  release: 0.22,
  trackShuffle: false,
};
let saved;
try {
  saved = JSON.parse(localStorage.getItem("preferences") || "{}");
} catch {
  saved = {};
}
const state = {
  ...defaults,
  ...saved,
  ...(restoredSession?.preferences || {}),
};
for (const candidate of state.custom || []) {
  try {
    const p = validatePreset(candidate);
    p.id = presets.length;
    presets.push(p);
  } catch {}
}
if (!("autoHide" in saved)) state.enabled = presets.map((p) => p.id);
state.preset = Math.max(
  0,
  Math.min(presets.length - 1, Number(state.preset) || 0),
);
state.enabled = Array.isArray(state.enabled)
  ? state.enabled.filter((i) => presets[i])
  : defaults.enabled;
const visuals = new Visuals($("visual"), { transparent: transparentWindow });
const player = $("player");
let sourceList,
  frame = { bins: new Array(96).fill(0), rms: 0 },
  demo = false,
  playlist = [],
  track = 0,
  lastShuffle = 0,
  audioContext,
  analyser,
  fileSource,
  playingFile = false,
  fps = 0,
  frames = 0,
  fpsAt = performance.now();
const featuresEngine = new AudioFeatures();
let lastRender = 0,
  lastActivity = performance.now(),
  lastAudio = performance.now(),
  transitionTimer,
  transitionToken = 0,
  manualHide = false,
  metadataBusy = false;
const collections = new Set(presets.map((p) => p.collection));
for (const name of collections) {
  const option = document.createElement("option");
  option.value = option.textContent = name;
  $("collection").append(option);
}
function persist() {
  localStorage.setItem("preferences", JSON.stringify(state));
}
function message(s) {
  $("status").textContent = s;
}
function setPreset(id, transition = false) {
  if (transition) {
    const token = ++transitionToken;
    clearTimeout(transitionTimer);
    $("visual").classList.add("changing");
    transitionTimer = setTimeout(() => {
      if (token !== transitionToken) return;
      setPreset(id);
      $("visual").classList.remove("changing");
    }, 280);
    return;
  }
  state.preset = id;
  const selected = presets[id];
  if (selected.palette) {
    state.palette = selected.palette.mode;
    [state.colorA, state.colorB] = selected.palette.colors;
    for (const key of ["palette", "colorA", "colorB"])
      $(key).value = state[key];
  }
  if (selected.bloom !== undefined) {
    state.bloom = selected.bloom;
    $("bloom").value = state.bloom;
  }
  visuals.setPreset(id);
  $("presetTitle").textContent = presets[id].name;
  document
    .querySelectorAll("article")
    .forEach((a) =>
      a.classList.toggle("selected", Number(a.dataset.id) === id),
    );
  persist();
}
function setMode(mode) {
  state.mode = mode;
  visuals.mode = mode;
  document.body.classList.toggle("lightMode", mode >= 2 && !transparentWindow);
  document
    .querySelectorAll("[data-mode]")
    .forEach((b) =>
      b.classList.toggle("active", Number(b.dataset.mode) === mode),
    );
  persist();
}
const demoFrame = (t) => ({
  bins: Array.from({ length: 96 }, (_, i) =>
    Math.max(
      0,
      Math.sin(i * 0.2 + t * 1.4) * 0.16 +
        0.12 +
        Math.exp(-Math.pow((i - 18 - 12 * Math.sin(t * 0.8)) / 9, 2)) *
          (0.35 + 0.25 * Math.sin(t * 3)),
    ),
  ),
  rms: 0.13 + 0.06 * Math.sin(t * 3),
});
function buildGallery() {
  $("cards").replaceChildren();
  const chosen = state.preset,
    mode = state.mode;
  visuals.mode = 1;
  const f = demoFrame(2);
  for (const p of presets) {
    visuals.setPreset(p.id);
    for (let i = 0; i < 4; i++) visuals.render(2 + i * 0.03, f.bins, f.rms);
    const article = document.createElement("article");
    article.dataset.id = p.id;
    const b = document.createElement("button");
    b.className = "selectPreset";
    b.title = p.name;
    b.setAttribute("aria-label", "Select " + p.name);
    const image = new Image();
    image.src = visuals.thumbnail();
    image.alt = "";
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = p.name;
    b.append(image, name);
    b.onclick = () => {
      setPreset(p.id, true);
      $("gallery").hidden = true;
    };
    const check = document.createElement("button");
    check.className = "include";
    check.textContent = "✓";
    check.title = "Include " + p.name + " in shuffle";
    check.setAttribute("aria-label", check.title);
    check.classList.toggle("enabled", state.enabled.includes(p.id));
    check.setAttribute("aria-pressed", state.enabled.includes(p.id));
    check.onclick = () => {
      if (state.enabled.includes(p.id))
        state.enabled = state.enabled.filter((i) => i !== p.id);
      else state.enabled.push(p.id);
      check.classList.toggle("enabled", state.enabled.includes(p.id));
      check.setAttribute("aria-pressed", state.enabled.includes(p.id));
      persist();
    };
    article.append(b, check);
    $("cards").append(article);
  }
  setMode(mode);
  setPreset(chosen);
  filterGallery();
}
function panel(id) {
  const open = $(id).hidden;
  for (const key of ["gallery", "settings", "playlistPanel"])
    $(key).hidden = true;
  $(id).hidden = !open;
  document.body.classList.remove("hiddenControls");
  lastActivity = performance.now();
  manualHide = false;
}
async function refresh() {
  try {
    const previous = $("source").value;
    sourceList = await bridge.sources();
    $("source").replaceChildren(
      ...sourceList.sources.map((s) => {
        const o = document.createElement("option");
        o.value = s.name;
        o.textContent = (s.monitor ? "System · " : "Mic · ") + s.label;
        return o;
      }),
    );
    if (sourceList.sources.some((s) => s.name === previous))
      $("source").value = previous;
  } catch (e) {
    message("Cannot access audio: " + e.message);
  }
}
async function capture(name) {
  try {
    await bridge.capture(name);
    player.pause();
    playingFile = false;
    demo = false;
    $("demo").classList.remove("active");
    $("source").value = name;
    for (const id of ["system", "microphone"])
      $(id).classList.toggle(
        "active",
        id ===
          (sourceList.sources.find((s) => s.name === name)?.monitor
            ? "system"
            : "microphone"),
      );
    message(
      "Listening · " +
        (sourceList.sources.find((s) => s.name === name)?.label || name),
    );
  } catch (e) {
    message(e.message);
  }
}
async function useSystem() {
  await refresh();
  if (sourceList) await capture(sourceList.defaultMonitor);
}
function ensureAnalyser() {
  if (!audioContext) {
    audioContext = new AudioContext();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.7;
    fileSource = audioContext.createMediaElementSource(player);
    fileSource.connect(analyser);
    analyser.connect(audioContext.destination);
  }
  return audioContext.resume();
}
async function playTrack(index) {
  if (!playlist.length) {
    message("Choose music files first.");
    return;
  }
  track = (index + playlist.length) % playlist.length;
  await bridge.stop();
  frame = { bins: new Array(96).fill(0), rms: 0 };
  demo = false;
  playingFile = true;
  await ensureAnalyser();
  player.src = playlist[track].url;
  try {
    await player.play();
    message("Playing local music");
    const item = playlist[track];
    const meta = await bridge.localMetadata(item.url);
    if (item === playlist[track])
      $("trackInfo").textContent = state.showTrack
        ? meta?.artist
          ? meta.artist + " · " + meta.title
          : meta?.title || item.name
        : "";
    renderQueue();
    $("system").classList.remove("active");
    $("microphone").classList.remove("active");
    $("demo").classList.remove("active");
  } catch (e) {
    message("Cannot play " + playlist[track].name + ": " + e.message);
  }
}
$("music").onclick = async () => {
  const files = await bridge.music();
  if (files.length) {
    playlist = files;
    await playTrack(0);
  }
};
$("system").onclick = useSystem;
$("microphone").onclick = async () => {
  await refresh();
  const mic = sourceList?.sources.find((s) => !s.monitor);
  if (mic) await capture(mic.name);
  else message("No microphone found.");
};
$("source").onchange = () => capture($("source").value);
$("refresh").onclick = refresh;
$("play").onclick = async () => {
  if (!playlist.length) {
    $("music").click();
    return;
  }
  if (player.paused) {
    await ensureAnalyser();
    try {
      await player.play();
    } catch (e) {
      message(e.message);
    }
  } else player.pause();
};
player.onplay = () => {
  $("play").textContent = "Ⅱ";
};
player.onpause = () => {
  $("play").textContent = "▶";
};
player.onended = () =>
  playTrack(
    state.trackShuffle && playlist.length > 1
      ? (track + 1 + Math.floor(Math.random() * (playlist.length - 1))) %
          playlist.length
      : track + 1,
  );
player.onerror = () =>
  message("This audio file could not be decoded. Try WAV, FLAC, OGG or MP3.");
$("previous").onclick = () => playTrack(track - 1);
$("next").onclick = () => playTrack(track + 1);
$("galleryButton").onclick = () => panel("gallery");
$("settingsButton").onclick = () => panel("settings");
$("closeGallery").onclick = () => {
  $("gallery").hidden = true;
};
$("closeSettings").onclick = () => {
  $("settings").hidden = true;
  $("playlistPanel").hidden = true;
  manualHide = document.body.classList.contains("hiddenControls");
};
function filterGallery() {
  document.querySelectorAll("article").forEach((a) => {
    const p = presets[Number(a.dataset.id)];
    a.hidden =
      !p.name.toLowerCase().includes($("search").value.toLowerCase()) ||
      ($("collection").value !== "All" &&
        p.collection !== $("collection").value);
  });
}
$("search").oninput = filterGallery;
$("collection").onchange = filterGallery;
for (const b of document.querySelectorAll("[data-mode]"))
  b.onclick = () => setMode(Number(b.dataset.mode));
for (const key of [
  "gain",
  "duration",
  "quality",
  "shuffle",
  "showClock",
  "showTrack",
  "palette",
  "colorA",
  "colorB",
  "speed",
  "deform",
  "bloom",
  "autoHide",
  "fpsLimit",
  "attack",
  "release",
  "trackShuffle",
]) {
  const el = $(key);
  if (el.type === "checkbox") el.checked = !!state[key];
  else el.value = state[key];
  el.oninput = () => {
    state[key] =
      el.type === "checkbox"
        ? el.checked
        : ["palette", "colorA", "colorB"].includes(key)
          ? el.value
          : Number(el.value);
    if (key === "quality") {
      visuals.qualityLimit = state.quality;
      visuals.resize();
    }
    if (key === "showTrack")
      $("trackInfo").textContent =
        state.showTrack && playlist[track] ? playlist[track].name : "";
    lastShuffle = performance.now() / 1000;
    persist();
  };
}
$("demo").onclick = async () => {
  demo = !demo;
  $("demo").classList.toggle("active", demo);
  if (demo) {
    player.pause();
    playingFile = false;
    await bridge.stop();
    $("system").classList.remove("active");
    $("microphone").classList.remove("active");
    message("Demo · generated motion, no audio input");
  } else await useSystem();
};
$("fullscreen").onclick = () => bridge.fullscreen();
$("hide").onclick = () => {
  document.body.classList.toggle("hiddenControls");
  $("gallery").hidden = true;
  $("settings").hidden = true;
  $("playlistPanel").hidden = true;
  manualHide = document.body.classList.contains("hiddenControls");
};
$("diagnostics").onclick = async () => {
  const info = visuals.diagnostics(),
    host = await bridge.diagnostics();
  $("gpu").textContent =
    info.renderer + " · " + fps + " FPS · WebGL " + host.features.webgl;
};
window.addEventListener("keydown", (e) => {
  lastActivity = performance.now();
  if (["INPUT", "SELECT"].includes(e.target.tagName)) return;
  if (e.key === "f" || e.key === "F") bridge.fullscreen();
  if (e.key === "v" || e.key === "V") panel("gallery");
  if (e.key === "h" || e.key === "H") $("hide").click();
  if (e.key === "Escape") {
    for (const key of ["gallery", "settings", "playlistPanel"])
      $(key).hidden = true;
    manualHide = false;
    document.body.classList.remove("hiddenControls");
  }
  if (e.key === "ArrowRight")
    setPreset((state.preset + 1) % presets.length, true);
  if (e.key === "ArrowLeft")
    setPreset((state.preset + presets.length - 1) % presets.length, true);
  if (e.code === "Space") {
    e.preventDefault();
    $("play").click();
  }
});
window.addEventListener("resize", () => visuals.scheduleResize());
bridge.onFrame((f) => {
  frame = f;
  lastAudio = performance.now();
});
bridge.onStatus(message);
let totalRendered = 0,
  lastRenderedAt = 0,
  longestFrameGap = 0;
function animate(ms) {
  requestAnimationFrame(animate);
  if (
    document.hidden ||
    visuals.resizing ||
    ms - lastRender < 1000 / state.fpsLimit - 0.5
  )
    return;
  lastRender = ms;
  const open = ["gallery", "settings", "playlistPanel"].some(
    (id) => !$(id).hidden,
  );
  if (state.autoHide && !open && ms - lastActivity > 3500)
    document.body.classList.add("hiddenControls");
  visuals.palette = state.palette;
  visuals.paletteColors = [state.colorA, state.colorB];
  visuals.tuning = {
    speed: state.speed,
    deform: state.deform,
    bloom: state.bloom,
  };
  const t = ms / 1000;
  let current =
    ms - lastAudio > 300 ? { bins: new Array(96).fill(0), rms: 0 } : frame;
  if (demo) current = demoFrame(t);
  else if (playingFile && analyser) {
    const data = new Uint8Array(analyser.frequencyBinCount),
      wave = new Float32Array(analyser.fftSize);
    analyser.getByteFrequencyData(data);
    analyser.getFloatTimeDomainData(wave);
    current = {
      bins: Array.from({ length: 96 }, (_, i) => {
        const lo = Math.max(
            1,
            Math.floor(
              (30 * Math.pow(600, i / 96) * analyser.fftSize) /
                audioContext.sampleRate,
            ),
          ),
          hi = Math.min(
            data.length,
            Math.max(
              lo + 1,
              Math.ceil(
                (30 * Math.pow(600, (i + 1) / 96) * analyser.fftSize) /
                  audioContext.sampleRate,
              ),
            ),
          );
        let v = 0;
        for (let j = lo; j < hi; j++) v = Math.max(v, data[j]);
        return v / 255;
      }),
      rms: Math.sqrt(wave.reduce((sum, v) => sum + v * v, 0) / wave.length),
      waveform: Array.from(wave),
    };
  }
  const musical = featuresEngine.update(
    current,
    t,
    state.attack,
    state.release,
  );
  const bins = Array.from(musical.bins, (x) => Math.min(1, x * state.gain));
  visuals.render(t, bins, Math.min(1, current.rms * state.gain * 3), musical);
  $("meter").style.height = Math.min(100, current.rms * state.gain * 300) + "%";
  $("clock").textContent = state.showClock
    ? new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";
  if (state.shuffle && t - lastShuffle > state.duration) {
    const available = state.enabled.filter((i) => i !== state.preset);
    if (available.length)
      setPreset(available[Math.floor(Math.random() * available.length)], true);
    lastShuffle = t;
  }
  totalRendered++;
  if (lastRenderedAt)
    longestFrameGap = Math.max(longestFrameGap, ms - lastRenderedAt);
  lastRenderedAt = ms;
  frames++;
  if (ms - fpsAt >= 1000) {
    fps = Math.round((frames * 1000) / (ms - fpsAt));
    frames = 0;
    fpsAt = ms;
  }
}

function renderQueue() {
  $("queue").replaceChildren(
    ...playlist.map((item, index) => {
      const li = document.createElement("li");
      li.classList.toggle("current", index === track && playingFile);
      const song = document.createElement("button");
      song.className = "song";
      song.textContent = index + 1 + ". " + item.name;
      song.onclick = () => playTrack(index);
      li.append(song);
      for (const [symbol, delta] of [
        ["↑", -1],
        ["↓", 1],
      ]) {
        const b = document.createElement("button");
        b.textContent = symbol;
        b.title = "Move track " + (delta < 0 ? "up" : "down");
        b.disabled = index + delta < 0 || index + delta >= playlist.length;
        b.onclick = () => {
          const current = playlist[track];
          [playlist[index], playlist[index + delta]] = [
            playlist[index + delta],
            playlist[index],
          ];
          track = playlist.indexOf(current);
          renderQueue();
        };
        li.append(b);
      }
      const remove = document.createElement("button");
      remove.textContent = "×";
      remove.title = "Remove from queue";
      remove.onclick = () => {
        const current = playlist[track],
          removingCurrent = index === track;
        playlist.splice(index, 1);
        if (removingCurrent) {
          player.pause();
          track = Math.min(index, playlist.length - 1);
          if (playlist.length) playTrack(track);
          else {
            $("trackInfo").textContent = "";
            playingFile = false;
          }
        } else track = playlist.indexOf(current);
        renderQueue();
      };
      li.append(remove);
      return li;
    }),
  );
}
$("playlistButton").onclick = () => {
  renderQueue();
  panel("playlistPanel");
};
$("closePlaylist").onclick = () => {
  $("playlistPanel").hidden = true;
};
$("addMusic").onclick = async () => {
  const files = await bridge.music();
  playlist.push(...files);
  renderQueue();
};
function currentPreset() {
  const p = presets[state.preset];
  return validatePreset({
    ...p,
    name: $("presetName").value.trim() || p.name + " custom",
    speed: Math.min(3, p.speed * state.speed),
    deform: Math.min(3, p.deform * state.deform),
    bloom: state.bloom,
    palette: { mode: state.palette, colors: [state.colorA, state.colorB] },
  });
}
function addPreset(p) {
  p.id = presets.length;
  presets.push(p);
  state.custom.push(p);
  state.enabled.push(p.id);
  if (![...$("collection").options].some((o) => o.value === "Custom")) {
    const option = document.createElement("option");
    option.value = option.textContent = "Custom";
    $("collection").append(option);
  }
  buildGallery();
  state.speed = 1;
  state.deform = 1;
  $("speed").value = 1;
  $("deform").value = 1;
  setPreset(p.id);
  persist();
}
$("savePreset").onclick = () => {
  try {
    addPreset(currentPreset());
    message("Saved your custom preset.");
  } catch (e) {
    message(e.message);
  }
};
$("exportPreset").onclick = async () => {
  try {
    if (await bridge.exportPreset(currentPreset())) message("Preset exported.");
  } catch (e) {
    message(e.message);
  }
};
$("importPreset").onclick = async () => {
  try {
    const value = await bridge.importPreset();
    if (value) {
      addPreset(validatePreset(value));
      message("Preset imported.");
    }
  } catch (e) {
    message(e.message);
  }
};
window.addEventListener("pointermove", () => {
  lastActivity = performance.now();
  if (!manualHide) document.body.classList.remove("hiddenControls");
});
setInterval(async () => {
  if (!state.showTrack || playingFile || demo || metadataBusy) return;
  metadataBusy = true;
  try {
    const meta = await bridge.metadata();
    $("trackInfo").textContent = meta?.title
      ? (meta.artist ? meta.artist + " · " : "") + meta.title
      : "";
  } finally {
    metadataBusy = false;
  }
}, 2000);

window.verifyInteractions = async () => {
  const backup = JSON.parse(JSON.stringify(state)),
    count = presets.length,
    checks = {};
  $("collection").value = "Procedural";
  $("search").value = "lava";
  filterGallery();
  checks.galleryFilter =
    [...document.querySelectorAll("article")].filter((a) => !a.hidden)
      .length === 1;
  $("search").value = "";
  $("collection").value = "All";
  filterGallery();
  setPreset(48, true);
  checks.transitionStarted = $("visual").classList.contains("changing");
  await new Promise((r) => setTimeout(r, 350));
  checks.transitionCompleted =
    state.preset === 48 && !$("visual").classList.contains("changing");
  $("palette").value = "custom";
  $("palette").dispatchEvent(new Event("input"));
  await new Promise((r) => setTimeout(r, 80));
  visuals.render(2, demoFrame(2).bins, 0.2);
  checks.gradient =
    visuals.palette === "custom" && visuals.diagnostics().webglError === 0;
  $("presetName").value = "Verified custom cells";
  $("savePreset").click();
  checks.customSaved =
    presets.length === count + 1 &&
    state.custom.at(-1).name === "Verified custom cells";
  playlist = [
    { name: "One", url: "spectrum-media://track/one" },
    { name: "Two", url: "spectrum-media://track/two" },
  ];
  track = 0;
  renderQueue();
  $("queue").children[0].querySelectorAll("button")[2].click();
  checks.queueReorder = playlist[0].name === "Two" && track === 1;
  $("queue").children[0].querySelectorAll("button")[3].click();
  checks.queueRemove = playlist.length === 1 && playlist[0].name === "One";
  playlist = [];
  track = 0;
  renderQueue();
  for (const key of ["gallery", "settings", "playlistPanel"])
    $(key).hidden = true;
  state.autoHide = true;
  manualHide = false;
  lastActivity = performance.now() - 5000;
  await new Promise((r) => setTimeout(r, 100));
  checks.idleHide = document.body.classList.contains("hiddenControls");
  window.dispatchEvent(new Event("pointermove"));
  checks.pointerReveal = !document.body.classList.contains("hiddenControls");
  presets.splice(count);
  Object.assign(state, backup);
  $("presetName").value = "";
  $("palette").value = state.palette;
  buildGallery();
  persist();
  lastActivity = performance.now();
  return { passed: Object.values(checks).every(Boolean), checks };
};
window.verifyPlayback = async (url) => {
  playlist = [{ name: "Verification tone.wav", url }];
  await playTrack(0);
  await new Promise((r) => setTimeout(r, 450));
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  const peak = Math.max(...data);
  const result = {
    passed: !player.paused && player.currentTime > 0 && peak > 0,
    currentTime: player.currentTime,
    frequencyPeak: peak,
  };
  player.pause();
  return result;
};
window.verifyAll = async () => {
  const original = { preset: state.preset, mode: state.mode };
  const results = [];
  for (let mode = 0; mode < 4; mode++) {
    visuals.mode = mode;
    for (const p of presets) {
      visuals.setPreset(p.id);
      const f = demoFrame(3);
      visuals.render(3, f.bins, f.rms);
      const d = visuals.diagnostics();
      results.push({
        preset: p.name,
        mode,
        webglError: d.webglError,
        drawCalls: d.drawCalls,
      });
    }
  }
  visuals.mode = original.mode;
  setPreset(original.preset);
  const f = demoFrame(4);
  for (let i = 0; i < 12; i++) visuals.render(4, f.bins, f.rms);
  lastActivity = performance.now();
  return {
    passed: results.every((r) => r.webglError === 0 && r.drawCalls > 0),
    presets: presets.length,
    combinations: results.length,
    renderer: visuals.diagnostics().renderer,
    results,
  };
};
window.sessionSnapshot = () => ({
  preferences: JSON.parse(JSON.stringify(state)),
  playlist: playlist.map((p) => ({ ...p })),
  track,
  playingFile,
  paused: player.paused,
  position: player.currentTime,
  demo,
  source: $("source").value,
});
$("windowMode").value = transparentWindow ? "transparent" : "normal";
$("windowMode").onchange = async () => {
  try {
    $("windowMode").disabled = true;
    await bridge.windowMode($("windowMode").value);
  } catch (e) {
    $("windowMode").disabled = false;
    $("windowMode").value = transparentWindow ? "transparent" : "normal";
    message(e.message);
  }
};
$("closeWindow").onclick = () => bridge.close();
buildGallery();
visuals.qualityLimit = state.quality;
visuals.resize();
if (restoredSession) {
  playlist = restoredSession.playlist || [];
  track = restoredSession.track || 0;
  renderQueue();
  if (restoredSession.playingFile && playlist.length) {
    await playTrack(track);
    if (restoredSession.paused) player.pause();
    if (player.readyState < 1)
      await new Promise((resolve) =>
        player.addEventListener("loadedmetadata", resolve, { once: true }),
      );
    const position = Math.min(
      restoredSession.position || 0,
      Math.max(
        0,
        (Number.isFinite(player.duration) ? player.duration : Infinity) - 0.01,
      ),
    );
    if (position > 0) {
      const seeked = new Promise((resolve) => {
        player.addEventListener("seeked", resolve, { once: true });
        setTimeout(resolve, 1000);
      });
      player.currentTime = position;
      await seeked;
    }
  } else if (restoredSession.demo) {
    await $("demo").onclick();
  } else {
    await refresh();
    if (
      restoredSession.source &&
      sourceList?.sources.some((s) => s.name === restoredSession.source)
    )
      await capture(restoredSession.source);
    else await useSystem();
  }
} else await useSystem();
window.sessionReady = true;
requestAnimationFrame(animate);

window.previewProcedural = async () => {
  for (const key of ["gallery", "settings", "playlistPanel"])
    $(key).hidden = true;
  setPreset(48);
  if (!demo) await $("demo").onclick();
  lastActivity = performance.now();
  manualHide = false;
  document.body.classList.remove("hiddenControls");
};

window.verifyAlpha = () => {
  const original = { preset: state.preset, mode: visuals.mode };
  const results = [];
  const gl = visuals.renderer.getContext();
  const width = gl.drawingBufferWidth,
    height = gl.drawingBufferHeight,
    pixels = new Uint8Array(width * height * 4);
  for (let mode = 0; mode < 4; mode++)
    for (const p of presets) {
      visuals.mode = mode;
      visuals.setPreset(p.id);
      const f = demoFrame(3);
      visuals.render(3, f.bins, f.rms);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let min = 255,
        max = 0,
        clear = 0,
        total = 0;
      for (let i = 3; i < pixels.length; i += 4 * 37) {
        const a = pixels[i];
        min = Math.min(min, a);
        max = Math.max(max, a);
        if (a < 250) clear++;
        total++;
      }
      results.push({
        preset: p.name,
        mode,
        minAlpha: min,
        maxAlpha: max,
        nonOpaqueRatio: clear / total,
        webglError: gl.getError(),
      });
    }
  visuals.mode = original.mode;
  setPreset(original.preset);
  return {
    passed: results.every(
      (r) =>
        r.webglError === 0 &&
        (transparentWindow
          ? r.minAlpha < 240 && r.maxAlpha > r.minAlpha + 5
          : r.minAlpha === 255),
    ),
    transparent: transparentWindow,
    renderer: visuals.diagnostics().renderer,
    combinations: results.length,
    results,
  };
};
window.previewTransparentRing = async () => {
  for (const key of ["gallery", "settings", "playlistPanel"])
    $(key).hidden = true;
  setPreset(0);
  if (!demo) await $("demo").onclick();
  lastActivity = performance.now();
  manualHide = false;
  document.body.classList.remove("hiddenControls");
};

window.samplePerformance = async (duration = 1500) => {
  const count = totalRendered,
    start = performance.now();
  longestFrameGap = 0;
  await new Promise((r) => setTimeout(r, duration));
  return {
    fps: ((totalRendered - count) * 1000) / (performance.now() - start),
    longestFrameGap,
    viewport: { width: innerWidth, height: innerHeight },
    ...visuals.diagnostics(),
  };
};
window.resetTransitionTiming=()=>{longestFrameGap=0;lastRenderedAt=performance.now();};
window.transitionTiming=()=>({longestFrameGap,resizeCount:visuals.resizeCount});

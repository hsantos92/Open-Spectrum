const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  protocol,
  net,
} = require("electron");
const { spawn, execFile } = require("node:child_process");
const { promisify } = require("node:util");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { spectrum, PCMFrames } = require("./src/dsp.cjs");
const exec = promisify(execFile);
let win,
  capture,
  lastFrame = { bins: new Array(96).fill(0), rms: 0 },
  allowedFiles = new Map();
const verify = process.argv.includes("--verify");
const verifyTransparency = process.argv.includes("--verify-transparency");
let windowMode = "normal",
  switchingWindow = false;
const windowSessions = new Map();
let peak = 0,
  packets = 0,
  errors = [];
app.setName(
  process.argv.includes("--preview")
    ? "Open Spectrum Preview"
    : process.argv.includes("--next")
      ? "Open Spectrum Next"
      : "Open Spectrum",
);
app.commandLine.appendSwitch(
  "disable-features",
  "Vulkan,VulkanFromANGLE,DefaultANGLEVulkan",
);
app.commandLine.appendSwitch("use-angle", "gl");
if (verify || verifyTransparency)
  app.setPath("userData", path.join(__dirname, ".verify-profile"));
protocol.registerSchemesAsPrivileged([
  {
    scheme: "spectrum-media",
    privileges: {
      standard: true,
      secure: true,
      stream: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);
async function sources() {
  const [{ stdout }, { stdout: sink }] = await Promise.all([
    exec("pactl", ["-f", "json", "list", "sources"]),
    exec("pactl", ["get-default-sink"]),
  ]);
  return {
    sources: JSON.parse(stdout).map((s) => ({
      name: s.name,
      label: s.description,
      monitor: !!s.monitor_source || s.name.endsWith(".monitor"),
    })),
    defaultMonitor: sink.trim() + ".monitor",
  };
}
function stop() {
  if (capture) {
    const old = capture;
    capture = null;
    old.kill();
  }
}
function status(message) {
  if (win && !win.isDestroyed()) win.webContents.send("audio-status", message);
}
async function start(name) {
  stop();
  const list = await sources();
  if (!list.sources.some((s) => s.name === name))
    throw Error(
      "Audio source is no longer available. Refresh the source list.",
    );
  lastFrame = { bins: new Array(96).fill(0), rms: 0 };
  const child = spawn(
    "parec",
    [
      "--device=" + name,
      "--format=float32le",
      "--rate=48000",
      "--channels=2",
      "--latency-msec=30",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  capture = child;
  const frames = new PCMFrames(
    (samples) => {
      if (child !== capture) return;
      lastFrame = spectrum(samples);
      peak = Math.max(peak, lastFrame.rms);
      packets++;
      if (win && !win.isDestroyed())
        win.webContents.send("audio-frame", lastFrame);
    },
    2048,
    512,
    2,
  );
  child.stdout.on("data", (b) => frames.push(b));
  child.stderr.on("data", (b) => {
    if (child === capture) status(b.toString().trim());
  });
  child.on("error", (e) => status(e.message));
  child.on("exit", (code) => {
    if (child === capture) {
      capture = null;
      status("Audio capture stopped (" + code + "). Select a source to retry.");
    }
  });
  return true;
}
ipcMain.handle("sources", () => sources());
ipcMain.handle("capture", (_, name) => start(name));
ipcMain.handle("stop", () => stop());
ipcMain.handle("fullscreen", () => {
  win.setFullScreen(!win.isFullScreen());
  return win.isFullScreen();
});
ipcMain.handle("music", async () => {
  const result = await dialog.showOpenDialog(win, {
    properties: ["openFile", "multiSelections"],
    filters: [
      {
        name: "Audio",
        extensions: ["mp3", "flac", "wav", "ogg", "m4a", "opus", "aac"],
      },
    ],
  });
  return result.filePaths.map((p) => {
    const id = require("node:crypto").randomUUID();
    allowedFiles.set(id, p);
    return { name: path.basename(p), url: "spectrum-media://track/" + id };
  });
});
async function trackMetadata() {
  try {
    const { stdout } = await exec(
      "playerctl",
      [
        "--all-players",
        "metadata",
        "--format",
        "{{playerName}}\t{{status}}\t{{artist}}\t{{title}}",
      ],
      { timeout: 2500 },
    );
    const tracks = stdout
      .trim()
      .split("\n")
      .map((line) => {
        const [player, status, artist, title] = line.split("\t");
        return { player, status, artist, title };
      });
    return tracks.find((t) => t.status === "Playing") || tracks[0] || null;
  } catch {
    return null;
  }
}
ipcMain.handle("track-metadata", () => trackMetadata());
ipcMain.handle("local-metadata", async (_, url) => {
  const id = typeof url === "string" ? url.split("/").pop() : "";
  const file = allowedFiles.get(id);
  if (!file) return null;
  try {
    const { stdout } = await exec(
      "ffprobe",
      [
        "-v",
        "quiet",
        "-show_entries",
        "format_tags=title,artist,album",
        "-of",
        "json",
        file,
      ],
      { timeout: 3000 },
    );
    const tags = JSON.parse(stdout).format?.tags || {};
    return {
      title: tags.title || tags.TITLE || path.basename(file),
      artist: tags.artist || tags.ARTIST || "",
      album: tags.album || tags.ALBUM || "",
    };
  } catch {
    return { title: path.basename(file), artist: "" };
  }
});
ipcMain.handle("preset-export", async (_, preset) => {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    defaultPath: "my-spectrum-preset.json",
    filters: [{ name: "Spectrum preset", extensions: ["json"] }],
  });
  if (canceled) return false;
  const { validatePreset } = await import("./src/preset-schema.mjs");
  const value = validatePreset(preset);
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n");
  return true;
});
ipcMain.handle("preset-import", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    filters: [{ name: "Spectrum preset", extensions: ["json"] }],
    properties: ["openFile"],
  });
  if (canceled) return null;
  if (fs.statSync(filePaths[0]).size > 16384)
    throw Error("Preset file is too large.");
  const { validatePreset } = await import("./src/preset-schema.mjs");
  return validatePreset(JSON.parse(fs.readFileSync(filePaths[0], "utf8")));
});
ipcMain.handle("diagnostics", async () => ({
  features: app.getGPUFeatureStatus(),
  gpu: await app.getGPUInfo("complete"),
}));
async function createWindow(bounds = null, sessionData = null) {
  win = new BrowserWindow({
    width: bounds?.width || 1280,
    height: bounds?.height || 850,
    minWidth: 800,
    minHeight: 550,
    frame: windowMode === "normal",
    transparent: windowMode === "transparent",
    hasShadow: windowMode === "normal",
    backgroundColor: windowMode === "transparent" ? "#00000000" : "#000000",
    show: false,
    title: app.getName(),
    icon: path.join(__dirname, "assets/icon.svg"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.setMenuBarVisibility(false);
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("console-message", (details) => {
    if (details.level === "error") {
      errors.push(details.message);
      console.error(details.message);
    }
  });
  win.webContents.on("render-process-gone", (_e, d) =>
    console.error("Renderer exit", d),
  );
  const created = win;
  windowSessions.set(created.webContents.id, sessionData);
  await created.loadFile("index.html", { query: { background: windowMode } });
  await created.webContents.executeJavaScript(
    `(async()=>{const deadline=performance.now()+10000;while(!window.sessionReady){if(performance.now()>deadline)throw Error('Window session did not initialize.');await new Promise(r=>setTimeout(r,25));}})()`,
  );
  created.show();
  return created;
}
ipcMain.handle("window-session", (event) => {
  const saved = windowSessions.get(event.sender.id) || null;
  windowSessions.delete(event.sender.id);
  return saved;
});
ipcMain.handle("close-window", (event) => {
  if (event.sender === win.webContents) win.close();
});
async function changeWindowMode(mode) {
  if (!["normal", "transparent"].includes(mode))
    throw Error("Unknown background mode.");
  if (switchingWindow || mode === windowMode) return false;
  switchingWindow = true;
  const old = win,
    previous = windowMode;
  try {
    const snapshot = await old.webContents.executeJavaScript(
      "window.sessionSnapshot()",
    );
    const fullscreen = old.isFullScreen();
    windowMode = mode;
    const created = await createWindow(old.getBounds(), snapshot);
    if (fullscreen) created.setFullScreen(true);
    fs.mkdirSync(app.getPath("userData"), { recursive: true });
    fs.writeFileSync(
      path.join(app.getPath("userData"), "window-mode.json"),
      JSON.stringify({ mode }),
    );
    old.destroy();
    return true;
  } catch (error) {
    if (win !== old && !win.isDestroyed()) win.destroy();
    win = old;
    windowMode = previous;
    throw error;
  } finally {
    switchingWindow = false;
  }
}
ipcMain.handle("window-mode", (event, mode) => {
  if (
    event.sender !== win.webContents ||
    event.senderFrame !== win.webContents.mainFrame
  )
    throw Error("Unknown window.");
  return changeWindowMode(mode);
});
app.whenReady().then(async () => {
  try {
    const value = JSON.parse(
      fs.readFileSync(
        path.join(app.getPath("userData"), "window-mode.json"),
        "utf8",
      ),
    );
    if (value.mode === "transparent") windowMode = value.mode;
  } catch {}
  if (process.argv.includes("--transparent")) windowMode = "transparent";
  if (process.argv.includes("--opaque")) windowMode = "normal";

  protocol.handle("spectrum-media", async (request) => {
    const p = allowedFiles.get(new URL(request.url).pathname.slice(1));
    if (!p) return new Response("Not found", { status: 404 });
    const response = await net.fetch(pathToFileURL(p).href);
    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    return new Response(response.body, { status: response.status, headers });
  });
  await createWindow();
  if (verifyTransparency) {
    try {
      await new Promise((r) => setTimeout(r, 1800));
      const opaque = await win.webContents.executeJavaScript(
        "window.verifyAlpha()",
      );
      await win.webContents.executeJavaScript("window.previewProcedural()");
      const before = await win.webContents.executeJavaScript(
        "window.sessionSnapshot()",
      );
      await changeWindowMode("transparent");
      await new Promise((r) => setTimeout(r, 800));
      const after = await win.webContents.executeJavaScript(
        "window.sessionSnapshot()",
      );
      const transparent = await win.webContents.executeJavaScript(
        "window.verifyAlpha()",
      );
      await win.webContents.executeJavaScript("window.previewProcedural()");
      await new Promise((r) => setTimeout(r, 200));
      fs.writeFileSync(
        path.join(__dirname, "transparent-procedural.png"),
        (await win.webContents.capturePage()).toPNG(),
      );
      await win.webContents.executeJavaScript(
        "window.previewTransparentRing()",
      );
      await new Promise((r) => setTimeout(r, 200));
      const nativeImage = await win.webContents.capturePage();
      fs.writeFileSync(
        path.join(__dirname, "transparent-preview.png"),
        nativeImage.toPNG(),
      );
      const rgba = nativeImage.toBitmap();
      let min = 255,
        max = 0;
      for (let i = 3; i < rgba.length; i += 4 * 37) {
        min = Math.min(min, rgba[i]);
        max = Math.max(max, rgba[i]);
      }
      const nativeAlpha = { min, max, passed: min === 0 && max > 200 };
      const n = 48000 * 4,
        buffer = Buffer.alloc(44 + n * 2);
      buffer.write("RIFF");
      buffer.writeUInt32LE(36 + n * 2, 4);
      buffer.write("WAVEfmt ", 8);
      buffer.writeUInt32LE(16, 16);
      buffer.writeUInt16LE(1, 20);
      buffer.writeUInt16LE(1, 22);
      buffer.writeUInt32LE(48000, 24);
      buffer.writeUInt32LE(96000, 28);
      buffer.writeUInt16LE(2, 32);
      buffer.writeUInt16LE(16, 34);
      buffer.write("data", 36);
      buffer.writeUInt32LE(n * 2, 40);
      for (let i = 0; i < n; i++)
        buffer.writeInt16LE(
          Math.round(800 * Math.sin((i * 2 * Math.PI * 440) / 48000)),
          44 + i * 2,
        );
      fs.writeFileSync("/tmp/spectrum-transparency-tone.wav", buffer);
      allowedFiles.set(
        "transparency-tone",
        "/tmp/spectrum-transparency-tone.wav",
      );
      const playback = await win.webContents.executeJavaScript(
        "window.verifyPlayback('spectrum-media://track/transparency-tone')",
      );
      const expected = await win.webContents.executeJavaScript(
        "window.sessionSnapshot()",
      );
      await changeWindowMode("normal");
      await new Promise((r) => setTimeout(r, 800));
      const restored = await win.webContents.executeJavaScript(
        "window.sessionSnapshot()",
      );
      const sessionPreserved =
        before.preferences.preset === after.preferences.preset &&
        before.demo === after.demo &&
        expected.preferences.preset === restored.preferences.preset &&
        expected.paused === restored.paused &&
        expected.playlist[0].url === restored.playlist[0].url &&
        Math.abs(expected.position - restored.position) < 0.15 &&
        before.preferences.gain === restored.preferences.gain;
      const report = {
        passed:
          opaque.passed &&
          transparent.passed &&
          sessionPreserved &&
          nativeAlpha.passed &&
          playback.passed &&
          errors.length === 0,
        opaque,
        transparent,
        nativeAlpha,
        playback,
        sessionPreserved,
        features: app.getGPUFeatureStatus(),
        errors,
      };
      fs.writeFileSync(
        path.join(__dirname, "transparency-validation.json"),
        JSON.stringify(report, null, 2),
      );
      console.log(
        JSON.stringify({
          passed: report.passed,
          opaque: opaque.passed,
          transparent: transparent.passed,
          nativeAlpha,
          sessionPreserved,
          errors,
        }),
      );
      app.exit(report.passed ? 0 : 1);
    } catch (error) {
      console.error(error);
      app.exit(1);
    }
    return;
  }
  if (verify) {
    try {
      await new Promise((r) => setTimeout(r, 2500));
      const result =
        await win.webContents.executeJavaScript("window.verifyAll()");
      const interactions = await win.webContents.executeJavaScript(
        "window.verifyInteractions()",
      );
      await win.webContents.executeJavaScript(
        "document.querySelector('#demo').click()",
      );
      await new Promise((r) => setTimeout(r, 500));
      fs.writeFileSync(
        path.join(__dirname, "preview.png"),
        (await win.webContents.capturePage()).toPNG(),
      );
      await win.webContents.executeJavaScript(
        "document.querySelector('#galleryButton').click()",
      );
      await new Promise((r) => setTimeout(r, 800));
      fs.writeFileSync(
        path.join(__dirname, "gallery.png"),
        (await win.webContents.capturePage()).toPNG(),
      );
      await win.webContents.executeJavaScript(
        "document.querySelector('#demo').click()",
      );
      await new Promise((r) => setTimeout(r, 500));
      await win.webContents.executeJavaScript("window.previewProcedural()");
      await new Promise((r) => setTimeout(r, 300));
      fs.writeFileSync(
        path.join(__dirname, "procedural.png"),
        (await win.webContents.capturePage()).toPNG(),
      );
      await win.webContents.executeJavaScript(
        "document.querySelector('#settingsButton').click()",
      );
      await new Promise((r) => setTimeout(r, 200));
      fs.writeFileSync(
        path.join(__dirname, "settings-preview.png"),
        (await win.webContents.capturePage()).toPNG(),
      );
      await win.webContents.executeJavaScript(
        "document.querySelector('#closeSettings').click();document.querySelector('#demo').click()",
      );
      await new Promise((r) => setTimeout(r, 300));
      // Play a quiet deterministic tone through the real desktop output to verify monitor capture.
      const n = 48000 * 2,
        buf = Buffer.alloc(44 + n * 2);
      buf.write("RIFF");
      buf.writeUInt32LE(36 + n * 2, 4);
      buf.write("WAVEfmt ", 8);
      buf.writeUInt32LE(16, 16);
      buf.writeUInt16LE(1, 20);
      buf.writeUInt16LE(1, 22);
      buf.writeUInt32LE(48000, 24);
      buf.writeUInt32LE(96000, 28);
      buf.writeUInt16LE(2, 32);
      buf.writeUInt16LE(16, 34);
      buf.write("data", 36);
      buf.writeUInt32LE(n * 2, 40);
      for (let i = 0; i < n; i++)
        buf.writeInt16LE(
          Math.round(800 * Math.sin((i * 2 * Math.PI * 440) / 48000)),
          44 + i * 2,
        );
      fs.writeFileSync("/tmp/open-spectrum-test.wav", buf);
      const before = packets;
      peak = 0;
      await exec("paplay", ["/tmp/open-spectrum-test.wav"]);
      await new Promise((r) => setTimeout(r, 400));
      allowedFiles.set("verification", "/tmp/open-spectrum-test.wav");
      const playback = await win.webContents.executeJavaScript(
        "window.verifyPlayback('spectrum-media://track/verification')",
      );
      const report = {
        ...result,
        interactions,
        playback,
        audio: {
          packets: packets - before,
          peak,
          passed: packets > before && peak > 0.001,
        },
        features: app.getGPUFeatureStatus(),
        gpu: await app.getGPUInfo("complete"),
        errors,
      };
      fs.writeFileSync(
        path.join(__dirname, "validation.json"),
        JSON.stringify(report, null, 2),
      );
      console.log(JSON.stringify(report));
      app.exit(
        report.audio.passed &&
          result.passed &&
          interactions.passed &&
          playback.passed &&
          errors.length === 0
          ? 0
          : 1,
      );
    } catch (e) {
      console.error(e);
      app.exit(1);
    }
  }
});
app.on("window-all-closed", () => app.quit());
app.on("before-quit", stop);

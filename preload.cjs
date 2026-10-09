const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("desktop", {
  windowSession: () => ipcRenderer.invoke("window-session"),
  windowMode: (mode) => ipcRenderer.invoke("window-mode", mode),
  close: () => ipcRenderer.invoke("close-window"),
  metadata: () => ipcRenderer.invoke("track-metadata"),
  localMetadata: (url) => ipcRenderer.invoke("local-metadata", url),
  exportPreset: (p) => ipcRenderer.invoke("preset-export", p),
  importPreset: () => ipcRenderer.invoke("preset-import"),
  sources: () => ipcRenderer.invoke("sources"),
  capture: (name) => ipcRenderer.invoke("capture", name),
  stop: () => ipcRenderer.invoke("stop"),
  music: () => ipcRenderer.invoke("music"),
  fullscreen: () => ipcRenderer.invoke("fullscreen"),
  diagnostics: () => ipcRenderer.invoke("diagnostics"),
  onFrame: (fn) => ipcRenderer.on("audio-frame", (_e, v) => fn(v)),
  onStatus: (fn) => ipcRenderer.on("audio-status", (_e, v) => fn(v)),
});

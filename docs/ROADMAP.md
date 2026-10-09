# Successor roadmap

The first working desktop application is preserved on `main`, tag `v0.1.0`.
Successor work begins on `next` as version `0.2.0`. Observations of Spectrum
inspired independent requirements; proposed improvements are not claims about
Spectrum's internal implementation.

## Implemented in the first upgrade

- 56 named presets across Waves, Geometry, Particles, Terrain, Ambient,
  Electronic, Retro, Minimalist, and Procedural collections. Configurable
  families generate multiple presets; these are not 56 independent engines.
- Original procedural cell, metaball, kaleidoscope and plasma shaders.
- Human-readable JSON presets, bounded import validation, custom saved presets,
  palette gradients, speed, audio deformation, and bloom tuning.
- Real time-domain waveforms, stereo downmix, overlapping FFT analysis with
  512-sample hops at 48kHz, separate attack/decay smoothing, bass/mid/treble,
  spectral-flux transient detection, and a decaying onset envelope.
- Fade-out/fade-in preset changes; automatic idle hiding and pointer reveal.
- Frame-rate limits and render-quality settings.
- Editable music queue, track shuffle, local title/artist metadata through
  ffprobe, and current desktop-player metadata through playerctl/MPRIS.
- An independently testable native RustFFT audio core with direct PipeWire
  capture through a pw-cat helper and a portable JSON feature-frame interface.

## Next native milestone

Prove a wgpu rendering surface on this NVIDIA/GNOME Wayland system before
committing to GTK integration. Keep GTK4/Libadwaita settings/gallery separate
from the renderer if embedding creates synchronization or frame-pacing issues.
The Rust component currently analyzes audio and does not yet create a window.
The usable desktop app remains Electron/Three.js during this migration.

## Remaining gaps

- Native GTK4/Libadwaita UI, wgpu renderer and direct PipeWire bindings.
- Independent stereo visual channels; current stereo input is downmixed.
- Adaptive sensitivity, robust tempo/beat-confidence estimation, and latency
  measurement. Onset detection is not a tempo tracker.
- Per-application capture, mixed routing and reliable audio hot-plug/recovery.
- Persistent playlists, folder import, media-library navigation and album art.
- Video recording/export with synchronized audio and user-selected output.
- Multiple visual windows, display selection, remembered window size, and
  configurable display-specific performance limits.
- GPU compute particle systems, trails, afterimages, adaptive GPU quality,
  and measured 4K/1440p performance targets.
- User shaders, plugin API and a stable effect-engine interface.
- Arch PKGBUILD, reproducible packaging, and AMD/Intel/X11/suspend testing.
- Wallpaper mode remains a later GNOME integration investigation.

Each milestone needs actual desktop validation. Targets such as 4K60 and
sub-50ms latency are goals to measure, not claims about current performance.

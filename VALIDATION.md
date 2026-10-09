# Desktop verification — successor

Verified on this computer on 2026-10-08:

- RTX 4090 through ANGLE / OpenGL ES 3.2; GPU compositing and WebGL enabled.
- 56 built-in presets in four color/background modes: 224 combinations, no
  WebGL errors. Includes the four new procedural shader families.
- Functional checks passed for gallery filtering, fade transitions, gradient
  selection, custom preset saving, queue reordering/removal, idle hiding and
  pointer reveal.
- Real PipeWire output-monitor capture and local WAV playback/analysis passed.
- Stereo PCM fragmentation/downmix/overlap, FFT frequency/RMS, silence,
  onset refractory behavior, frame-rate-independent smoothing and preset
  validation checks passed.
- Native RustFFT unit tests passed. Native PipeWire output capture produced
  300 feature frames and peak RMS 0.01733 from the quiet test tone.
- Screenshots were inspected for the gallery, procedural scene and settings.

A non-blocking Chromium Wayland/Vulkan startup notice remains. OpenGL renders
successfully and Vulkan is disabled in the feature report. Physical microphone,
live MPRIS metadata from every player, all codecs, long sessions, multiple GPUs,
4K benchmarks and suspend/hot-plug recovery have not been tested. Metadata
falls back cleanly when optional tools or player information are unavailable.

See validation.json and native-validation.json for reports. The original
baseline verification remains available at Git tag v0.1.0.

## 0.3.0 transparency checks

Solid and transparent rendering each passed 224 preset/color checks on RTX 4090.
Native window captures contain fully clear pixels (alpha 0) and opaque UI pixels
(alpha 255). Window recreation preserved visual settings, queue, local playback
position and pause state. The existing solid-window interaction/audio checks
passed again. See transparency-validation.json for detailed output.

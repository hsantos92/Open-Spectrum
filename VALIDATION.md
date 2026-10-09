# Desktop verification

Verified on this computer on 2026-10-08:

- NVIDIA RTX 4090 rendered through ANGLE / OpenGL ES 3.2.
- WebGL and GPU compositing enabled.
- All 24 presets in four palette modes: 96 combinations, no WebGL errors.
- Real PipeWire default-output monitor received 57 FFT frames during the test;
  measured peak RMS 0.01734 for the quiet two-second tone.
- Local WAV playback advanced to 0.448 seconds and returned a nonzero spectrum
  (frequency peak 196/255) through the app's own file loader and analyser.
- No renderer console errors.
- FFT, silence and PCM framing checks passed, as did syntax checks.
- Captured screenshots were inspected and gallery layout corrected.

A non-blocking Chromium Wayland/Vulkan startup notice remains. Rendering uses
OpenGL successfully; Vulkan is disabled in the feature report. Physical microphone
capture, every supported music codec, and long sessions have not been tested.

See validation.json for the full report. The gallery and preview PNGs were
captured from the actual Electron window. Demo motion is labeled in the preview.

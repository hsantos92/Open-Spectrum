# Independent implementation record

Inputs: user-supplied screenshots of Spectrum – Music Visualizer, the user's
pasted product-analysis study, and official documentation for general audio,
graphics, desktop and library APIs.

No Spectrum binaries were decompiled, no source or shaders were inspected, and
no Spectrum assets were extracted or bundled. All gallery previews are rendered
from Open Spectrum geometry/shaders. The icon and product identity are original.
The four observed color/background controls inspired corresponding capabilities;
shuffle checkmarks and several source controls were interpretations, not proven
original behavior. New controls have explicit Open Spectrum meanings.

The study proposed RustFFT, PipeWire, wgpu, GTK4/Libadwaita and GStreamer. The
current application uses Electron/Three.js while the native Rust analysis core
is developed separately. This is an implementation choice, not an inference
about the original program's architecture.

The project is MIT-licensed. Dependencies retain their own licenses.

Technical references:
- https://www.electronjs.org/docs/latest/tutorial/security
- https://docs.rs/rustfft/latest/rustfft/
- https://pipewire.pages.freedesktop.org/pipewire/page_man_pw-cat_1.html
- https://gstreamer.freedesktop.org/documentation/app/index.html

The transparent rendering/window pattern was informed by the user's independent
Neon-Orb and Neon-Face projects and Electron's window-style documentation. Those
references are unrelated to Spectrum's proprietary implementation.

# Open Spectrum

An independent MIT-licensed music visualizer for Arch Linux and GNOME Wayland.
Created from user-supplied screenshots and observable behavior, without reading
Spectrum's source code or copying its assets. This is an initial implementation,
not a complete reproduction of every effect in the reference application's large
gallery. Open Spectrum has its own name, artwork, layout, and 56 original presets.

## Launch

Search **Open Spectrum** in GNOME, or run:

```sh
~/.local/share/open-spectrum/launch.sh
```

From this source folder use `./launch.sh` or `npm start`.

## Features

- 56 animated 3D, line, particle, and procedural presets with rendered gallery thumbnails.
- Editable gradients, custom JSON presets, save/import/export, collections.
- Attack/decay, transient detection, true waveform display, stereo downmix.
- Idle control hiding, fade transitions, frame-rate limits, and queue editing.
- Four palettes: white on black, color on black, dark on light, color on light.
- Live system audio via PipeWire's PulseAudio compatibility layer (`pactl`, `parec`).
- Microphone and explicit device selection, including Easy Effects monitors.
- Local music queue with play/pause, previous/next, and automatic track advance.
- Sensitivity, render quality, shuffle interval and included-preset selection.
- Clock, song filename display, fullscreen and hidden controls.
- Persistent preferences and visible graphics diagnostics.
- GPU bloom on dark backgrounds. Rendering pauses when the window is hidden.

The app starts listening to the current default output monitor. Play music in any
app to animate it. If the output device changes, click **System** to reconnect.
Choose a specific Easy Effects or other output monitor under **Settings** if needed.
**Demo** generates motion and clearly labels it; it does not listen to audio.
Microphone input starts only when you choose **Mic** or a microphone source.
Music input accepts supported MP3, FLAC, WAV, OGG, Opus, AAC and M4A files;
actual format support depends on the bundled Electron decoder. Track information uses local title/artist metadata when ffprobe is available.
System playback uses MPRIS metadata when playerctl is available; otherwise the
app keeps working without song information.

## Shortcuts

F fullscreen; H hide/show controls; V gallery; arrows change visual;
Space play/pause local music; Escape close panels/show controls.

## Fresh setup

Install Node.js/npm and `libpulse` utilities, then run `npm ci` and `./launch.sh`.
Do not replace PipeWire with the PulseAudio daemon. `python3 install.py` installs
an independent app copy into `~/.local/share/open-spectrum` and a GNOME launcher.
The installer refuses to overwrite an existing installation.
Electron and Three.js are third-party dependencies with their own licenses.
No Spectrum application code or imagery is bundled.

## Verification

`npm test` checks FFT frequency/RMS behavior, silence, and fragmented PCM framing.
`npm run check` checks JavaScript syntax. `./launch.sh --verify` runs on the real
desktop, renders 224 preset/palette combinations and checks new UI interactions, records GPU diagnostics and
screenshots, and plays a quiet two-second tone to check real monitor capture.
Results are written to `validation.json`. Run verification with desktop/audio
session access. This does not automatically test a physical microphone.

## Remove installation

Remove `~/.local/share/open-spectrum` and
`~/.local/share/applications/open-spectrum.desktop`.
Preferences live in Electron's user data directory for Open Spectrum.

## Version branches

`main` and tag `v0.1.0` preserve the first version. `next` contains the initial
0.2.0 upgrade. Install it alongside the baseline with `python3 install.py --next`,
then search **Open Spectrum Next** in GNOME. Its launcher passes `--next` so it
uses independent preferences. The full native GTK/wgpu rewrite is still pending;
see [the roadmap](docs/ROADMAP.md) and [native audio workspace](native/README.md).

New desktop metadata uses optional `playerctl` and `ffprobe` tools. The Rust
workspace requires Cargo and `pw-cat` for native capture. The desktop application
works without building the native component.

## Transparent desktop overlay (0.3.0 preview)

Choose **Settings → Background → Transparent desktop overlay**. The preference
is remembered. Switch back to **Solid background** for the normal window.
The native window is recreated, preserving the selected preset, settings, source,
queue, current music position and paused state. A brief visual/audio restart can
occur while the replacement window initializes.

Use the **Launch Transparent** action on the GNOME launcher, or run
`npm run start:transparent` / `./launch.sh --transparent`. `./launch.sh --opaque`
forces a solid window if you need a fallback. Transparency retains glow and
clears empty pixels; white/black background palette choices become white/rainbow
foreground choices while the desktop remains visible.

In overlay mode, drag the small top strip or use GNOME's Super + drag gesture.
The **×** button closes the frameless window. Transparent pixels are not
click-through. Window placement and resizing depend on GNOME/Wayland; if resize
behaves poorly, size the solid window before switching to transparent.

`python3 install.py --preview` installs **Open Spectrum Preview** alongside the
existing apps, with independent preferences.

`./launch.sh --verify-transparency --opaque` tests the opaque/transparent alpha
output for all 224 preset/color combinations in each mode, captures a native
transparent window image, and tests round-trip session/music preservation.
See `transparency-validation.json`.

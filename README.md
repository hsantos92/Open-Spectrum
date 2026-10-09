# Open Spectrum

An independent MIT-licensed music visualizer for Arch Linux and GNOME Wayland.
Created from user-supplied screenshots and observable behavior, without reading
Spectrum's source code or copying its assets. This is an initial implementation,
not a complete reproduction of every effect in the reference application's large
gallery. Open Spectrum has its own name, artwork, layout, and 24 original presets.

## Launch

Search **Open Spectrum** in GNOME, or run:

```sh
~/.local/share/open-spectrum/launch.sh
```

From this source folder use `./launch.sh` or `npm start`.

## Features

- 24 animated 3D, line, and particle presets with rendered gallery thumbnails.
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
actual format support depends on the bundled Electron decoder. Track information
currently shows the filename rather than embedded album metadata.

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
desktop, renders 96 preset/palette combinations, records GPU diagnostics and
screenshots, and plays a quiet two-second tone to check real monitor capture.
Results are written to `validation.json`. Run verification with desktop/audio
session access. This does not automatically test a physical microphone.

## Remove installation

Remove `~/.local/share/open-spectrum` and
`~/.local/share/applications/open-spectrum.desktop`.
Preferences live in Electron's user data directory for Open Spectrum.

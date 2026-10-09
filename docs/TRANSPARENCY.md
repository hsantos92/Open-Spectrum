# Transparent background preview

The current 0.2.0 upgrade was merged in PR #1. Version 0.3.0 adds a persistent
Background option that switches between a solid window and a transparent,
frameless desktop overlay. Its implementation is informed by the user's
Neon-Orb/Neon-Face work and Electron's native window-style documentation.

Transparency requires three layers: an alpha-capable native window, transparent
HTML/canvas backgrounds, and alpha-preserving final GPU output. Bloom targets
can overwrite coverage, so a final shader derives coverage from light intensity
and retains the glow's color. Tiny near-black glow tails are cleared to avoid
unwanted background haze. The four gallery modes preserve white/rainbow
foreground choices; their solid background choices are replaced by the desktop.

Window recreation keeps visual preferences, the selected audio source, the
music queue, playback position and pause state. Device capture/player analysis
are reinitialized, so a brief restart can occur. The frame dimensions carry over,
but GNOME Wayland controls window placement. The small top strip supports dragging,
and the in-app close button replaces the native title bar.

Validation on the RTX 4090 includes 224 preset/color combinations in solid mode
and 224 in transparent mode, native window alpha values, and a round trip that
preserves local music queue/position/pause state. The normal desktop visual,
interaction and audio checks were rerun. Reports are in transparency-validation.json
and validation.json. Transparent resize and actual desktop placement remain user
interaction checks. The non-blocking Wayland/Vulkan startup notice remains;
rendering uses OpenGL.

Commands:
- `./launch.sh --transparent` opens the overlay directly.
- `./launch.sh --opaque` forces a solid window regardless of the saved choice.
- `./launch.sh --verify-transparency --opaque` runs the alpha/switching checks.
- `python3 install.py --preview` installs Open Spectrum Preview separately.

Transparent pixels are not click-through. If transparent resizing is unreliable,
resize the solid window first. See Electron's documented platform limitations:
https://www.electronjs.org/docs/latest/tutorial/custom-window-styles

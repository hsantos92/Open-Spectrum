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

## Expanded overlay and resize fix

F now maximizes/unmaximizes transparent windows instead of using native
fullscreen. This preserves compositing of the desktop; it fills the GNOME work
area rather than promising hidden panels. Solid windows retain native fullscreen.

The previous resize path called composer.setPixelRatio (which itself resizes)
and composer.setSize on every event. It also allowed high-DPI fullscreen buffers
to multiply in size across the bloom pipeline. The new path fixes the renderer
and composer pixel ratio at 1, computes bounded internal dimensions once, skips
unchanged sizes, consolidates resize events for 160ms, and pauses rendering while
those events settle. Balanced/High/Ultra allocation budgets are approximately
1080p/1440p/4K.

Two actual expanded/windowed round trips on GNOME retained native alpha 0–255
and reported approximately 59 FPS in both sizes. Each transition resized the
postprocessing buffers once. The test ran on the display GNOME selected (portrait
1080x1889 work area); pure allocation tests also cover 4K, 8K and ultrawide sizes.
This is not a measured 4K performance guarantee. See fullscreen-validation.json.

Measured transition frame gaps after the fix were 171–189ms, including the
intentional resize-event settling period. No multi-second stalls occurred in
the tested round trips. More demanding presets and other displays still need
user-side confirmation.

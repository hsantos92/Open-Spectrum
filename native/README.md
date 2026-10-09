# Native successor foundation

This workspace starts the Rust implementation proposed in the study. It is an
experimental audio core, separate from the current Electron application.

`spectrum-audio` uses RustFFT, a Hann window, stereo downmix, 2048-sample FFTs
with 512-sample hops (93.75 analysis updates/second), 96 log bands, RMS/peak,
bass/mid/treble, attack/decay smoothing, transient detection with a refractory
period, beat envelope, and waveform data. The detector estimates onsets; it does
not yet estimate tempo or claim reliable musical beat tracking.

```sh
cargo test --manifest-path native/Cargo.toml
cargo build --release --manifest-path native/Cargo.toml
native/target/release/spectrum-audio --capture "$(pactl get-default-sink)" --frames 100
```

The capture helper connects to native PipeWire through `pw-cat` and targets an
output node as a sink monitor. Input can alternatively be raw 48kHz stereo
float32 little-endian PCM on stdin. Output is one JSON feature frame per line.
No microphone is opened by the output-monitor command.

Next native milestones are a wgpu rendering surface proof on GNOME Wayland,
GTK4/Libadwaita controls, and direct PipeWire stream lifecycle/routing without
an external capture helper. The native component currently has no visual window
and is not the default desktop app.

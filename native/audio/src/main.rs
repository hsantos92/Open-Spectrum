use spectrum_audio::{Analyzer, FFT_SIZE, HOP, RATE};
use std::{
    collections::VecDeque,
    io::{self, BufWriter, Read, Write},
    process::{Command, Stdio},
};
fn process(mut input: impl Read, limit: Option<usize>) -> io::Result<()> {
    let mut analyzer = Analyzer::default();
    let mut samples = VecDeque::new();
    let mut stdout = BufWriter::new(io::stdout().lock());
    let mut stereo = [0_u8; 8];
    let mut frames = 0;
    while input.read_exact(&mut stereo).is_ok() {
        let l = f32::from_le_bytes(stereo[..4].try_into().unwrap());
        let r = f32::from_le_bytes(stereo[4..].try_into().unwrap());
        samples.push_back(if l.is_finite() && r.is_finite() {
            (l + r) * 0.5
        } else {
            0.
        });
        if samples.len() >= FFT_SIZE {
            let buffer: Vec<_> = samples.iter().copied().take(FFT_SIZE).collect();
            let f = analyzer.analyze(&buffer, HOP as f32 / RATE);
            let value = serde_json::json!({"bands":f.bands.to_vec(),"rms":f.rms,"peak":f.peak,"bass":f.bass,"mid":f.mid,"treble":f.treble,"onset":f.onset,"beat":f.beat_envelope,"waveform":f.waveform});
            writeln!(stdout, "{}", value)?;
            stdout.flush()?;
            samples.drain(..HOP);
            frames += 1;
            if limit.is_some_and(|max| frames >= max) {
                break;
            }
        }
    }
    Ok(())
}
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<_> = std::env::args().skip(1).collect();
    let limit = args
        .iter()
        .position(|a| a == "--frames")
        .and_then(|i| args.get(i + 1))
        .map(|v| v.parse())
        .transpose()?;
    if let Some(i) = args.iter().position(|a| a == "--capture") {
        let target = args
            .get(i + 1)
            .ok_or("--capture needs an output-node name")?;
        let mut child = Command::new("pw-cat")
            .args([
                "--record",
                "--raw",
                "--format",
                "f32",
                "--rate",
                "48000",
                "--channels",
                "2",
                "--latency",
                "20ms",
                "--target",
                target,
                "--properties",
                "{\"stream.capture.sink\":true}",
                "-",
            ])
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()?;
        let result = process(child.stdout.take().unwrap(), limit);
        let _ = child.kill();
        let _ = child.wait();
        result?;
    } else {
        process(io::stdin().lock(), limit)?;
    }
    Ok(())
}

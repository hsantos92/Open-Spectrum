use rustfft::{num_complex::Complex, Fft, FftPlanner};
use std::sync::Arc;

pub const FFT_SIZE: usize = 2048;
pub const HOP: usize = 512;
pub const BANDS: usize = 96;
pub const RATE: f32 = 48_000.;

#[derive(Debug)]
pub struct Features {
    pub bands: [f32; BANDS],
    pub rms: f32,
    pub peak: f32,
    pub bass: f32,
    pub mid: f32,
    pub treble: f32,
    pub onset: bool,
    pub beat_envelope: f32,
    pub waveform: Vec<f32>,
}

pub struct Analyzer {
    fft: Arc<dyn Fft<f32>>,
    scratch: Vec<Complex<f32>>,
    buffer: Vec<Complex<f32>>,
    window: Vec<f32>,
    previous: [f32; BANDS],
    smooth: [f32; BANDS],
    flux_mean: f32,
    flux_variance: f32,
    since_onset: f32,
    beat: f32,
}
impl Default for Analyzer {
    fn default() -> Self {
        let fft = FftPlanner::new().plan_fft_forward(FFT_SIZE);
        let scratch = vec![Complex::default(); fft.get_inplace_scratch_len()];
        Self {
            fft,
            scratch,
            buffer: vec![Complex::default(); FFT_SIZE],
            window: (0..FFT_SIZE)
                .map(|i| {
                    0.5 - 0.5 * (std::f32::consts::TAU * i as f32 / (FFT_SIZE - 1) as f32).cos()
                })
                .collect(),
            previous: [0.; BANDS],
            smooth: [0.; BANDS],
            flux_mean: 0.,
            flux_variance: 0.,
            since_onset: 1.,
            beat: 0.,
        }
    }
}
impl Analyzer {
    pub fn analyze(&mut self, samples: &[f32], dt: f32) -> Features {
        assert_eq!(samples.len(), FFT_SIZE);
        let dt = dt.clamp(0.001, 0.1);
        let mut sum = 0.;
        let mut peak: f32 = 0.;
        for (i, &sample) in samples.iter().enumerate() {
            let sample = if sample.is_finite() { sample } else { 0. };
            sum += sample * sample;
            peak = peak.max(sample.abs());
            self.buffer[i] = Complex::new(sample * self.window[i], 0.);
        }
        self.fft
            .process_with_scratch(&mut self.buffer, &mut self.scratch);
        let rms = (sum / FFT_SIZE as f32).sqrt();
        let mut flux = 0.;
        for b in 0..BANDS {
            let low = ((30. * 600_f32.powf(b as f32 / BANDS as f32) * FFT_SIZE as f32 / RATE)
                as usize)
                .max(1);
            let high = ((30.*600_f32.powf((b+1) as f32/BANDS as f32)*FFT_SIZE as f32/RATE).ceil() as usize).max(low+1).min(FFT_SIZE/2);
            let magnitude = self.buffer[low..high]
                .iter()
                .map(|v| v.norm() * 4. / FFT_SIZE as f32)
                .fold(0_f32, f32::max);
            let value = (magnitude * 40.).ln_1p() / 41_f32.ln();
            let value = value.clamp(0., 1.);
            flux += (value - self.previous[b]).max(0.);
            self.previous[b] = value;
            let tau = if value > self.smooth[b] { 0.035 } else { 0.22 };
            self.smooth[b] += (value - self.smooth[b]) * (1. - (-dt / tau).exp());
        }
        flux /= BANDS as f32;
        self.since_onset += dt;
        let onset = rms > 0.004
            && self.since_onset > 0.18
            && flux > self.flux_mean + 2. * self.flux_variance.sqrt() + 0.012;
        let delta = flux - self.flux_mean;
        let alpha = 1. - (-dt / 1.5).exp();
        self.flux_mean += delta * alpha;
        self.flux_variance += (delta * delta - self.flux_variance) * alpha;
        if onset {
            self.beat = 1.;
            self.since_onset = 0.;
        } else {
            self.beat *= (-dt / 0.16).exp();
        }
        let mean = |a, b| self.smooth[a..b].iter().sum::<f32>() / (b - a) as f32;
        Features {
            bands: self.smooth,
            rms,
            peak,
            bass: mean(0, 32),
            mid: mean(32, 73),
            treble: mean(73, 96),
            onset,
            beat_envelope: self.beat,
            waveform: (0..256).map(|i| samples[i * FFT_SIZE / 256]).collect(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn sine_frequency_and_rms() {
        let mut a = Analyzer::default();
        let wave: Vec<_> = (0..FFT_SIZE)
            .map(|i| 0.5 * (std::f32::consts::TAU * 440. * i as f32 / RATE).sin())
            .collect();
        let f = a.analyze(&wave, HOP as f32 / RATE);
        assert!((f.rms - 0.5 / 2_f32.sqrt()).abs() < 0.003);
        let index = f
            .bands
            .iter()
            .enumerate()
            .max_by(|a, b| a.1.total_cmp(b.1))
            .unwrap()
            .0;
        let hz = 30. * 600_f32.powf((index as f32 + 0.5) / BANDS as f32);
        assert!((hz - 440.).abs() < 45.);
    }
    #[test]
    fn silence_and_nonfinite_input_are_safe() {
        let mut a = Analyzer::default();
        let f = a.analyze(&vec![f32::NAN; FFT_SIZE], HOP as f32 / RATE);
        assert_eq!(f.rms, 0.);
        assert!(!f.onset);
        assert!(f.bands.iter().all(|x| *x == 0.));
    }
    #[test]
    fn transient_has_refractory_period() {
        let mut a = Analyzer::default();
        let noise: Vec<_> = (0..FFT_SIZE)
            .map(|i| ((i as f32 * 12.9898).sin() * 43758.5453).fract() * 0.7)
            .collect();
        let first = a.analyze(&noise, HOP as f32 / RATE);
        assert!(first.onset);
        a.analyze(&vec![0.; FFT_SIZE], HOP as f32 / RATE);
        assert!(!a.analyze(&noise, HOP as f32 / RATE).onset);
    }
}

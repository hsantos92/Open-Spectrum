// Shared musical features for system capture and the built-in player.
export class AudioFeatures {
  constructor() {
    this.previous = new Float32Array(96);
    this.smoothed = new Float32Array(96);
    this.fluxMean = 0;
    this.fluxVariance = 0;
    this.lastOnset = -Infinity;
    this.beat = 0;
    this.previousTime = null;
  }
  update(frame, time, attack = 0.035, release = 0.22) {
    const dt =
      this.previousTime === null
        ? 1 / 60
        : Math.min(0.1, Math.max(0.001, time - this.previousTime));
    this.previousTime = time;
    let flux = 0;
    for (let i = 0; i < 96; i++) {
      const target = Math.max(0, Math.min(1, Number(frame.bins[i]) || 0));
      flux += Math.max(0, target - this.previous[i]);
      this.previous[i] = target;
      const tau = target > this.smoothed[i] ? attack : release;
      this.smoothed[i] +=
        (target - this.smoothed[i]) * (1 - Math.exp(-dt / tau));
    }
    flux /= 96;
    const threshold = this.fluxMean + 2 * Math.sqrt(this.fluxVariance) + 0.012;
    const onset =
      flux > threshold && frame.rms > 0.004 && time - this.lastOnset > 0.18;
    const alpha = 1 - Math.exp(-dt / 1.5),
      difference = flux - this.fluxMean;
    this.fluxMean += alpha * difference;
    this.fluxVariance += (difference * difference - this.fluxVariance) * alpha;
    if (onset) {
      this.lastOnset = time;
      this.beat = 1;
    } else this.beat *= Math.exp(-dt / 0.16);
    const mean = (from, to) => {
      let sum = 0;
      for (let i = from; i < to; i++) sum += this.smoothed[i];
      return sum / (to - from);
    };
    return {
      bins: this.smoothed,
      rms: Math.max(0, Number(frame.rms) || 0),
      bass: mean(0, 32),
      mid: mean(32, 73),
      treble: mean(73, 96),
      onset,
      beat: this.beat,
      waveform: frame.waveform || [],
    };
  }
}

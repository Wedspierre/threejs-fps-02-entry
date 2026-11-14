// Synthesised sound: every effect is an oscillator or a burst of filtered noise through
// the Web Audio API, so the game ships no audio files and makes no network request. The
// context is created lazily on the first call after a user gesture; every call guards for a
// missing or suspended context, so headless captures stay silent instead of throwing.
let ctx = null;
let noiseBuf = null;

function audio() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext ?? window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const length = Math.floor(ctx.sampleRate * 0.5);
    noiseBuf = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  } catch {
    return null;
  }
  return ctx;
}

function burst(ac, { duration, frequency, type = 'lowpass', gain = 0.5, sweepTo = null }) {
  const source = ac.createBufferSource();
  source.buffer = noiseBuf;
  source.loop = true;
  const filter = ac.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(frequency, ac.currentTime);
  if (sweepTo !== null) filter.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), ac.currentTime + duration);
  const amp = ac.createGain();
  amp.gain.setValueAtTime(gain, ac.currentTime);
  amp.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
  source.connect(filter).connect(amp).connect(ac.destination);
  source.start();
  source.stop(ac.currentTime + duration + 0.02);
}

function tone(ac, { frequency, duration, type = 'sine', gain = 0.2, slideTo = null, delay = 0 }) {
  const start = ac.currentTime + delay;
  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), start + duration);
  const amp = ac.createGain();
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(amp).connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export const sfx = {
  shot(kind) {
    const ac = audio();
    if (!ac || ac.state !== 'running') return;
    if (kind === 'dmr') burst(ac, { duration: 0.22, frequency: 2400, gain: 0.6, sweepTo: 180 });
    else if (kind === 'smg') burst(ac, { duration: 0.09, frequency: 3200, gain: 0.4, sweepTo: 500 });
    else if (kind === 'pistol') burst(ac, { duration: 0.12, frequency: 2800, gain: 0.45, sweepTo: 300 });
    else burst(ac, { duration: 0.14, frequency: 2600, gain: 0.55, sweepTo: 220 });
    tone(ac, { frequency: 160, duration: 0.08, type: 'square', gain: 0.12, slideTo: 60 });
  },
  dryClick() {
    const ac = audio();
    if (!ac || ac.state !== 'running') return;
    tone(ac, { frequency: 1400, duration: 0.04, type: 'square', gain: 0.08 });
  },
  reload() {
    const ac = audio();
    if (!ac || ac.state !== 'running') return;
    tone(ac, { frequency: 700, duration: 0.05, type: 'square', gain: 0.08 });
    tone(ac, { frequency: 500, duration: 0.05, type: 'square', gain: 0.08, delay: 0.18 });
    tone(ac, { frequency: 900, duration: 0.06, type: 'square', gain: 0.1, delay: 0.4 });
  },
  hit() {
    const ac = audio();
    if (!ac || ac.state !== 'running') return;
    tone(ac, { frequency: 1900, duration: 0.05, type: 'sine', gain: 0.15 });
  },
  kill() {
    const ac = audio();
    if (!ac || ac.state !== 'running') return;
    tone(ac, { frequency: 1900, duration: 0.05, type: 'sine', gain: 0.15 });
    tone(ac, { frequency: 2600, duration: 0.07, type: 'sine', gain: 0.15, delay: 0.06 });
  },
  hurt() {
    const ac = audio();
    if (!ac || ac.state !== 'running') return;
    burst(ac, { duration: 0.18, frequency: 500, gain: 0.35, sweepTo: 120 });
  },
  explosion() {
    const ac = audio();
    if (!ac || ac.state !== 'running') return;
    burst(ac, { duration: 1.1, frequency: 900, gain: 0.9, sweepTo: 60 });
    tone(ac, { frequency: 70, duration: 0.9, type: 'sine', gain: 0.5, slideTo: 28 });
  },
  beep(high) {
    const ac = audio();
    if (!ac || ac.state !== 'running') return;
    tone(ac, { frequency: high ? 1560 : 980, duration: 0.09, type: 'square', gain: 0.09 });
  },
  plant() {
    const ac = audio();
    if (!ac || ac.state !== 'running') return;
    tone(ac, { frequency: 620, duration: 0.12, type: 'square', gain: 0.12 });
    tone(ac, { frequency: 930, duration: 0.14, type: 'square', gain: 0.12, delay: 0.12 });
  },
  roundWin() {
    const ac = audio();
    if (!ac || ac.state !== 'running') return;
    tone(ac, { frequency: 523, duration: 0.16, type: 'triangle', gain: 0.18 });
    tone(ac, { frequency: 659, duration: 0.16, type: 'triangle', gain: 0.18, delay: 0.14 });
    tone(ac, { frequency: 784, duration: 0.28, type: 'triangle', gain: 0.2, delay: 0.28 });
  },
  roundLose() {
    const ac = audio();
    if (!ac || ac.state !== 'running') return;
    tone(ac, { frequency: 392, duration: 0.2, type: 'triangle', gain: 0.16 });
    tone(ac, { frequency: 311, duration: 0.3, type: 'triangle', gain: 0.16, delay: 0.18 });
  },
};

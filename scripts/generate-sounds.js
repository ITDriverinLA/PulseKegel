const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const SOUNDS_DIR = path.join(__dirname, '..', 'client', 'assets', 'sounds');

function createWavBuffer(samples, sampleRate = SAMPLE_RATE) {
  const numSamples = samples.length;
  const byteRate = sampleRate * 2;
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const val = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(val * 32767), 44 + i * 2);
  }

  return buffer;
}

function sine(freq, t) {
  return Math.sin(2 * Math.PI * freq * t);
}

function envelope(t, attack, sustain, release, totalDuration) {
  if (t < attack) return t / attack;
  if (t < attack + sustain) return 1;
  const releaseStart = attack + sustain;
  if (t < releaseStart + release) return 1 - (t - releaseStart) / release;
  return 0;
}

function fadeEnv(t, duration, fadeIn = 0.01, fadeOut = 0.05) {
  if (t < fadeIn) return t / fadeIn;
  if (t > duration - fadeOut) return (duration - t) / fadeOut;
  return 1;
}

function generateSqueezeStart() {
  const duration = 0.35;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float64Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const freq = 440 + (t / duration) * 220;
    const env = envelope(t, 0.02, 0.15, 0.18, duration);
    samples[i] = sine(freq, t) * env * 0.5 + sine(freq * 2, t) * env * 0.15;
  }
  return createWavBuffer(samples);
}

function generateRestStart() {
  const duration = 0.4;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float64Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const freq = 520 - (t / duration) * 180;
    const env = envelope(t, 0.03, 0.15, 0.22, duration);
    samples[i] = sine(freq, t) * env * 0.4 + sine(freq * 0.5, t) * env * 0.1;
  }
  return createWavBuffer(samples);
}

function generateBreatheStart() {
  const duration = 0.6;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float64Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const env = envelope(t, 0.05, 0.1, 0.45, duration);
    samples[i] = (sine(523.25, t) * 0.3 + sine(659.25, t) * 0.2 + sine(783.99, t) * 0.15) * env;
  }
  return createWavBuffer(samples);
}

function generateCountdownBeep() {
  const duration = 0.12;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float64Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const env = envelope(t, 0.005, 0.04, 0.075, duration);
    samples[i] = sine(880, t) * env * 0.45;
  }
  return createWavBuffer(samples);
}

function generateWorkoutComplete() {
  const duration = 1.2;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float64Array(numSamples);
  const notes = [523.25, 659.25, 783.99, 1046.5];
  const noteGap = 0.2;
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    let val = 0;
    for (let n = 0; n < notes.length; n++) {
      const noteStart = n * noteGap;
      const noteT = t - noteStart;
      if (noteT >= 0) {
        const noteDur = duration - noteStart;
        const env = envelope(noteT, 0.02, 0.08, noteDur - 0.1, noteDur);
        val += sine(notes[n], t) * env * 0.25;
      }
    }
    samples[i] = val;
  }
  return createWavBuffer(samples);
}

function generateBadgeEarned() {
  const duration = 1.0;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float64Array(numSamples);
  const notes = [587.33, 739.99, 880, 1174.66];
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    let val = 0;
    for (let n = 0; n < notes.length; n++) {
      const noteStart = n * 0.12;
      const noteT = t - noteStart;
      if (noteT >= 0) {
        const noteDur = duration - noteStart;
        const env = envelope(noteT, 0.01, 0.1, noteDur - 0.11, noteDur);
        val += sine(notes[n], t) * env * 0.2;
        val += sine(notes[n] * 2, t) * env * 0.08;
      }
    }
    samples[i] = val;
  }
  return createWavBuffer(samples);
}

function generateAmbientCalm() {
  const duration = 8.0;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float64Array(numSamples);
  const baseFreqs = [130.81, 196, 261.63, 329.63];
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    let val = 0;
    const fade = fadeEnv(t, duration, 0.5, 0.5);
    for (const freq of baseFreqs) {
      const wobble = 1 + Math.sin(2 * Math.PI * 0.15 * t + freq) * 0.003;
      val += sine(freq * wobble, t) * 0.08;
    }
    val += sine(196 * (1 + Math.sin(2 * Math.PI * 0.08 * t) * 0.005), t) * 0.06;
    samples[i] = val * fade;
  }
  return createWavBuffer(samples);
}

function generateAmbientFocused() {
  const duration = 8.0;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float64Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const fade = fadeEnv(t, duration, 0.5, 0.5);
    const pulse = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.5 * t);
    let val = 0;
    val += sine(220, t) * 0.1 * pulse;
    val += sine(330, t) * 0.06 * (1 - pulse);
    val += sine(440, t) * 0.04 * pulse;
    val += sine(110, t) * 0.08;
    samples[i] = val * fade;
  }
  return createWavBuffer(samples);
}

if (!fs.existsSync(SOUNDS_DIR)) {
  fs.mkdirSync(SOUNDS_DIR, { recursive: true });
}

const sounds = {
  'squeeze_start.wav': generateSqueezeStart,
  'rest_start.wav': generateRestStart,
  'breathe_start.wav': generateBreatheStart,
  'countdown_beep.wav': generateCountdownBeep,
  'workout_complete.wav': generateWorkoutComplete,
  'badge_earned.wav': generateBadgeEarned,
  'ambient_calm.wav': generateAmbientCalm,
  'ambient_focused.wav': generateAmbientFocused,
};

for (const [filename, generator] of Object.entries(sounds)) {
  const buffer = generator();
  const filepath = path.join(SOUNDS_DIR, filename);
  fs.writeFileSync(filepath, buffer);
  console.log(`Generated ${filename} (${buffer.length} bytes)`);
}

console.log('All sounds generated successfully!');

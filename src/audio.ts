/**
 * 8-bit procedural audio engine using Web Audio API.
 * Generates chiptune background music and sound effects.
 */

let audioCtx: AudioContext | null = null;
let musicGain: GainNode | null = null;
let musicPlaying = false;
let musicTimeouts: number[] = [];

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Note frequencies for chiptune music
const NOTES: Record<string, number> = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61,
  G3: 196.00, A3: 220.00, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23,
  G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.26, F5: 698.46,
  G5: 783.99, A5: 880.00, B5: 987.77,
  C6: 1046.50,
};

// --- Sound Effects ---

export function playPaddleBounce() {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.08);

  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.12);
}

export function playBrickExplosion() {
  const ctx = getCtx();

  // Noise burst
  const bufferSize = ctx.sampleRate * 0.15;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.1, ctx.currentTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

  // Pitched sweep down
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.2);

  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.12, ctx.currentTime);
  oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

  noise.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  osc.connect(oscGain);
  oscGain.connect(ctx.destination);

  noise.start(ctx.currentTime);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.2);
}

export function playWallBounce() {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(300, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.05);

  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.06);
}

export function playLoseLife() {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(400, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.5);

  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.5);
}

export function playGameOver() {
  const ctx = getCtx();
  const notes = [400, 350, 300, 200];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    const t = ctx.currentTime + i * 0.2;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  });
}

export function playWin() {
  const ctx = getCtx();
  const notes = [523, 659, 784, 1047, 784, 1047];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    const t = ctx.currentTime + i * 0.12;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.15);
  });
}

// --- 8-bit Background Music ---

// 16-bar chiptune loop: melody + bass + arpeggios
const MELODY: (string | null)[] = [
  // === Section A: Main theme (bars 1-4) ===
  // Bar 1 - Iconic opening phrase
  'E5', 'E5', null, 'E5', null, 'C5', 'E5', null,
  'G5', null, null, null, 'G4', null, null, null,
  // Bar 2 - Answer phrase
  'C5', null, null, 'G4', null, null, 'E4', null,
  null, 'A4', null, 'B4', null, 'A4', 'A4', null,
  // Bar 3 - Rising action
  'G4', 'E5', 'G5', 'A5', null, 'F5', 'G5', null,
  'E5', null, 'C5', 'D5', 'B4', null, null, null,
  // Bar 4 - Resolution
  'C5', null, null, 'G4', null, null, 'E4', null,
  null, 'A4', null, 'B4', null, 'A4', 'A4', null,

  // === Section B: Development (bars 5-8) ===
  // Bar 5 - New melody, higher energy
  'D5', null, 'D5', null, 'D5', null, 'C5', 'D5',
  'E5', null, 'C5', null, 'A4', null, null, null,
  // Bar 6 - Call and response
  'D5', null, 'D5', null, 'D5', null, 'C5', 'D5',
  'E5', null, null, null, null, null, null, null,
  // Bar 7 - Tension build
  'E5', null, 'D5', null, 'C5', null, 'D5', null,
  'E5', null, 'G5', null, 'A5', null, 'G5', null,
  // Bar 8 - Release
  'E5', null, 'C5', null, 'D5', null, 'B4', null,
  'C5', null, null, null, null, null, null, null,

  // === Section A': Main theme variation (bars 9-12) ===
  // Bar 9 - Theme returns with embellishment
  'E5', 'E5', null, 'E5', null, 'C5', 'E5', null,
  'G5', null, 'A5', null, 'G5', null, null, null,
  // Bar 10 - Variation answer
  'C5', null, 'D5', 'E5', null, null, 'D5', null,
  'C5', null, 'A4', null, 'B4', null, null, null,
  // Bar 11 - Climax phrase
  'A5', null, 'G5', null, 'E5', null, 'G5', null,
  'A5', null, 'B5', null, 'A5', null, 'G5', null,
  // Bar 12 - Dramatic pause
  'E5', null, null, null, 'C5', null, null, null,
  null, null, null, null, null, null, null, null,

  // === Section C: Bridge / Breakdown (bars 13-16) ===
  // Bar 13 - Rhythmic stabs
  'C5', 'E5', null, null, 'G5', null, null, null,
  'C5', 'E5', null, null, 'A5', null, null, null,
  // Bar 14 - Ascending run
  'C5', null, 'D5', null, 'E5', null, 'F5', null,
  'G5', null, 'A5', null, 'B5', null, 'C6', null,
  // Bar 15 - Descending cascade
  'B5', null, 'A5', null, 'G5', null, 'F5', null,
  'E5', null, 'D5', null, 'C5', null, 'B4', null,
  // Bar 16 - Turnaround (leads back to bar 1)
  'C5', null, 'E5', null, 'G4', null, 'C5', null,
  'E5', null, null, 'D5', null, 'C5', 'B4', null,
];

const BASS: (string | null)[] = [
  // === Section A (bars 1-4) ===
  'C3', null, null, null, 'G3', null, null, null,
  'C3', null, null, null, 'G3', null, null, null,
  'C3', null, null, null, 'E3', null, null, null,
  'A3', null, null, null, 'B3', null, null, null,
  'C3', null, null, null, 'G3', null, null, null,
  'C3', null, null, null, 'G3', null, null, null,
  'C3', null, null, null, 'E3', null, null, null,
  'A3', null, null, null, 'B3', null, null, null,

  // === Section B (bars 5-8) ===
  'F3', null, null, null, 'C3', null, null, null,
  'F3', null, null, null, 'C3', null, null, null,
  'F3', null, null, null, 'C3', null, null, null,
  'F3', null, null, null, 'G3', null, null, null,
  'A3', null, null, null, 'E3', null, null, null,
  'A3', null, null, null, 'E3', null, null, null,
  'F3', null, null, null, 'G3', null, null, null,
  'C3', null, null, null, null, null, null, null,

  // === Section A' (bars 9-12) ===
  'C3', null, null, null, 'G3', null, null, null,
  'C3', null, null, null, 'G3', null, null, null,
  'C3', null, null, null, 'E3', null, null, null,
  'A3', null, null, null, 'B3', null, null, null,
  'A3', null, null, null, 'E3', null, null, null,
  'F3', null, null, null, 'G3', null, null, null,
  'C3', null, null, null, 'E3', null, null, null,
  null, null, null, null, null, null, null, null,

  // === Section C: Bridge (bars 13-16) ===
  'C3', null, 'C3', null, 'E3', null, 'E3', null,
  'C3', null, 'C3', null, 'A3', null, 'A3', null,
  'F3', null, null, null, 'G3', null, null, null,
  'A3', null, null, null, 'B3', null, null, null,
  'G3', null, null, null, 'F3', null, null, null,
  'E3', null, null, null, 'D3', null, null, null,
  'C3', null, 'E3', null, 'G3', null, 'C3', null,
  'E3', null, null, 'D3', null, 'C3', 'B3', null,
];

// Arpeggio channel for extra shimmer
const ARP: (string | null)[] = [
  // Section A (bars 1-4) - gentle arpeggios
  'C4', 'E4', 'G4', 'E4', 'C4', 'E4', 'G4', 'E4',
  'C4', 'E4', 'G4', 'E4', 'B3', 'D4', 'G4', 'D4',
  'C4', 'E4', 'G4', 'E4', 'C4', 'E4', 'G4', 'E4',
  'A3', 'C4', 'E4', 'C4', 'B3', 'D4', 'G4', 'D4',
  'C4', 'E4', 'G4', 'E4', 'C4', 'E4', 'G4', 'E4',
  'C4', 'E4', 'G4', 'E4', 'B3', 'D4', 'G4', 'D4',
  'C4', 'E4', 'G4', 'E4', 'C4', 'E4', 'G4', 'E4',
  'A3', 'C4', 'E4', 'C4', 'B3', 'D4', 'G4', 'D4',

  // Section B (bars 5-8) - different chord tones
  'F4', 'A4', 'C5', 'A4', 'F4', 'A4', 'C5', 'A4',
  'F4', 'A4', 'C5', 'A4', 'E4', 'G4', 'C5', 'G4',
  'F4', 'A4', 'C5', 'A4', 'F4', 'A4', 'C5', 'A4',
  'F4', 'A4', 'C5', 'A4', 'G4', 'B4', 'D5', 'B4',
  'A4', 'C5', 'E5', 'C5', 'A4', 'C5', 'E5', 'C5',
  'A4', 'C5', 'E5', 'C5', 'G4', 'B4', 'E5', 'B4',
  'F4', 'A4', 'C5', 'A4', 'G4', 'B4', 'D5', 'B4',
  'C4', 'E4', 'G4', 'E4', null, null, null, null,

  // Section A' (bars 9-12) - embellished arpeggios
  'C4', 'G4', 'E4', 'G4', 'C4', 'G4', 'E4', 'G4',
  'C4', 'G4', 'E4', 'G4', 'B3', 'G4', 'D4', 'G4',
  'C4', 'G4', 'E4', 'G4', 'C4', 'G4', 'E4', 'G4',
  'A3', 'E4', 'C4', 'E4', 'B3', 'G4', 'D4', 'G4',
  'A3', 'E4', 'C4', 'E4', 'A3', 'E4', 'C4', 'E4',
  'F4', 'A4', 'C5', 'A4', 'G4', 'B4', 'D5', 'B4',
  'C4', 'E4', 'G4', 'E4', 'C4', 'E4', 'G4', 'E4',
  null, null, null, null, null, null, null, null,

  // Section C (bars 13-16) - rhythmic pulse
  'C4', null, 'E4', null, 'G4', null, 'E4', null,
  'C4', null, 'E4', null, 'A4', null, 'E4', null,
  null, null, null, null, null, null, null, null,
  null, null, null, null, null, null, null, null,
  null, null, null, null, null, null, null, null,
  null, null, null, null, null, null, null, null,
  'C4', null, 'E4', null, 'G4', null, 'C4', null,
  'E4', null, null, null, null, null, null, null,
];

function playNote(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  time: number,
  duration: number,
  type: OscillatorType,
  volume: number,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, time);
  gain.gain.setValueAtTime(volume, time);
  gain.gain.setValueAtTime(volume, time + duration * 0.7);
  gain.gain.linearRampToValueAtTime(0, time + duration);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(time);
  osc.stop(time + duration);
}

function scheduleLoop() {
  const ctx = getCtx();
  if (!musicGain) return;

  const BPM = 160;
  const stepDuration = 60 / BPM / 2; // 16th notes
  const startTime = ctx.currentTime + 0.05;

  for (let i = 0; i < MELODY.length; i++) {
    const t = startTime + i * stepDuration;
    const melodyNote = MELODY[i];
    const bassNote = BASS[i];

    if (melodyNote && NOTES[melodyNote]) {
      playNote(ctx, musicGain!, NOTES[melodyNote], t, stepDuration * 0.8, 'square', 0.07);
    }
    if (bassNote && NOTES[bassNote]) {
      playNote(ctx, musicGain!, NOTES[bassNote], t, stepDuration * 0.9, 'triangle', 0.06);
    }
    const arpNote = ARP[i];
    if (arpNote && NOTES[arpNote]) {
      playNote(ctx, musicGain!, NOTES[arpNote], t, stepDuration * 0.5, 'square', 0.03);
    }
  }

  const loopDuration = MELODY.length * stepDuration;
  const timeoutId = window.setTimeout(() => {
    if (musicPlaying) scheduleLoop();
  }, loopDuration * 1000 - 100);
  musicTimeouts.push(timeoutId);
}

export function startMusic() {
  if (musicPlaying) return;
  const ctx = getCtx();
  musicGain = ctx.createGain();
  musicGain.gain.setValueAtTime(0.8, ctx.currentTime);
  musicGain.connect(ctx.destination);
  musicPlaying = true;
  scheduleLoop();
}

export function stopMusic() {
  musicPlaying = false;
  musicTimeouts.forEach(clearTimeout);
  musicTimeouts = [];
  if (musicGain) {
    musicGain.gain.linearRampToValueAtTime(0, getCtx().currentTime + 0.1);
    musicGain = null;
  }
}

export function initAudio() {
  getCtx();
}

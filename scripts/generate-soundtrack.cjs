const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');

const sampleRate = 44100;
const chordProgressions = [
  // 1. Eadd9 / Esus2
  {
    bass: 82.41,
    pad: [164.81, 246.94, 293.66, 329.63, 415.30, 493.88],
    filterBase: 650,
    filterPeak: 1750,
    melody: [
      { f: 493.88, delay: 1.8, pan: -0.25 },
      { f: 739.99, delay: 3.1, pan: 0.3 },
      { f: 830.61, delay: 4.3, pan: -0.15 },
      { f: 659.25, delay: 5.5, pan: 0.2 },
    ],
  },
  // 2. Amaj9#11
  {
    bass: 110.00,
    pad: [164.81, 207.65, 246.94, 311.13, 329.63, 415.30],
    filterBase: 700,
    filterPeak: 2100,
    melody: [
      { f: 659.25, delay: 1.7, pan: 0.25 },
      { f: 987.77, delay: 2.9, pan: -0.3 },
      { f: 1244.51, delay: 4.1, pan: 0.35 },
      { f: 830.61, delay: 5.2, pan: -0.2 },
    ],
  },
  // 3. C#m7(add11) / Bsus
  {
    bass: 65.41,
    pad: [123.47, 164.81, 246.94, 277.18, 369.99, 415.30],
    filterBase: 600,
    filterPeak: 1650,
    melody: [
      { f: 739.99, delay: 1.9, pan: -0.3 },
      { f: 830.61, delay: 3.1, pan: 0.25 },
      { f: 622.25, delay: 4.4, pan: -0.1 },
    ],
  },
  // 4. F#7sus4(add9)
  {
    bass: 92.50,
    pad: [138.59, 164.81, 207.65, 277.18, 329.63, 369.99],
    filterBase: 750,
    filterPeak: 1950,
    melody: [
      { f: 554.37, delay: 1.8, pan: 0.2 },
      { f: 659.25, delay: 3.0, pan: -0.25 },
      { f: 830.61, delay: 4.2, pan: 0.3 },
      { f: 987.77, delay: 5.3, pan: -0.1 },
    ],
  },
  // 5. Dmaj7#11
  {
    bass: 73.42,
    pad: [146.83, 207.65, 277.18, 293.66, 329.63, 440.00],
    filterBase: 800,
    filterPeak: 2200,
    melody: [
      { f: 830.61, delay: 1.7, pan: -0.2 },
      { f: 659.25, delay: 2.9, pan: 0.3 },
      { f: 739.99, delay: 4.1, pan: -0.3 },
      { f: 987.77, delay: 5.3, pan: 0.25 },
    ],
  },
  // 6. Badd9(sus4)
  {
    bass: 61.74,
    pad: [123.47, 164.81, 185.00, 246.94, 277.18, 369.99],
    filterBase: 650,
    filterPeak: 1700,
    melody: [
      { f: 739.99, delay: 1.8, pan: 0.2 },
      { f: 659.25, delay: 3.0, pan: -0.2 },
      { f: 493.88, delay: 4.2, pan: 0.15 },
      { f: 369.99, delay: 5.4, pan: -0.25 },
    ],
  },
];

const chordInterval = 6.0;
const chordDuration = 8.4;
const totalCycles = 3; // 3 full cycles = 18 chords = 108s + reverb tail = 118s (~2 minutes)
const totalChords = totalCycles * chordProgressions.length;
const totalDuration = totalChords * chordInterval + 10.0;
const totalSamples = Math.ceil(totalDuration * sampleRate);

console.log(`Generating soundtrack: ${totalDuration.toFixed(1)}s (${totalSamples} samples at ${sampleRate}Hz)...`);

const leftBuffer = new Float32Array(totalSamples);
const rightBuffer = new Float32Array(totalSamples);

// Helper oscillator functions
function sine(phase) {
  return Math.sin(phase);
}

function triangle(phase) {
  // normalized between -1 and 1
  const p = (phase / (2 * Math.PI)) % 1;
  const val = p < 0 ? p + 1 : p;
  return 4 * Math.abs(val - 0.5) - 1;
}

// 1. Synthesize chords and melody
for (let c = 0; c < totalChords; c++) {
  const section = chordProgressions[c % chordProgressions.length];
  const chordStartSec = c * chordInterval;
  const startSample = Math.floor(chordStartSec * sampleRate);
  const chordSampleCount = Math.floor(chordDuration * sampleRate);

  // Sub bass: pure warm sine wave
  const bassFreq = section.bass;
  for (let i = 0; i < chordSampleCount; i++) {
    const sIdx = startSample + i;
    if (sIdx >= totalSamples) break;
    const t = i / sampleRate;

    // envelope: attack 2.0s, sustain, decay after (duration - 2.4s)
    let env = 0;
    if (t < 2.0) {
      env = (t / 2.0) * 0.14;
    } else if (t < chordDuration - 2.4) {
      env = 0.14;
    } else {
      const relT = (t - (chordDuration - 2.4)) / 2.4;
      env = 0.14 * Math.max(0, 1 - relT);
    }

    const val = sine(2 * Math.PI * bassFreq * t) * env;
    leftBuffer[sIdx] += val;
    rightBuffer[sIdx] += val;
  }

  // Pad voices: layered polyphony with micro-detuning & stereo spread
  section.pad.forEach((freq, idx) => {
    const isOdd = idx % 2 === 1;
    const detuneCents = (idx - section.pad.length / 2) * 5.0; // detune in cents
    const actualFreq = freq * Math.pow(2, detuneCents / 1200);
    // pan slightly spread
    const voicePan = ((idx / (section.pad.length - 1)) - 0.5) * 0.7; // -0.35 to +0.35
    const leftGain = Math.cos((voicePan + 1) * Math.PI / 4);
    const rightGain = Math.sin((voicePan + 1) * Math.PI / 4);

    for (let i = 0; i < chordSampleCount; i++) {
      const sIdx = startSample + i;
      if (sIdx >= totalSamples) break;
      const t = i / sampleRate;

      // pad envelope: attack 2.2s, sustain, smooth decay
      let env = 0;
      if (t < 2.2) {
        env = (t / 2.2) * 0.055;
      } else if (t < chordDuration - 2.4) {
        env = 0.055;
      } else {
        const relT = (t - (chordDuration - 2.4)) / 2.4;
        env = 0.055 * Math.max(0, 1 - relT);
      }

      // Filter simulation: slightly soften high frequencies
      const wave = isOdd
        ? triangle(2 * Math.PI * actualFreq * t)
        : sine(2 * Math.PI * actualFreq * t);

      const amp = wave * env;
      leftBuffer[sIdx] += amp * leftGain;
      rightBuffer[sIdx] += amp * rightGain;
    }
  });

  // Melody notes: sparkling crystal bells
  section.melody.forEach((note) => {
    const noteStartSec = chordStartSec + note.delay;
    const noteStartSample = Math.floor(noteStartSec * sampleRate);
    const noteDuration = 2.4;
    const noteSampleCount = Math.floor(noteDuration * sampleRate);
    const pan = note.pan; // -1 to 1
    const leftGain = Math.cos((pan + 1) * Math.PI / 4);
    const rightGain = Math.sin((pan + 1) * Math.PI / 4);

    for (let i = 0; i < noteSampleCount; i++) {
      const sIdx = noteStartSample + i;
      if (sIdx >= totalSamples) break;
      const t = i / sampleRate;

      // Crystal bell envelope: fast 25ms attack, exponential-like decay
      let env = 0;
      if (t < 0.025) {
        env = (t / 0.025) * 0.11;
      } else {
        env = 0.11 * Math.exp(-(t - 0.025) * 2.8);
      }

      // Sine fundamental + gentle triangle octave
      const s = sine(2 * Math.PI * note.f * t) * 0.75 + triangle(2 * Math.PI * note.f * 2 * t) * 0.25;
      const sampleVal = s * env;

      leftBuffer[sIdx] += sampleVal * leftGain;
      rightBuffer[sIdx] += sampleVal * rightGain;
    }
  });

  // Tech pulse sonar clock at every chord trigger
  const pulseStartSample = startSample;
  const pulseDuration = 0.045;
  const pulseSampleCount = Math.floor(pulseDuration * sampleRate);
  const pulsePan = c % 2 === 0 ? -0.22 : 0.22;
  const pLeftGain = Math.cos((pulsePan + 1) * Math.PI / 4);
  const pRightGain = Math.sin((pulsePan + 1) * Math.PI / 4);

  for (let i = 0; i < pulseSampleCount; i++) {
    const sIdx = pulseStartSample + i;
    if (sIdx >= totalSamples) break;
    const t = i / sampleRate;
    // frequency sweeps from 1900 to 950
    const f = 1900 * Math.exp(-t * 24);
    let env = 0;
    if (t < 0.005) {
      env = (t / 0.005) * 0.04;
    } else {
      env = 0.04 * Math.exp(-(t - 0.005) * 75);
    }
    const val = sine(2 * Math.PI * f * t) * env;
    leftBuffer[sIdx] += val * pLeftGain;
    rightBuffer[sIdx] += val * pRightGain;
  }
}

// 2. Spatial Ping-Pong Reverb / Delay on the entire track
console.log('Applying spatial reverb and stereo delay...');
const delayTimeLeft = Math.floor(0.28 * sampleRate);
const delayTimeRight = Math.floor(0.36 * sampleRate);
const feedback = 0.26;

for (let i = delayTimeLeft; i < totalSamples; i++) {
  leftBuffer[i] += rightBuffer[i - delayTimeLeft] * feedback * 0.7;
}
for (let i = delayTimeRight; i < totalSamples; i++) {
  rightBuffer[i] += leftBuffer[i - delayTimeRight] * feedback * 0.7;
}

// 3. Master envelope: fade-in at very start (2.5s) and fade-out at end (4.0s)
const fadeInSamples = Math.floor(2.5 * sampleRate);
const fadeOutStart = totalSamples - Math.floor(5.0 * sampleRate);
for (let i = 0; i < fadeInSamples; i++) {
  const g = i / fadeInSamples;
  leftBuffer[i] *= g;
  rightBuffer[i] *= g;
}
for (let i = fadeOutStart; i < totalSamples; i++) {
  const g = Math.max(0, 1 - (i - fadeOutStart) / (totalSamples - fadeOutStart));
  leftBuffer[i] *= g;
  rightBuffer[i] *= g;
}

// 4. Soft limiter / Warm tape saturation
console.log('Applying master mastering & soft limiter...');
let peak = 0;
for (let i = 0; i < totalSamples; i++) {
  // Soft saturation using tanh
  leftBuffer[i] = Math.tanh(leftBuffer[i] * 1.5) * 0.85;
  rightBuffer[i] = Math.tanh(rightBuffer[i] * 1.5) * 0.85;

  const aL = Math.abs(leftBuffer[i]);
  const aR = Math.abs(rightBuffer[i]);
  if (aL > peak) peak = aL;
  if (aR > peak) peak = aR;
}
console.log(`Peak amplitude: ${peak.toFixed(3)}`);

// 5. Interleave stereo 16-bit PCM and stream to ffmpeg
const outputMp3 = path.resolve(__dirname, '../public/audio/caldra-trilha-sonora-principal.mp3');
console.log(`Encoding to MP3 via ffmpeg: ${outputMp3}`);

const pcmData = Buffer.alloc(totalSamples * 4); // 2 bytes per sample * 2 channels
for (let i = 0; i < totalSamples; i++) {
  let sL = Math.max(-1, Math.min(1, leftBuffer[i]));
  let sR = Math.max(-1, Math.min(1, rightBuffer[i]));
  const intL = sL < 0 ? Math.floor(sL * 32768) : Math.floor(sL * 32767);
  const intR = sR < 0 ? Math.floor(sR * 32768) : Math.floor(sR * 32767);
  pcmData.writeInt16LE(intL, i * 4);
  pcmData.writeInt16LE(intR, i * 4 + 2);
}

const ffmpeg = spawn('ffmpeg', [
  '-y',
  '-f', 's16le',
  '-ar', String(sampleRate),
  '-ac', '2',
  '-i', 'pipe:0',
  '-codec:a', 'libmp3lame',
  '-b:a', '320k',
  '-metadata', 'title=CALDRA Horizon (Trilha Sonora Principal)',
  '-metadata', 'artist=CALDRA Industrial Sound Engine',
  '-metadata', 'album=CALDRA — Traçado e Planificação Zero Fresta',
  '-metadata', 'genre=Technological Ambient / PS2 Aesthetic',
  '-metadata', 'date=2026',
  outputMp3,
]);

ffmpeg.stdin.write(pcmData);
ffmpeg.stdin.end();

ffmpeg.stderr.on('data', (d) => {
  // console.log(d.toString());
});

ffmpeg.on('close', (code) => {
  if (code === 0) {
    const stats = fs.statSync(outputMp3);
    console.log(`SUCCESS! MP3 generated at ${outputMp3} (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`);
  } else {
    console.error(`ffmpeg failed with code ${code}`);
    process.exit(1);
  }
});

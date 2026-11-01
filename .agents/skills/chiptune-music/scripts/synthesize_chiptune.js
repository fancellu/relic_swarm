/**
 * 8-Bit Chiptune Audio Synthesizer (Zero Dependencies, ES Module)
 * Synthesizes NES-style 4-channel retro audio (Pulse 1, Pulse 2, Triangle, Noise)
 * and exports a clean, seamless looping 44.1kHz 16-bit PCM WAV file.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Note frequency map (Equal Temperament A4 = 440Hz)
const NOTE_SEMITONES = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
  'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};

export function noteToFreq(noteStr) {
  if (!noteStr || noteStr === 'R' || noteStr === '-') return 0;
  const match = noteStr.match(/^([A-Ga-g][#b]?)([0-8])$/);
  if (!match) return 0;
  const name = match[1].charAt(0).toUpperCase() + match[1].slice(1);
  const oct = parseInt(match[2], 10);
  const semitones = NOTE_SEMITONES[name];
  if (semitones === undefined) return 0;
  // A4 is octave 4, semitone 9 -> MIDI 69
  const midi = (oct + 1) * 12 + semitones;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Write 44-byte standard PCM WAV header
export function createWavBuffer(sampleRate, numChannels, pcm16Data) {
  const dataSize = pcm16Data.length * 2;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);          // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20);           // AudioFormat (1 = PCM)
  header.writeUInt16LE(numChannels, 22); // NumChannels
  header.writeUInt32LE(sampleRate, 24);  // SampleRate
  header.writeUInt32LE(sampleRate * numChannels * 2, 28); // ByteRate
  header.writeUInt16LE(numChannels * 2, 32);              // BlockAlign
  header.writeUInt16LE(16, 34);          // BitsPerSample
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  const body = Buffer.alloc(dataSize);
  for (let i = 0; i < pcm16Data.length; i++) {
    const val = Math.max(-32768, Math.min(32767, Math.round(pcm16Data[i] * 32767)));
    body.writeInt16LE(val, i * 2);
  }

  return Buffer.concat([header, body]);
}

/**
 * Synthesizes a chiptune loop from track definitions
 * @param {Object} score { bpm, measures, timeSig, channels: { pulse1, pulse2, triangle, noise } }
 * @param {string} outputPath
 */
export function synthesizeChiptune(score, outputPath) {
  const sampleRate = 44100;
  const bpm = score.bpm || 140;
  const timeSig = score.timeSig || [4, 4];
  const measures = score.measures || 8;

  const secondsPerBeat = 60 / bpm;
  const beatsPerMeasure = timeSig[0];
  const totalDuration = measures * beatsPerMeasure * secondsPerBeat;
  const totalSamples = Math.round(totalDuration * sampleRate);

  const mix = new Float32Array(totalSamples);

  // 1. Synthesize Pulse 1 (Lead Melody)
  if (score.channels.pulse1) {
    const ch = score.channels.pulse1;
    const duty = ch.duty || 0.25;
    const notes = ch.notes || [];
    renderMelodicChannel(mix, notes, sampleRate, totalSamples, totalDuration, 'pulse', duty, ch.volume || 0.28, ch.vibrato);
  }

  // 2. Synthesize Pulse 2 (Harmony / Demiarpeggios)
  if (score.channels.pulse2) {
    const ch = score.channels.pulse2;
    const duty = ch.duty || 0.50;
    const notes = ch.notes || [];
    renderMelodicChannel(mix, notes, sampleRate, totalSamples, totalDuration, 'pulse', duty, ch.volume || 0.22, ch.vibrato);
  }

  // 3. Synthesize Triangle (Bassline)
  if (score.channels.triangle) {
    const ch = score.channels.triangle;
    const notes = ch.notes || [];
    renderMelodicChannel(mix, notes, sampleRate, totalSamples, totalDuration, 'triangle', 0.5, ch.volume || 0.32, null);
  }

  // 4. Synthesize Noise (Rhythm / Drums)
  if (score.channels.noise) {
    const ch = score.channels.noise;
    const notes = ch.notes || [];
    renderNoiseChannel(mix, notes, sampleRate, totalSamples, totalDuration, ch.volume || 0.26);
  }

  // Apply 3ms micro-fade at loop boundaries to guarantee zero-crossing
  const fadeSamples = Math.min(128, Math.floor(sampleRate * 0.003));
  for (let i = 0; i < fadeSamples; i++) {
    const fIn = i / fadeSamples;
    const fOut = 1 - (i / fadeSamples);
    mix[i] *= fIn;
    mix[totalSamples - 1 - i] *= fOut;
  }

  const wavBuffer = createWavBuffer(sampleRate, 1, mix);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, wavBuffer);
  console.log(`Synthesized Chiptune [${measures} bars @ ${bpm} BPM, ${(totalDuration).toFixed(2)}s] -> ${outputPath}`);
}

function renderMelodicChannel(mix, notes, sampleRate, totalSamples, totalDuration, type, duty, masterVol, vibrato) {
  let samplePos = 0;
  let phase = 0;

  for (let n = 0; n < notes.length && samplePos < totalSamples; n++) {
    const item = notes[n];
    const durationSec = item.duration * (totalDuration / getTotalSteps(notes));
    const noteSamples = Math.round(durationSec * sampleRate);
    const endSample = Math.min(totalSamples, samplePos + noteSamples);
    const freq = noteToFreq(item.note);
    const gate = item.gate !== undefined ? item.gate : 0.85; // 85% note duration, 15% staccato rest
    const activeSamples = Math.round(noteSamples * gate);

    if (freq > 0) {
      for (let s = samplePos; s < endSample; s++) {
        const noteLocalSample = s - samplePos;
        if (noteLocalSample < activeSamples) {
          // Delayed Vibrato
          let currentFreq = freq;
          if (vibrato && noteLocalSample > sampleRate * 0.1) {
            const vibTime = (noteLocalSample - sampleRate * 0.1) / sampleRate;
            currentFreq += Math.sin(vibTime * Math.PI * 2 * (vibrato.rate || 6.0)) * (vibrato.depth || 4.0);
          }

          phase += currentFreq / sampleRate;
          if (phase >= 1.0) phase -= 1.0;

          // Waveform generation
          let sampleVal = 0;
          if (type === 'pulse') {
            sampleVal = phase < duty ? 1.0 : -1.0;
          } else if (type === 'triangle') {
            const rawTri = phase < 0.5 ? (4 * phase - 1) : (3 - 4 * phase);
            // 4-bit 16-step stair-step quantization (authentic NES 2A03 DAC)
            sampleVal = Math.floor((rawTri + 1.0) * 7.5) / 7.5 - 1.0;
          }

          // Volume decay
          const env = 1.0 - (noteLocalSample / activeSamples) * 0.15;
          mix[s] += sampleVal * masterVol * env;
        }
      }
    }
    samplePos = endSample;
  }
}

function renderNoiseChannel(mix, hits, sampleRate, totalSamples, totalDuration, masterVol) {
  let samplePos = 0;
  let lfsr = 0x7FFF;

  for (let h = 0; h < hits.length && samplePos < totalSamples; h++) {
    const item = hits[h];
    const durationSec = item.duration * (totalDuration / getTotalSteps(hits));
    const hitSamples = Math.round(durationSec * sampleRate);
    const endSample = Math.min(totalSamples, samplePos + hitSamples);
    const type = item.type || 'rest';

    if (type !== 'rest') {
      const decayDuration = type === 'kick' ? 0.06 : type === 'snare' ? 0.14 : 0.025;
      const decaySamples = Math.round(decayDuration * sampleRate);

      for (let s = samplePos; s < endSample; s++) {
        const local = s - samplePos;
        if (local < decaySamples) {
          // Advance LFSR pseudo-random shift register
          const bit = ((lfsr >> 0) ^ (lfsr >> 1)) & 1;
          lfsr = (lfsr >> 1) | (bit << 14);
          const rawNoise = (lfsr & 1) ? 1.0 : -1.0;

          // Envelope curve
          const progress = local / decaySamples;
          const env = Math.pow(1.0 - progress, 2);

          // Tone filtering / pitch
          let sampleVal = rawNoise;
          if (type === 'kick') {
            // Low-pass filtered noise + sub-thump
            sampleVal = (rawNoise * 0.5) + Math.sin(progress * Math.PI * 4) * (1.0 - progress);
          }

          mix[s] += sampleVal * masterVol * env;
        }
      }
    }
    samplePos = endSample;
  }
}

function getTotalSteps(list) {
  let sum = 0;
  for (let i = 0; i < list.length; i++) sum += list[i].duration || 1;
  return sum || 1;
}

// Built-in Demo: 8-Bar High-Energy Relic Swarm Arcade Battle Theme
if (process.argv[1] && process.argv[1].endsWith('synthesize_chiptune.js')) {
  const demoBattleTheme = {
    bpm: 148,
    measures: 8,
    timeSig: [4, 4],
    channels: {
      // Pulse 1: Lead Melody (25% Duty Cycle, energetic minor key)
      pulse1: {
        duty: 0.25,
        volume: 0.28,
        vibrato: { rate: 6.5, depth: 5.0 },
        notes: [
          // Bar 1
          { note: 'E4', duration: 1 }, { note: 'G4', duration: 1 }, { note: 'B4', duration: 1 }, { note: 'E5', duration: 1 },
          { note: 'D5', duration: 2 }, { note: 'B4', duration: 2 },
          // Bar 2
          { note: 'C5', duration: 1 }, { note: 'B4', duration: 1 }, { note: 'A4', duration: 1 }, { note: 'G4', duration: 1 },
          { note: 'A4', duration: 3 }, { note: 'R',  duration: 1 },
          // Bar 3
          { note: 'E4', duration: 1 }, { note: 'G4', duration: 1 }, { note: 'B4', duration: 1 }, { note: 'D5', duration: 1 },
          { note: 'E5', duration: 2 }, { note: 'G5', duration: 2 },
          // Bar 4
          { note: 'F#5', duration: 2 }, { note: 'D5', duration: 1 }, { note: 'B4', duration: 1 },
          { note: 'E5', duration: 4 },
          // Bar 5
          { note: 'G5', duration: 2 }, { note: 'E5', duration: 1 }, { note: 'G5', duration: 1 },
          { note: 'A5', duration: 2 }, { note: 'F5', duration: 2 },
          // Bar 6
          { note: 'G5', duration: 2 }, { note: 'D5', duration: 1 }, { note: 'F5', duration: 1 },
          { note: 'E5', duration: 4 },
          // Bar 7
          { note: 'C5', duration: 1 }, { note: 'D5', duration: 1 }, { note: 'E5', duration: 1 }, { note: 'G5', duration: 1 },
          { note: 'B5', duration: 2 }, { note: 'A5', duration: 2 },
          // Bar 8 (Turnaround resolving to E)
          { note: 'B5', duration: 2 }, { note: 'D#5', duration: 2 },
          { note: 'F#5', duration: 2 }, { note: 'B4', duration: 2 },
        ]
      },
      // Pulse 2: Demiarpeggio Texture (50% Square Wave, fast 16th-note triads)
      pulse2: {
        duty: 0.50,
        volume: 0.18,
        notes: [
          // Bars 1-2 (Em -> Am)
          { note: 'E3', duration: 0.5 }, { note: 'G3', duration: 0.5 }, { note: 'B3', duration: 0.5 }, { note: 'E4', duration: 0.5 },
          { note: 'E3', duration: 0.5 }, { note: 'G3', duration: 0.5 }, { note: 'B3', duration: 0.5 }, { note: 'E4', duration: 0.5 },
          { note: 'E3', duration: 0.5 }, { note: 'G3', duration: 0.5 }, { note: 'B3', duration: 0.5 }, { note: 'E4', duration: 0.5 },
          { note: 'E3', duration: 0.5 }, { note: 'G3', duration: 0.5 }, { note: 'B3', duration: 0.5 }, { note: 'E4', duration: 0.5 },
          { note: 'A3', duration: 0.5 }, { note: 'C4', duration: 0.5 }, { note: 'E4', duration: 0.5 }, { note: 'A4', duration: 0.5 },
          { note: 'A3', duration: 0.5 }, { note: 'C4', duration: 0.5 }, { note: 'E4', duration: 0.5 }, { note: 'A4', duration: 0.5 },
          { note: 'A3', duration: 0.5 }, { note: 'C4', duration: 0.5 }, { note: 'E4', duration: 0.5 }, { note: 'A4', duration: 0.5 },
          { note: 'B3', duration: 0.5 }, { note: 'D#4', duration: 0.5 }, { note: 'F#4', duration: 0.5 }, { note: 'B4', duration: 0.5 },
          // Bars 3-4 (Em -> D -> Em)
          { note: 'E3', duration: 0.5 }, { note: 'G3', duration: 0.5 }, { note: 'B3', duration: 0.5 }, { note: 'E4', duration: 0.5 },
          { note: 'E3', duration: 0.5 }, { note: 'G3', duration: 0.5 }, { note: 'B3', duration: 0.5 }, { note: 'E4', duration: 0.5 },
          { note: 'D3', duration: 0.5 }, { note: 'F#3', duration: 0.5 }, { note: 'A3', duration: 0.5 }, { note: 'D4', duration: 0.5 },
          { note: 'D3', duration: 0.5 }, { note: 'F#3', duration: 0.5 }, { note: 'A3', duration: 0.5 }, { note: 'D4', duration: 0.5 },
          { note: 'E3', duration: 0.5 }, { note: 'G3', duration: 0.5 }, { note: 'B3', duration: 0.5 }, { note: 'E4', duration: 0.5 },
          { note: 'E3', duration: 0.5 }, { note: 'G3', duration: 0.5 }, { note: 'B3', duration: 0.5 }, { note: 'E4', duration: 0.5 },
          { note: 'E3', duration: 0.5 }, { note: 'G3', duration: 0.5 }, { note: 'B3', duration: 0.5 }, { note: 'E4', duration: 0.5 },
          { note: 'E3', duration: 0.5 }, { note: 'G3', duration: 0.5 }, { note: 'B3', duration: 0.5 }, { note: 'E4', duration: 0.5 },
          // Bars 5-6 (C -> D -> Em)
          { note: 'C3', duration: 0.5 }, { note: 'E3', duration: 0.5 }, { note: 'G3', duration: 0.5 }, { note: 'C4', duration: 0.5 },
          { note: 'C3', duration: 0.5 }, { note: 'E3', duration: 0.5 }, { note: 'G3', duration: 0.5 }, { note: 'C4', duration: 0.5 },
          { note: 'D3', duration: 0.5 }, { note: 'F#3', duration: 0.5 }, { note: 'A3', duration: 0.5 }, { note: 'D4', duration: 0.5 },
          { note: 'D3', duration: 0.5 }, { note: 'F#3', duration: 0.5 }, { note: 'A3', duration: 0.5 }, { note: 'D4', duration: 0.5 },
          { note: 'E3', duration: 0.5 }, { note: 'G3', duration: 0.5 }, { note: 'B3', duration: 0.5 }, { note: 'E4', duration: 0.5 },
          { note: 'E3', duration: 0.5 }, { note: 'G3', duration: 0.5 }, { note: 'B3', duration: 0.5 }, { note: 'E4', duration: 0.5 },
          { note: 'E3', duration: 0.5 }, { note: 'G3', duration: 0.5 }, { note: 'B3', duration: 0.5 }, { note: 'E4', duration: 0.5 },
          { note: 'E3', duration: 0.5 }, { note: 'G3', duration: 0.5 }, { note: 'B3', duration: 0.5 }, { note: 'E4', duration: 0.5 },
          // Bars 7-8 (C -> B7 Turnaround)
          { note: 'C3', duration: 0.5 }, { note: 'E3', duration: 0.5 }, { note: 'G3', duration: 0.5 }, { note: 'C4', duration: 0.5 },
          { note: 'C3', duration: 0.5 }, { note: 'E3', duration: 0.5 }, { note: 'G3', duration: 0.5 }, { note: 'C4', duration: 0.5 },
          { note: 'D3', duration: 0.5 }, { note: 'F#3', duration: 0.5 }, { note: 'A3', duration: 0.5 }, { note: 'D4', duration: 0.5 },
          { note: 'D3', duration: 0.5 }, { note: 'F#3', duration: 0.5 }, { note: 'A3', duration: 0.5 }, { note: 'D4', duration: 0.5 },
          { note: 'B3', duration: 0.5 }, { note: 'D#4', duration: 0.5 }, { note: 'F#4', duration: 0.5 }, { note: 'B4', duration: 0.5 },
          { note: 'B3', duration: 0.5 }, { note: 'D#4', duration: 0.5 }, { note: 'F#4', duration: 0.5 }, { note: 'B4', duration: 0.5 },
          { note: 'B3', duration: 0.5 }, { note: 'D#4', duration: 0.5 }, { note: 'F#4', duration: 0.5 }, { note: 'B4', duration: 0.5 },
          { note: 'B3', duration: 0.5 }, { note: 'D#4', duration: 0.5 }, { note: 'F#4', duration: 0.5 }, { note: 'B4', duration: 0.5 },
        ]
      },
      // Triangle: Staccato Walking Bass (Octave pops)
      triangle: {
        volume: 0.35,
        notes: [
          // Bar 1 (E)
          { note: 'E2', duration: 1 }, { note: 'E3', duration: 1 }, { note: 'E2', duration: 1 }, { note: 'E3', duration: 1 },
          { note: 'G2', duration: 1 }, { note: 'G3', duration: 1 }, { note: 'B2', duration: 1 }, { note: 'B3', duration: 1 },
          // Bar 2 (A)
          { note: 'A2', duration: 1 }, { note: 'A3', duration: 1 }, { note: 'A2', duration: 1 }, { note: 'A3', duration: 1 },
          { note: 'F2', duration: 1 }, { note: 'F3', duration: 1 }, { note: 'B2', duration: 1 }, { note: 'B3', duration: 1 },
          // Bar 3 (E)
          { note: 'E2', duration: 1 }, { note: 'E3', duration: 1 }, { note: 'E2', duration: 1 }, { note: 'E3', duration: 1 },
          { note: 'D2', duration: 1 }, { note: 'D3', duration: 1 }, { note: 'D2', duration: 1 }, { note: 'D3', duration: 1 },
          // Bar 4 (E)
          { note: 'E2', duration: 1 }, { note: 'E3', duration: 1 }, { note: 'E2', duration: 1 }, { note: 'E3', duration: 1 },
          { note: 'E2', duration: 2 }, { note: 'B2', duration: 2 },
          // Bar 5 (C -> D)
          { note: 'C2', duration: 1 }, { note: 'C3', duration: 1 }, { note: 'C2', duration: 1 }, { note: 'C3', duration: 1 },
          { note: 'D2', duration: 1 }, { note: 'D3', duration: 1 }, { note: 'D2', duration: 1 }, { note: 'D3', duration: 1 },
          // Bar 6 (E)
          { note: 'E2', duration: 1 }, { note: 'E3', duration: 1 }, { note: 'E2', duration: 1 }, { note: 'E3', duration: 1 },
          { note: 'G2', duration: 1 }, { note: 'E2', duration: 1 }, { note: 'B2', duration: 2 },
          // Bar 7 (C -> D)
          { note: 'C2', duration: 1 }, { note: 'C3', duration: 1 }, { note: 'C2', duration: 1 }, { note: 'C3', duration: 1 },
          { note: 'D2', duration: 1 }, { note: 'D3', duration: 1 }, { note: 'D2', duration: 1 }, { note: 'D3', duration: 1 },
          // Bar 8 (B Turnaround)
          { note: 'B2', duration: 1 }, { note: 'B3', duration: 1 }, { note: 'B2', duration: 1 }, { note: 'B3', duration: 1 },
          { note: 'B2', duration: 2 }, { note: 'D#3', duration: 2 },
        ]
      },
      // Noise: 4-on-the-Floor Drum Beat (Kick on 1, 3; Snare on 2, 4; Hi-hats on offbeats)
      noise: {
        volume: 0.28,
        notes: Array(8).fill(null).flatMap(() => [
          { type: 'kick', duration: 0.5 }, { type: 'hat',  duration: 0.5 },
          { type: 'snare', duration: 0.5 }, { type: 'hat',  duration: 0.5 },
          { type: 'kick', duration: 0.5 }, { type: 'hat',  duration: 0.5 },
          { type: 'snare', duration: 0.5 }, { type: 'hat',  duration: 0.5 },
        ])
      }
    }
  };

  const outPath = process.argv[2] || path.join(__dirname, 'demo_chiptune.wav');
  synthesizeChiptune(demoBattleTheme, outPath);
}

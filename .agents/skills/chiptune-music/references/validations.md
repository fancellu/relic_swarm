# Chiptune & 8-Bit Music - Validations

Verification rules, constraint checks, and automated validation patterns for 8-bit chiptune audio assets.

---

## 1. Maximum Voice Channel Count

### **Id**
chiptune-voice-channel-limit

### **Severity**
error

### **Type**
structural

### **Rule**
The composition must never exceed the physical voice channel count of the target retro architecture.

| Target Platform | Max Monophonic Channels | Channel Roster |
|---|---|---|
| **NES / Famicom (2A03)** | 5 | Pulse 1, Pulse 2, Triangle, Noise, DPCM |
| **Game Boy (DMG)** | 4 | Pulse 1 (Sweep), Pulse 2, Wave RAM, Noise |
| **Commodore 64 (SID)** | 3 | Voice 1, Voice 2, Voice 3 (Shared filter) |
| **Sega Genesis (YM2612)** | 6 | FM 1-6 (or 5 FM + 1 DAC 8-bit sample) |

### **Message**
Polyphony violation: Do not exceed hardware channel limits. Use arpeggios or counterpoint instead of adding extra channels.

---

## 2. Illegal Waveform Types for Target Platform

### **Id**
chiptune-illegal-waveform

### **Severity**
error

### **Type**
structural

### **Pattern**
- `sine` on NES / Famicom (NES has Triangle and Pulse, NO pure Sine wave oscillator).
- `supersaw` or `hypersaw` on any 8-bit PSG.
- Arbitrary polyphony inside a single oscillator node.

### **Message**
Illegal waveform: 8-bit hardware only supports specific mathematical shapes (Pulse with 12.5%, 25%, 50% duty, 16-step Triangle, and LFSR Noise).

---

## 3. Bass Frequency Floor Check

### **Id**
chiptune-bass-sub-limit

### **Severity**
warning

### **Type**
range

### **Rule**
Triangle channel bass notes should remain at or above **C2 (65.4 Hz)** during standard musical progressions. Notes below E1 (41.2 Hz) cause speaker distortion on mobile devices and destroy mix headroom.

### **Message**
Triangle bass is below C2 (65.4 Hz). Transpose up one octave to preserve pitch clarity and prevent speaker rumble.

---

## 4. Loop Duration & Bar Metric Quantization

### **Id**
chiptune-loop-metric-quantization

### **Severity**
error

### **Type**
timing

### **Rule**
Background music loops must be an exact integer multiple of complete musical bars:
$$\text{Total Duration (seconds)} = \text{Total Measures} \times \frac{4 \times 60}{\text{BPM}}$$
- Allowed measure counts: 4, 8, 16, 32, 64 measures.
- Odd fractional seconds (e.g. 17.34s) indicate an unquantized edit that will desync rhythmic loops.

### **Message**
Loop length is not quantized to exact measure boundaries. Adjust duration to match exact beat/measure intervals.

---

## 5. Loop Boundary Zero-Crossing Check

### **Id**
chiptune-zero-crossing-seam

### **Severity**
error

### **Type**
audio_sample

### **Rule**
Both the very first audio sample ($S_0$) and the very last audio sample ($S_{N-1}$) of a looping WAV file must be within $\pm 0.005$ of the zero amplitude line ($0.0$).

### **Fix Action**
Apply a 2ms micro-fadeout or align the cut point to a zero-crossing node before export.

# Chiptune & 8-Bit Music Mastery

## Patterns

---

### Pattern 1: Fast Demiarpeggio (The Tim Follin Pseudo-Chord)

#### **Description**
Cycle 3 or 4 chord tones at high frequencies (50Hz–60Hz, 1 tick/frame per note) inside a single monophonic pulse channel. The human brain psychoacoustically blends the rapid notes into a shimmering, full harmonic chord while leaving the remaining channels free for lead melodies, basslines, and percussion.

#### **When**
- When you need lush, full chords (Major 7th, Minor 9th, Suspended chords) but only have 1 channel to spare.
- Iconic arcade title screens, high-energy boss intros, and dramatic sci-fi arps.

#### **Implementation Architecture**
```text
Rate: 1 note per audio tick (16.6ms at 60 FPS, or 32nd/64th notes at 140+ BPM)
Chord: C Major 7 (C4 - E4 - G4 - B4)
Sequence: C4 -> E4 -> G4 -> B4 -> C4 -> E4 -> G4 -> B4 (Looping)

Timbre Rule:
- Use 25% or 50% duty cycle for arps.
- Keep volume 20-30% lower than the lead melody channel to prevent the shimmering arp from masking the lead vocal/lead voice.
```

#### **MML Example**
```text
; MML Arp Macro: Rapid 32nd note triad
@1 = { c16 e16 g16 > c16 < }
; Usage across a progression (C -> Am -> F -> G):
t150 o4 l32
[4 c e g > c <] [4 a c e > a <] [4 f a > c f <] [4 g b > d g <]
```

---

### Pattern 2: Noise Channel Percussion Synthesis

#### **Description**
8-bit systems have no dedicated drum samples (unless using precious DPCM memory). Drums are synthesized entirely from the **Noise Channel** (pseudo-random linear feedback shift register) shaped by rapid exponential volume and pitch envelopes.

#### **When**
Building the rhythm section on NES, Game Boy, or C64 without sample bloat.

#### **Drum Recipes & Envelope Curves**

1. **The Chiptune Kick Drum**:
   - *Frequency*: Starts at low/mid noise register and drops rapidly to the lowest frequency in 40ms.
   - *Volume Envelope*: Attack 0ms, Decay 50ms, Sustain 0, Release 10ms.
   - *Pro-Tip (NES)*: Layer a pitch-dropping Triangle wave pop ($120\text{Hz} \to 40\text{Hz}$ in 30ms) under the noise click to give the kick a chest-thumping sub-bass thump.

2. **The 8-Bit Snare Drum**:
   - *Frequency*: High white noise burst transitioning to mid-noise rattling.
   - *Volume Envelope*: Initial transient at volume 15 (max) for 15ms, then linear/exponential decay over 120ms to 0.
   - *Length*: 120ms–160ms.

3. **Closed Hi-Hat**:
   - *Frequency*: Highest noise pitch step (metallic, high-pass sizzle).
   - *Volume Envelope*: Staccato spike! Volume 10 for 5ms, drops to 0 by 25ms.

4. **Open Hi-Hat / Cymbal Crash**:
   - *Frequency*: High noise with slight frequency fluctuation.
   - *Volume Envelope*: Exponential decay over 250ms–400ms.

#### **Standard Drum Groove Pattern (4/4 Beat)**
```text
Beat:      1 . . . 2 . . . 3 . . . 4 . . .
Noise:     K . H . S . H . K . K . S . H .
K = Kick (Noise low + Tri drop)
S = Snare (Noise burst + fast decay)
H = Closed Hat (Ultra-short metallic tick)
```

---

### Pattern 3: Timbral Contrast Through Duty Cycle Switching

#### **Description**
Pulse channels can change their duty cycle (the percentage of the wave cycle that is high vs low). This dramatically reshapes the harmonic overtone series without needing an analog filter.

#### **Duty Cycle Palette**

| Duty Cycle | Timbre Character | Harmonic Content | Ideal Role |
|---|---|---|---|
| **12.5% (1/8)** | Nasal, reedy, biting, aggressive | Heavy even and odd harmonics | Sharp synth leads, cutting bass, warning stings |
| **25.0% (1/4)** | Punchy, hollow, classic arcade | Balanced harmonics | Counter-melodies, classic retro game hooks |
| **50.0% (1/2)** | Pure square, warm, round, flute-like | Odd harmonics only ($1f, 3f, 5f\dots$) | Heroic fanfares, organ pads, soothing themes |
| **75.0% (3/4)** | Functionally identical to 25% | Phase inverted 25% | Stereo width tricks (pan 25% Left, 75% Right) |

#### **Compositional Pattern: Verse to Chorus Timbral Shift**
- **Verse**: Use **12.5%** duty cycle at moderate volume. The thin, nasal timbre leaves ample sonic space for walking bass.
- **Chorus**: Switch lead to **50%** square wave with doubled octaves or delayed vibrato. The sudden warmth and fullness makes the chorus explode with energy without raising overall decibel levels.

---

### Pattern 4: Triangle Channel Bass Articulation & Walking Bass

#### **Description**
The NES Triangle channel outputs a pure, warm 16-step stair-stepped triangle wave that sounds like a vintage upright bass or flute. **It has NO hardware volume control**—it is either fully ON or fully OFF.

#### **Techniques for Articulation**

1. **Staccato Note Gaps (Simulating Volume Dynamics)**:
   - To make bass groove, never connect notes legato!
   - Play notes for 60%–75% of their duration and leave 25%–40% silence between steps. The sudden silence provides the rhythmic bounce that modern compressors give to acoustic bass.

2. **Octave Hopping (The Disco/Survivor Groove)**:
   - Root note on the strong downbeat ($1, 3$).
   - Octave-up staccato pop on the upbeat (the "and" of the beat).
   - *Example*: `C2 (downbeat) -> C3 (upbeat) -> C2 -> C3`.

3. **Pitch Bends / Slides**:
   - Quick portamento slide up into the root note (from 2 semitones below) simulates a fretless or finger-picked bass pluck.

---

### Pattern 5: Seamless Zero-Crossing Game Loops

#### **Description**
A game background music track (BGM) must loop continuously for 10 to 30 minutes without irritating the player or producing an audible restart click.

#### **Loop Construction Rules**

1. **Harmonic Turnaround**:
   - The final bar of the loop (e.g. Bar 16 or Bar 32) must act as a **harmonic turnaround** (dominant $V$ chord or tension $VII$ chord) that craves resolution back into the tonic $I$ chord at Bar 1, Beat 1.
2. **Reverb / Echo Tail Management**:
   - Never fade out at the end of a game loop.
   - Any delayed echoes or trailing notes from the final bar should naturally wrap around and sound as if they ring into Bar 1.
3. **Zero-Crossing Sample Alignment**:
   - The audio buffer at sample $0$ and sample $N-1$ must cross the zero amplitude line ($0.0$).
   - Cutting audio at a peak ($+1.0$ or $-1.0$) causes a physical speaker cone pop that destroys game immersion.

---

### Pattern 6: Standard MML (Music Macro Language) Conventions

#### **MML Syntax Specification**

```text
t<bpm>       Set tempo (e.g., t144 = 144 BPM)
o<octave>    Set octave (e.g., o4 = middle C octave, 1-8)
> / <        Shift octave up (>) or down (<)
l<length>    Set default note length (e.g., l16 = sixteenth note, l8, l4)
c, d, e...   Note names (append + or # for sharp, - for flat)
r<length>    Rest (silence)
v<volume>    Volume level (0 to 15 on NES/Game Boy)
q<length>    Gate time / staccato ratio (e.g., q6 = 6/8 duration, leaves 2/8 rest)
[notes]N     Repeat block N times (e.g., [c e g]4)
```

#### **Full Battle Theme Example (NES 4-Channel Layout)**

```text
; --- Channel 1: Pulse 1 (Lead Melody, 25% Duty) ---
t140 o5 l16 v13
[
  e8 e8 r8 e8 r8 c8 e8 g8 r4 < g8 r4 >
  c8. < g16 r8 e8 a8 b8 b-8 a8
  g8. e16 g8 a8 f8 g8 e8 c8
]2

; --- Channel 2: Pulse 2 (Fast Arp Harmony, 50% Duty) ---
t140 o4 l32 v9
[
  [4 c e g > c <] [4 < g b > d g <] [4 a c e > a <] [4 f a > c f <]
]2

; --- Channel 3: Triangle (Bouncy Walking Bass) ---
t140 o3 l16
[
  c8 r8 c8 r8 e8 r8 g8 r8  a8 r8 a8 r8 f8 r8 g8 r8
  c8 c8 > c8 < c8 e8 e8 > e8 < e8  f8 f8 > f8 < f8 g8 g8 > g8 < g8
]2

; --- Channel 4: Noise (Driving 4-on-the-Floor Beat) ---
t140 l16 v12
[
  v14 c8 v8 c8 v14 d8 v8 c8  v14 c8 v8 c8 v14 d8 v8 c8
]2
```

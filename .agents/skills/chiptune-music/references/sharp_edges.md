# Chiptune & 8-Bit Music - Sharp Edges

Critical pitfalls, sound engine failures, and acoustic traps encountered when composing 8-bit audio.

---

## 1. The "Bitcrusher on Modern Mix" Trap

### **Id**
bitcrusher-is-not-chiptune

### **Severity**
CRITICAL

### **Description**
Slapping a bitcrusher or sample-rate reducer plugin onto a modern multi-track stereo mix (with reverb, supersaws, acoustic drum samples, and wide stereo panning) does not produce chiptune. It produces muddy, phase-cancelled, harsh modern audio.

### **Symptoms**
- Audio sounds like a broken MP3 rather than an authentic retro video game.
- Thick, wash-like noise in the high frequencies.
- Complete loss of rhythmic punch and melodic clarity.

### **Why It Happens**
True 8-bit audio achieves its charm through **voice economy** (3 or 4 strictly monophonic channels), pure harmonic overtone series (mathematical square and triangle waves), and hard-quantized pitch envelopes. Bitcrushing an already dense chord smear just introduces harmonic intermodulation distortion.

### **Solution**
Compose from the ground up with isolated monophonic voices:
- Voice 1: Lead Melody (Single Pulse oscillator)
- Voice 2: Harmony / Arpeggio / Counterpoint (Single Pulse oscillator)
- Voice 3: Bassline (Triangle or 4-bit custom wave)
- Voice 4: Rhythm (White noise with linear/exponential decay)

---

## 2. Ear-Fatigue Square Wave Saturation

### **Id**
square-wave-ear-fatigue

### **Severity**
HIGH

### **Description**
Using static 50% symmetric square waves without duty cycle modulation, volume dynamics, or delayed vibrato causes severe psychoacoustic listener fatigue within 30–45 seconds.

### **Symptoms**
- Players mute the in-game music quickly.
- Piercing "buzzsaw" or "bee in a jar" tonality.
- Melodies feel robotic, shrill, and unexpressive.

### **Detection Pattern**
Continuous 50% duty cycle, constant volume (v15), no vibrato or envelope attack.

### **Why It Happens**
A 50% square wave contains infinite odd harmonics ($1f, 3f, 5f, 7f\dots$) at high amplitudes. Constant sustained exposure at high volume overstimulates the human cochlea in the 2kHz–5kHz sensitivity zone.

### **Solution**
1. **Apply Delayed Vibrato**: Let sustained notes ring true for 80ms–120ms before introducing a subtle pitch wobble ($\pm 15$ cents at 5Hz–6Hz).
2. **Duty Cycle Shifting**: Switch to 25% or 12.5% duty cycle for verses, reserving 50% for triumphant chorus climaxes.
3. **Decay Envelopes**: Give sustained notes a gentle decay from volume 14 down to volume 10 over their duration rather than a flat, brickwall volume block.

---

## 3. The Uncontrolled Triangle Bass Rumble

### **Id**
uncontrolled-triangle-rumble

### **Severity**
HIGH

### **Description**
Letting triangle wave bass notes drone continuously or dip below C1 ($32.7\text{Hz}$) turns the game mix into an indistinct low-frequency rumble that masks sound effects and distorts laptop/mobile speakers.

### **Symptoms**
- Muddy low-end where bass notes lose pitch definition.
- Laptop, phone, or handheld console speakers rattle and distort.
- In-game explosions lose punch because the bassline eats all available headroom.

### **Why It Happens**
On chips like the NES 2A03, the Triangle channel has **zero hardware volume control**. It cannot be quieted in the hardware mixer. Sustained low-frequency triangle waves maintain continuous maximum amplitude.

### **Solution**
1. **Pitch Floor Constraint**: Keep triangle bass between C2 ($65.4\text{Hz}$) and C4 ($261.6\text{Hz}$). Never drop into sub-bass below E1 unless writing a special earthquake effect.
2. **Staccato Articulation**: Introduce mandatory rests (e.g. 16th-note pauses) between bass pulses. Silence in the bass is what creates groove and punch.
3. **Frequency Separation**: If the Noise channel kick drum triggers on Beat 1, insert a 16th-note rest or octave pop on the Triangle channel so the kick and bass do not collide.

---

## 4. The Loop Seam "Click / Pop"

### **Id**
loop-seam-click-pop

### **Severity**
HIGH

### **Description**
An audible "pop" or "click" sounds whenever the background music loop reaches the end of the file and jumps back to Bar 1.

### **Symptoms**
- Noticeable mechanical click every 16 or 32 bars during gameplay.
- Breaks player immersion.

### **Why It Happens**
The audio file was cut while the waveform was at a non-zero amplitude (e.g. $+0.8$ or $-0.6$). When the audio engine jumps from $-0.6$ at the end of the file to $+0.0$ at the start, the speaker cone experiences an instantaneous vertical voltage jump, resulting in an impulse click.

### **Solution**
1. **Zero-Crossing Cut**: Ensure the final sample of the loop and the first sample of the loop cross the $0.0$ voltage axis with the same slope direction.
2. **Reverb/Delay Tail Wrap**: Render the loop with an extra cycle, then mix the trailing release tail from the final bar back into the beginning of Bar 1 before cutting at the loop boundary.

---

## 5. Channel-Stealing Sound Effect Clashes

### **Id**
sfx-channel-stealing-clash

### **Severity**
MEDIUM

### **Description**
In games where sound effects share PSG channels with the music engine, combat sound effects (firing lasers, jumping, collecting coins) cut out critical musical lines, creating disjointed audio.

### **Symptoms**
- Lead melody disappears when the player holds down the fire button.
- Snare drums vanish whenever an enemy is hit.

### **Solution**
- **Channel Hierarchy Assignment**:
  - Route continuous rapid SFX (gunshots, steps) to Pulse 1 or Noise.
  - Keep the primary musical hook on **Pulse 2** or **Triangle**, ensuring the core melodic identity remains unbroken even during dense combat.

"""Generate a short calm ambient bed (soft pads, no melody spam)."""
from pathlib import Path
import wave
import numpy as np

OUT = Path(r"C:\Users\esteb\Constructora\public\marketing\video\bgm-calm.wav")
SR = 44100
DURATION = 45.0
t = np.linspace(0, DURATION, int(SR * DURATION), endpoint=False)

def env_adsr(n, attack=1.5, release=2.5):
    e = np.ones(n, dtype=np.float64)
    a = min(int(attack * SR), n // 4)
    r = min(int(release * SR), n // 3)
    if a:
        e[:a] = np.linspace(0, 1, a)
    if r:
        e[-r:] = np.linspace(1, 0, r)
    return e

def soft_chord(freqs, start, length, gain=0.045):
    i0 = int(start * SR)
    n = int(length * SR)
    i1 = min(i0 + n, len(t))
    n = i1 - i0
    if n <= 0:
        return
    tt = t[i0:i1] - t[i0]
    e = env_adsr(n, attack=1.8, release=2.2)
    wave_sum = np.zeros(n, dtype=np.float64)
    for f in freqs:
        # fundamental + soft 5th harmonic, very low
        wave_sum += np.sin(2 * np.pi * f * tt)
        wave_sum += 0.25 * np.sin(2 * np.pi * f * 2 * tt)
        wave_sum += 0.12 * np.sin(2 * np.pi * f * 0.5 * tt)
    audio[i0:i1] += gain * e * (wave_sum / len(freqs))

audio = np.zeros_like(t)

# Warm, slow progression (Cmaj-ish ambient), low volume
chords = [
    (0.0, 8.0, [130.81, 164.81, 196.00]),      # C3 E3 G3
    (7.5, 8.0, [146.83, 174.61, 220.00]),      # D3 F3 A3
    (15.0, 8.5, [164.81, 196.00, 246.94]),     # E3 G3 B3
    (22.5, 8.5, [130.81, 196.00, 261.63]),     # C3 G3 C4
    (30.0, 10.0, [123.47, 155.56, 185.00]),    # B2 D#3 F#3 soft
    (37.0, 8.0, [130.81, 164.81, 196.00]),
]

for start, length, freqs in chords:
    soft_chord(freqs, start, length, gain=0.038)

# Gentle pink-ish noise bed
rng = np.random.default_rng(7)
noise = rng.normal(0, 1, len(t))
# crude brownish by cumulative sum
noise = np.cumsum(noise)
noise /= np.max(np.abs(noise)) + 1e-9
# slow amplitude LFO
lfo = 0.5 + 0.5 * np.sin(2 * np.pi * 0.05 * t)
audio += 0.008 * noise * lfo

# Soft low drone
audio += 0.02 * np.sin(2 * np.pi * 65.41 * t) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.04 * t))

# Normalize gently
peak = np.max(np.abs(audio)) + 1e-9
audio = 0.35 * audio / peak
pcm = np.int16(np.clip(audio, -1, 1) * 32767)

with wave.open(str(OUT), "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())

print("wrote", OUT, OUT.stat().st_size)

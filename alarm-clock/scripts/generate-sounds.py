#!/usr/bin/env python3
"""Generates the bundled alarm tones in ../assets/sounds.

The tones are synthesised from scratch (stdlib only) so the repository carries
no third-party audio and every waveform is reproducible:

    python3 scripts/generate-sounds.py

Each file is a 16-bit PCM mono WAV at 22.05 kHz built from a whole number of
identical `LOOP_SECONDS` patterns, so it can be looped by the ringing screen
without a click at the seam, and is long enough (`TOTAL_SECONDS`) to be usable
as an Android notification channel sound, which plays the file exactly once.
"""

from __future__ import annotations

import math
import os
import struct
import wave

SAMPLE_RATE = 22_050
LOOP_SECONDS = 3.0
TOTAL_SECONDS = 15.0
AMPLITUDE = 0.82  # headroom below full scale so the mix never clips

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "sounds")


def _envelope(t: float, attack: float, decay: float) -> float:
    """Percussive attack/decay envelope in the 0..1 range."""
    if t < 0:
        return 0.0
    if t < attack:
        return t / attack
    return math.exp(-(t - attack) / decay)


def _sine(freq: float, t: float, phase: float = 0.0) -> float:
    return math.sin(2 * math.pi * freq * t + phase)


def classic_bell(t: float) -> float:
    """Two struck bells per bar; inharmonic partials give the metallic ring."""
    value = 0.0
    for strike in (0.0, 1.5):
        local = t - strike
        if local < 0:
            continue
        env = _envelope(local, 0.004, 0.45)
        if env < 1e-4:
            continue
        value += env * (
            0.55 * _sine(880.0, local)
            + 0.30 * _sine(1320.0, local)
            + 0.18 * _sine(2093.0, local)
            + 0.10 * _sine(2637.0, local)
        )
    return value


def digital_beep(t: float) -> float:
    """The familiar three-pulse digital alarm burst."""
    value = 0.0
    for pulse in (0.0, 0.28, 0.56):
        local = t - pulse
        if not 0 <= local < 0.18:
            continue
        env = _envelope(local, 0.008, 0.06) * (1.0 if local < 0.16 else 0.0)
        # Soft square: fundamental plus odd harmonics, band-limited by hand.
        value += env * (
            0.60 * _sine(1046.5, local)
            + 0.22 * _sine(3139.5, local)
            + 0.10 * _sine(5232.5, local)
        )
    return value


def radar(t: float) -> float:
    """Rising sonar-style sweeps, spaced so they build urgency."""
    value = 0.0
    for pulse in (0.0, 0.75, 1.5):
        local = t - pulse
        if not 0 <= local < 0.55:
            continue
        env = _envelope(local, 0.02, 0.18)
        # Linear chirp 660 Hz -> 1180 Hz over the pulse.
        freq = 660.0 + (520.0 * local / 0.55)
        value += env * (0.7 * _sine(freq, local) + 0.2 * _sine(freq * 2, local))
    return value


def chimes(t: float) -> float:
    """A gentle four-note arpeggio (A4 C#5 E5 A5) for a softer wake-up."""
    value = 0.0
    for index, freq in enumerate((440.0, 554.4, 659.3, 880.0)):
        local = t - index * 0.35
        if local < 0:
            continue
        env = _envelope(local, 0.02, 0.55)
        if env < 1e-4:
            continue
        value += env * (0.5 * _sine(freq, local) + 0.16 * _sine(freq * 2, local))
    return value


def sunrise(t: float) -> float:
    """A slow swelling pad with a light tremolo; the least jarring option."""
    swell = 0.5 - 0.5 * math.cos(2 * math.pi * t / LOOP_SECONDS)
    tremolo = 0.85 + 0.15 * _sine(5.5, t)
    return (
        swell
        * tremolo
        * (
            0.45 * _sine(392.0, t)
            + 0.30 * _sine(587.3, t)
            + 0.18 * _sine(784.0, t)
            + 0.10 * _sine(1174.7, t)
        )
    )


TONES = {
    "classic_bell": classic_bell,
    "digital_beep": digital_beep,
    "radar": radar,
    "chimes": chimes,
    "sunrise": sunrise,
}


def render(name: str, generator) -> str:
    loop_samples = int(SAMPLE_RATE * LOOP_SECONDS)
    repeats = int(round(TOTAL_SECONDS / LOOP_SECONDS))

    bar = []
    peak = 0.0
    for index in range(loop_samples):
        sample = generator(index / SAMPLE_RATE)
        peak = max(peak, abs(sample))
        bar.append(sample)

    gain = AMPLITUDE / peak if peak > 0 else 0.0
    frames = bytearray()
    for sample in bar:
        frames += struct.pack("<h", int(max(-1.0, min(1.0, sample * gain)) * 32767))
    frames *= repeats

    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.normpath(os.path.join(OUT_DIR, f"{name}.wav"))
    with wave.open(path, "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(SAMPLE_RATE)
        handle.writeframes(bytes(frames))
    return path


if __name__ == "__main__":
    for tone_name, tone_generator in TONES.items():
        written = render(tone_name, tone_generator)
        print(f"wrote {written} ({os.path.getsize(written) / 1024:.0f} KB)")

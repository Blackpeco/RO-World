#!/usr/bin/env python3
"""Original instrumental BGM synthesizer for RO-World.
City (cozy capital walk) and Field (lush forest walk). No vocals.
"""
from __future__ import annotations

import os
import subprocess
import wave

import numpy as np

SR = 44100
OUT_DIR = "/workspace/RO-World/assets/bgm"

# ---------------------------------------------------------------------------
# DSP
# ---------------------------------------------------------------------------

def midi_hz(m: float) -> float:
    return 440.0 * (2.0 ** ((m - 69.0) / 12.0))


def adsr(n: int, a: float, d: float, s: float, r: float, sr: int = SR) -> np.ndarray:
    env = np.zeros(n, dtype=np.float64)
    if n < 8:
        env[:] = s
        return env
    na = max(1, int(a * sr))
    nd = max(1, int(d * sr))
    nr = max(1, int(r * sr))
    if na + nd + nr > n:
        scale = n / float(na + nd + nr + 2)
        na = max(1, int(na * scale))
        nd = max(1, int(nd * scale))
        nr = max(1, int(nr * scale))
        while na + nd + nr > n:
            if nr > 1:
                nr -= 1
            elif nd > 1:
                nd -= 1
            elif na > 1:
                na -= 1
            else:
                break
    ns = max(0, n - na - nd - nr)
    env[:na] = np.linspace(0.0, 1.0, na, endpoint=False)
    env[na : na + nd] = np.linspace(1.0, s, nd, endpoint=False)
    if ns:
        env[na + nd : na + nd + ns] = s
    r0 = env[n - nr - 1] if n - nr - 1 >= 0 else s
    env[n - nr :] = np.linspace(r0, 0.0, nr)
    return env


def one_pole_lp(x: np.ndarray, cutoff: float, sr: int = SR) -> np.ndarray:
    x = np.asarray(x, dtype=np.float64)
    if x.size == 0:
        return x
    a = float(np.exp(-2.0 * np.pi * cutoff / sr))
    b = 1.0 - a
    y = np.empty_like(x)
    acc = 0.0
    xi = x
    for i in range(xi.shape[0]):
        acc = b * xi[i] + a * acc
        y[i] = acc
    return y


def one_pole_hp(x: np.ndarray, cutoff: float, sr: int = SR) -> np.ndarray:
    x = np.asarray(x, dtype=np.float64)
    if x.size < 2:
        return x.copy()
    a = float(np.exp(-2.0 * np.pi * cutoff / sr))
    y = np.empty_like(x)
    y[0] = x[0]
    prev_x = x[0]
    prev_y = y[0]
    for i in range(1, x.shape[0]):
        xi = x[i]
        yi = a * (prev_y + xi - prev_x)
        y[i] = yi
        prev_x = xi
        prev_y = yi
    return y


def filter_stereo(stereo: np.ndarray, fn, *args) -> np.ndarray:
    out = np.empty_like(stereo)
    out[0] = fn(stereo[0], *args)
    out[1] = fn(stereo[1], *args)
    return out


def add_at(buf: np.ndarray, start: int, sig: np.ndarray, gain: float = 1.0) -> None:
    if start >= buf.shape[-1] or start < 0:
        return
    n = min(sig.shape[-1], buf.shape[-1] - start)
    if n <= 0:
        return
    if buf.ndim == 1:
        buf[start : start + n] += sig[:n] * gain
    else:
        buf[:, start : start + n] += sig[:, :n] * gain


def pan_mono(mono: np.ndarray, pan: float) -> np.ndarray:
    """Equal-power pan. pan -1=L, 0=C, +1=R. Returns (2, n)."""
    ang = (np.clip(pan, -1.0, 1.0) + 1.0) * 0.25 * np.pi
    left = mono * np.cos(ang)
    right = mono * np.sin(ang)
    return np.vstack([left, right])


def chorus_stereo(mono: np.ndarray, sr: int = SR, delay_ms: float = 15.0,
                  depth_ms: float = 3.2, rate: float = 0.28) -> np.ndarray:
    n = mono.shape[0]
    t = np.arange(n, dtype=np.float64) / sr
    base = delay_ms * 0.001
    depth = depth_ms * 0.001
    d_l = base + depth * np.sin(2.0 * np.pi * rate * t)
    d_r = base * 1.18 + depth * np.sin(2.0 * np.pi * rate * 1.07 * t + 2.1)
    idx = np.arange(n, dtype=np.float64)

    def frac_delay(delay_s: np.ndarray) -> np.ndarray:
        src = idx - delay_s * sr
        src = np.clip(src, 0.0, n - 2.0)
        i0 = src.astype(np.int64)
        frac = src - i0
        return (1.0 - frac) * mono[i0] + frac * mono[i0 + 1]

    dry = 0.62 * mono
    left = dry + 0.38 * frac_delay(d_l)
    right = dry + 0.38 * frac_delay(d_r)
    return np.vstack([left, right])


def multitap_reverb(stereo: np.ndarray, sr: int = SR,
                    taps_s=(0.120, 0.240, 0.360),
                    gains=(0.30, 0.20, 0.14),
                    fb: float = 0.30,
                    mix: float = 0.24) -> np.ndarray:
    assert fb < 0.35
    n = stereo.shape[1]
    send = 0.5 * (stereo[0] + stereo[1])
    acc = send.copy()
    for tap, g in zip(taps_s, gains):
        d = int(tap * sr)
        if 0 < d < n:
            acc[d:] += g * send[:-d]
    d0 = int(taps_s[0] * sr)
    if 0 < d0 < n:
        acc[d0:] += fb * acc[:-d0]
    # light second-pass diffusion, still under feedback cap
    d1 = int(taps_s[1] * sr)
    if 0 < d1 < n:
        acc[d1:] += (fb * 0.45) * acc[:-d1]
    wet = np.zeros_like(stereo)
    spread = int(0.011 * sr)
    wet[0] = acc
    wet[1, spread:] = acc[:-spread]
    wet[1, :spread] = acc[:spread] * 0.25
    return (1.0 - mix) * stereo + mix * wet


def equal_power_loop(stereo: np.ndarray, sr: int = SR, fade_ms: float = 20.0) -> np.ndarray:
    n = int(sr * fade_ms / 1000.0)
    n = min(n, stereo.shape[1] // 8)
    t = np.linspace(0.0, 0.5 * np.pi, n, dtype=np.float64)
    fade_out = np.cos(t)
    fade_in = np.sin(t)
    out = stereo.copy()
    out[:, -n:] = stereo[:, -n:] * fade_out + stereo[:, :n] * fade_in
    # pin the last ~3 ms to sample 0 so the wrap is continuous
    m = max(8, int(0.003 * sr))
    w = np.linspace(0.0, 1.0, m, dtype=np.float64)
    out[:, -m:] = out[:, -m:] * (1.0 - w) + out[:, :1] * w
    return out


def normalize_bgm(stereo: np.ndarray, peak_db: float = -1.2,
                  rms_lo: float = -18.0, rms_hi: float = -16.0) -> np.ndarray:
    x = stereo.astype(np.float64)
    peak = float(np.max(np.abs(x))) + 1e-12
    target_peak = 10.0 ** (peak_db / 20.0)
    x *= target_peak / peak
    rms = float(np.sqrt(np.mean(x * x))) + 1e-12
    rms_db = 20.0 * np.log10(rms)
    target_rms = 0.5 * (rms_lo + rms_hi)  # -17 dBFS
    if rms_db < rms_lo or rms_db > rms_hi:
        x *= 10.0 ** ((target_rms - rms_db) / 20.0)
        peak = float(np.max(np.abs(x))) + 1e-12
        if peak > target_peak:
            # gentle peak control: scale back, accept slightly quieter RMS if needed
            x *= target_peak / peak
            rms = float(np.sqrt(np.mean(x * x))) + 1e-12
            rms_db = 20.0 * np.log10(rms)
            # if still too quiet, soft-clip a tiny bit of makeup
            if rms_db < rms_lo - 0.4:
                makeup = 10.0 ** ((rms_lo + 0.2 - rms_db) / 20.0)
                x *= makeup
                # tanh soft clip around target peak
                x = target_peak * np.tanh(x / target_peak)
    return x


def write_wav(path: str, stereo: np.ndarray, sr: int = SR) -> None:
    n = stereo.shape[1]
    interleaved = np.empty(n * 2, dtype=np.float64)
    interleaved[0::2] = stereo[0]
    interleaved[1::2] = stereo[1]
    pcm = np.clip(interleaved, -1.0, 1.0)
    i16 = (pcm * 32767.0).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(i16.tobytes())


# ---------------------------------------------------------------------------
# Instruments
# ---------------------------------------------------------------------------

def karplus_strong(freq: float, n: int, sr: int, decay: float, damp: float,
                   brightness: float, rng: np.random.Generator) -> np.ndarray:
    period = max(2, int(round(sr / max(freq, 30.0))))
    burst = rng.standard_normal(period).astype(np.float64)
    burst -= burst.mean()
    pos = max(1, int(period * 0.17))
    shape = np.empty(period, dtype=np.float64)
    shape[:pos] = np.linspace(0.0, 1.0, pos)
    shape[pos:] = np.linspace(1.0, 0.0, period - pos)
    burst = brightness * burst + (1.0 - brightness) * shape
    mx = np.max(np.abs(burst)) + 1e-12
    burst /= mx
    n_periods = int(np.ceil(n / period)) + 1
    out = np.empty(n_periods * period, dtype=np.float64)
    buf = burst.copy()
    damp = float(np.clip(damp, 0.05, 0.95))
    for i in range(n_periods):
        out[i * period : (i + 1) * period] = buf
        nxt = np.roll(buf, -1)
        buf = decay * ((1.0 - damp) * buf + damp * nxt)
    return out[:n]


def harmonic_pluck(freq: float, n: int, sr: int, n_harm: int, decay: float,
                   inharm: float = 0.00022) -> np.ndarray:
    t = np.arange(n, dtype=np.float64) / sr
    sig = np.zeros(n, dtype=np.float64)
    att = 1.0 - np.exp(-t * 650.0)
    for k in range(1, n_harm + 1):
        fk = freq * k * (1.0 + inharm * k * k)
        amp = 1.0 / (k ** 0.82)
        d = decay * (1.0 + 0.32 * (k - 1))
        sig += amp * np.sin(2.0 * np.pi * fk * t) * np.exp(-d * t)
    return sig * att


def lute(freq: float, dur: float, sr: int, vel: float, rng: np.random.Generator,
         kind: str = "melody") -> np.ndarray:
    n = max(8, int(dur * sr))
    if kind == "melody":
        decay_ks, damp, bright, h_decay, n_harm, mix_ks = 0.9926, 0.42, 0.72, 3.6, 9, 0.52
    elif kind == "arp":
        decay_ks, damp, bright, h_decay, n_harm, mix_ks = 0.9910, 0.50, 0.58, 4.4, 7, 0.60
    else:
        decay_ks, damp, bright, h_decay, n_harm, mix_ks = 0.9948, 0.55, 0.40, 2.4, 6, 0.48
    ks = karplus_strong(freq, n, sr, decay_ks, damp, bright, rng)
    hp = harmonic_pluck(freq, n, sr, n_harm, h_decay)
    # match levels
    ks *= 1.0 / (np.max(np.abs(ks)) + 1e-12)
    hp *= 1.0 / (np.max(np.abs(hp)) + 1e-12)
    sig = mix_ks * ks + (1.0 - mix_ks) * hp
    env = adsr(n, 0.004, 0.045, 0.55, min(0.18, max(0.06, dur * 0.28)))
    sig *= env * vel
    return sig


def warm_pad_partial(freq: float, n: int, sr: int, detune: float, phase: float) -> np.ndarray:
    t = np.arange(n, dtype=np.float64) / sr
    f1 = freq * (2.0 ** (-detune / 1200.0))
    f2 = freq * (2.0 ** (detune / 1200.0))
    s = 0.48 * np.sin(2.0 * np.pi * f1 * t + phase) + 0.48 * np.sin(2.0 * np.pi * f2 * t + phase * 1.3)
    tri_ph = (freq * 1.004 * t + phase * 0.2) % 1.0
    tri = 2.0 * np.abs(2.0 * tri_ph - 1.0) - 1.0
    shimmer = 1.0 + 0.035 * np.sin(2.0 * np.pi * 0.17 * t + phase)
    return (s + 0.16 * tri) * shimmer


def bass_tone(freq: float, n: int, sr: int, vel: float) -> np.ndarray:
    t = np.arange(n, dtype=np.float64) / sr
    tri = 2.0 * np.abs(2.0 * ((freq * t) % 1.0) - 1.0) - 1.0
    sig = 0.84 * np.sin(2.0 * np.pi * freq * t) + 0.16 * tri
    env = adsr(n, 0.012, 0.10, 0.62, 0.14)
    return sig * env * vel


def flute(freq: float, dur: float, sr: int, vel: float, rng: np.random.Generator) -> np.ndarray:
    n = max(8, int(dur * sr))
    t = np.arange(n, dtype=np.float64) / sr
    vib_env = np.clip((t - 0.16) / 0.28, 0.0, 1.0)
    vib = 1.0 + 0.0065 * vib_env * np.sin(2.0 * np.pi * 5.05 * t)
    phase = np.cumsum(2.0 * np.pi * freq * vib / sr)
    sig = np.sin(phase) + 0.22 * np.sin(2.0 * phase) + 0.07 * np.sin(3.0 * phase)
    breath = rng.standard_normal(n).astype(np.float64)
    atk_n = np.exp(-t * 14.0) * (1.0 - np.exp(-t * 70.0))
    sig = sig + 0.055 * breath * atk_n
    rel = min(0.28, max(0.10, dur * 0.32))
    env = adsr(n, 0.055, 0.14, 0.74, rel)
    return sig * env * vel


def woodblock(sr: int, rng: np.random.Generator, vel: float = 0.35) -> np.ndarray:
    dur = 0.075
    n = int(dur * sr)
    t = np.arange(n, dtype=np.float64) / sr
    env = np.exp(-t * 58.0) * (1.0 - np.exp(-t * 380.0))
    sig = 0.68 * np.sin(2.0 * np.pi * 910.0 * t) + 0.32 * np.sin(2.0 * np.pi * 1420.0 * t)
    noise = rng.standard_normal(n).astype(np.float64) * np.exp(-t * 90.0)
    return (sig * env + 0.22 * noise) * vel


def tambourine(sr: int, rng: np.random.Generator, vel: float = 0.22) -> np.ndarray:
    dur = 0.13
    n = int(dur * sr)
    t = np.arange(n, dtype=np.float64) / sr
    env = np.exp(-t * 26.0)
    noise = rng.standard_normal(n).astype(np.float64)
    hp = np.diff(noise, prepend=noise[:1])
    jingle = np.zeros(n, dtype=np.float64)
    for f in (4180.0, 5360.0, 6720.0, 8040.0):
        jingle += np.sin(2.0 * np.pi * f * t + rng.uniform(0, 6.28))
    jingle *= np.exp(-t * 16.0)
    return (0.62 * hp + 0.18 * jingle) * env * vel


def bird_chirp(sr: int, rng: np.random.Generator) -> np.ndarray:
    dur = float(rng.uniform(0.07, 0.15))
    n = int(dur * sr)
    t = np.arange(n, dtype=np.float64) / sr
    f0 = float(rng.uniform(2200.0, 3100.0))
    f1 = f0 + float(rng.uniform(350.0, 900.0))
    # up then a little down
    mid = 0.62
    f = np.where(
        t < mid * dur,
        f0 + (f1 - f0) * (t / (mid * dur)),
        f1 + (f0 + 80.0 - f1) * ((t - mid * dur) / ((1.0 - mid) * dur + 1e-9)),
    )
    phase = np.cumsum(2.0 * np.pi * f / sr)
    env = np.sin(np.pi * t / dur) ** 1.35
    return 0.11 * np.sin(phase) * env


# ---------------------------------------------------------------------------
# Composition helpers
# ---------------------------------------------------------------------------

def eighths_to_events(bars, eighth=0.5):
    """None after a pitch = hold; None at start of a run = rest."""
    flat = []
    for bar in bars:
        flat.extend(bar)
    events = []
    beat = 0.0
    i = 0
    while i < len(flat):
        p = flat[i]
        if p is None:
            beat += eighth
            i += 1
            continue
        dur = eighth
        j = i + 1
        while j < len(flat) and flat[j] is None:
            dur += eighth
            j += 1
        events.append((beat, dur, int(p)))
        beat += dur
        i = j
    return events


def beats_to_samples(beat: float, bpm: float, sr: int = SR) -> int:
    return int(beat * (60.0 / bpm) * sr)


# ---------------------------------------------------------------------------
# CITY — C major, 92 BPM, 16 bars, I–vi–IV–V | I–vi–IV–I
# ---------------------------------------------------------------------------

CITY_BPM = 92.0
CITY_BARS = 16

# two bars per chord
CITY_CHORDS = [
    # (start_bar, n_bars, midi chord tones for pad, bass root, bass fifth)
    (0, 2, [48, 52, 55, 60, 64], 36, 43),   # C
    (2, 2, [45, 48, 52, 57, 60], 33, 40),   # Am
    (4, 2, [41, 45, 48, 53, 57], 29, 36),   # F
    (6, 2, [43, 47, 50, 55, 59], 31, 38),   # G
    (8, 2, [48, 52, 55, 60, 64], 36, 43),   # C
    (10, 2, [45, 48, 52, 57, 60], 33, 40),  # Am
    (12, 2, [41, 45, 48, 53, 57], 29, 36),  # F
    (14, 2, [48, 52, 55, 60, 64], 36, 43),  # C  (loop tonic)
]

CITY_MELODY = [
    [72, 74, 76, 74, 72, 67, 69, 71],
    [72, None, 76, 74, 72, 69, 67, None],
    [69, 71, 72, 76, 74, 72, 69, 67],
    [69, None, 72, 71, 69, 65, 64, None],
    [65, 67, 69, 72, 71, 69, 65, 64],
    [65, None, 69, 67, 65, 64, 62, None],
    [67, 69, 71, 74, 72, 71, 67, 65],
    [67, None, 71, 69, 67, 64, 62, 67],
    [72, 74, 76, 79, 76, 74, 72, 71],
    [72, None, 76, 74, 72, 67, 64, None],
    [69, 72, 76, 74, 72, 69, 67, 65],
    [64, 65, 67, 69, 72, 69, 67, None],
    [65, 69, 72, 76, 74, 72, 69, 67],
    [65, None, 64, 62, 60, 62, 64, 65],
    [67, 69, 72, 76, 74, 72, 69, 67],
    [64, 62, 60, None, 60, None, None, None],
]

# quieter answering voice, second half only (bars 8-15 in 0-index via None pads)
CITY_HARMONY = [
    [None] * 8,
    [None] * 8,
    [None] * 8,
    [None] * 8,
    [None] * 8,
    [None] * 8,
    [None] * 8,
    [None] * 8,
    [67, 69, 72, 76, 72, 71, 67, 65],
    [67, None, 72, 71, 67, 64, 60, None],
    [64, 67, 72, 71, 69, 64, 62, 60],
    [60, 62, 64, 65, 69, 65, 64, None],
    [60, 65, 69, 72, 71, 69, 65, 64],
    [60, None, 60, 57, 53, 55, 57, 60],
    [64, 65, 69, 72, 71, 69, 65, 64],
    [60, 59, 55, None, 48, None, None, None],
]

CITY_ARP = {
    0: [48, 55, 60, 64, 67, 64, 60, 55],  # C
    2: [45, 52, 57, 60, 64, 60, 57, 52],  # Am
    4: [41, 48, 53, 57, 60, 57, 53, 48],  # F
    6: [43, 50, 55, 59, 62, 59, 55, 50],  # G
    8: [48, 55, 60, 64, 67, 64, 60, 55],
    10: [45, 52, 57, 60, 64, 60, 57, 52],
    12: [41, 48, 53, 57, 60, 57, 53, 48],
    14: [48, 55, 60, 64, 67, 64, 60, 55],
}


# ---------------------------------------------------------------------------
# FIELD — A dorian, 72 BPM, 16 bars, i–VII–IV–i | i–VII–IV–i
# ---------------------------------------------------------------------------

FIELD_BPM = 72.0
FIELD_BARS = 16

FIELD_CHORDS = [
    (0, 2, [45, 52, 57, 60, 64], 33, 40),   # Am
    (2, 2, [43, 50, 55, 59, 62], 31, 38),   # G
    (4, 2, [38, 45, 50, 54, 57], 26, 33),   # D
    (6, 2, [45, 52, 57, 60, 64], 33, 40),   # Am
    (8, 2, [45, 52, 57, 60, 64], 33, 40),   # Am
    (10, 2, [43, 50, 55, 59, 62], 31, 38),  # G
    (12, 2, [38, 45, 50, 54, 57], 26, 33),  # D
    (14, 2, [45, 52, 57, 60, 64], 33, 40),  # Am
]

FIELD_MELODY = [
    [69, None, 72, 74, 76, 74, 72, None],
    [69, 67, 64, None, 62, 64, 67, 69],
    [67, None, 71, 74, 72, 71, 67, None],
    [67, 64, 62, None, 60, 62, 64, 67],
    [74, None, 76, 74, 71, 69, 67, None],
    [66, 64, 62, None, 64, 66, 69, 67],
    [69, None, 72, 76, 74, 72, 69, None],
    [67, 64, 62, 64, 69, None, None, None],
    [81, None, 79, 76, 74, 76, 72, None],
    [69, 72, 74, 76, 74, 72, 69, 67],
    [67, None, 69, 71, 74, 72, 71, 67],
    [64, 67, 69, 71, 67, 64, 62, None],
    [62, 66, 69, 74, 76, 74, 69, 66],
    [62, None, 64, 66, 67, 69, 67, 64],
    [69, 72, 76, 74, 72, 69, 67, 64],
    [62, 64, 67, 64, 69, None, None, None],
]

FIELD_ARP = {
    0: [45, 57, 60, 64],
    2: [43, 55, 59, 62],
    4: [38, 50, 54, 57],
    6: [45, 57, 60, 64],
    8: [45, 57, 60, 64],
    10: [43, 55, 59, 62],
    12: [38, 50, 54, 57],
    14: [45, 57, 60, 64],
}

# sparse bird onsets in beats (64 beats total)
FIELD_BIRDS = (6.35, 14.8, 21.4, 29.15, 37.6, 46.25, 53.9, 58.2)


# ---------------------------------------------------------------------------
# Renderers
# ---------------------------------------------------------------------------

def render_city(rng: np.random.Generator) -> np.ndarray:
    bpm = CITY_BPM
    beats_total = CITY_BARS * 4.0
    n_loop = beats_to_samples(beats_total, bpm)
    PRE = int(0.45 * SR)
    n = n_loop + PRE
    beat_s = 60.0 / bpm

    melody_l = np.zeros(n, dtype=np.float64)
    melody_h = np.zeros(n, dtype=np.float64)
    arp = np.zeros(n, dtype=np.float64)
    bass = np.zeros(n, dtype=np.float64)
    pad_m = np.zeros(n, dtype=np.float64)
    perc_l = np.zeros(n, dtype=np.float64)
    perc_r = np.zeros(n, dtype=np.float64)

    # pads — overlap 180 ms between chords, short attack so loop ends match
    overlap = 0.18
    for start_bar, n_bars, tones, *_ in CITY_CHORDS:
        start = beats_to_samples(start_bar * 4.0, bpm) + PRE
        dur_s = n_bars * 4.0 * beat_s + overlap
        if start_bar == 0:
            start = 0
            dur_s += PRE / float(SR)
        nn = int(dur_s * SR)
        chord = np.zeros(nn, dtype=np.float64)
        for i, m in enumerate(tones):
            w = 1.0 if i < 3 else 0.72
            chord += w * warm_pad_partial(midi_hz(m), nn, SR, detune=8.5 + 0.4 * i, phase=0.4 * i)
        chord /= max(3.2, len(tones) * 0.72)
        env = adsr(nn, 0.045, 0.20, 0.88, 0.20)
        add_at(pad_m, start, chord * env, 0.25)

    # bass: half notes, root then fifth each bar
    for start_bar, n_bars, _tones, root, fifth in CITY_CHORDS:
        for b in range(n_bars):
            bar_beat = (start_bar + b) * 4.0
            for k, note in enumerate((root, fifth)):
                st = beats_to_samples(bar_beat + k * 2.0, bpm) + PRE + int(0.012 * SR)
                dur = 2.0 * beat_s * 0.94
                nn = int(dur * SR)
                add_at(bass, st, bass_tone(midi_hz(note), nn, SR, 0.70), 1.0)

    # lute arpeggios — 8ths
    for start_bar, pattern in CITY_ARP.items():
        for b in range(2):
            for i, m in enumerate(pattern):
                beat = (start_bar + b) * 4.0 + i * 0.5
                st = beats_to_samples(beat, bpm) + PRE + int(0.028 * SR)
                jitter = int(rng.integers(-90, 90))
                st = max(0, st + jitter)
                dur = 0.42
                vel = 0.30 + 0.08 * (1.0 if i % 4 == 0 else 0.7)
                vel *= float(rng.uniform(0.92, 1.06))
                add_at(arp, st, lute(midi_hz(m), dur, SR, vel, rng, "arp"), 1.0)

    # melody
    for beat, dur_b, m in eighths_to_events(CITY_MELODY):
        st = beats_to_samples(beat, bpm) + PRE + int(0.028 * SR)
        st = max(0, st + int(rng.integers(-70, 70)))
        dur = dur_b * beat_s * 0.96 + 0.04
        vel = 0.78 if dur_b >= 1.0 else 0.70
        add_at(melody_l, st, lute(midi_hz(m), dur, SR, vel, rng, "melody"), 1.0)

    for beat, dur_b, m in eighths_to_events(CITY_HARMONY):
        st = beats_to_samples(beat, bpm) + PRE
        dur = dur_b * beat_s * 0.95 + 0.03
        add_at(melody_h, st, lute(midi_hz(m), dur, SR, 0.38, rng, "arp"), 1.0)

    # woodblock 2 & 4, tambourine light ands
    for bar in range(CITY_BARS):
        for beat_off, which in ((1.0, "wb"), (3.0, "wb"), (1.5, "tb"), (3.5, "tb")):
            st = beats_to_samples(bar * 4.0 + beat_off, bpm) + PRE + int(0.020 * SR)
            if which == "wb":
                vel = 0.28 if beat_off == 1.0 else 0.22
                add_at(perc_l, st, woodblock(SR, rng, vel), 1.0)
            else:
                if bar % 2 == 0:
                    add_at(perc_r, st, tambourine(SR, rng, 0.13), 1.0)

    # mix to stereo
    pad_st = chorus_stereo(pad_m, SR, delay_ms=14.5, depth_ms=3.0, rate=0.26)
    mix = np.zeros((2, n), dtype=np.float64)
    mix += pad_st
    mix += pan_mono(bass, 0.0) * 0.78
    mix += pan_mono(arp, -0.28) * 0.95
    mix += pan_mono(melody_l, 0.16) * 1.05
    mix += pan_mono(melody_h, -0.12) * 0.85
    mix += pan_mono(perc_l, -0.35) * 0.55
    mix += pan_mono(perc_r, 0.42) * 0.40
    # slight extra delay on pad already applied; melody hair of delay R
    dly = int(0.009 * SR)
    delayed = np.zeros_like(mix)
    delayed[1, dly:] = mix[0, :-dly] * 0.08
    mix += delayed

    mix = filter_stereo(mix, one_pole_hp, 42.0, SR)
    mix = filter_stereo(mix, one_pole_lp, 8200.0, SR)
    mix = multitap_reverb(mix, SR, fb=0.28, mix=0.22)
    mix = mix[:, PRE:PRE + n_loop]
    mix = equal_power_loop(mix, SR, 20.0)
    mix = normalize_bgm(mix)
    return mix


def render_field(rng: np.random.Generator) -> np.ndarray:
    bpm = FIELD_BPM
    beats_total = FIELD_BARS * 4.0
    n_loop = beats_to_samples(beats_total, bpm)
    PRE = int(0.50 * SR)
    n = n_loop + PRE
    beat_s = 60.0 / bpm

    flute_m = np.zeros(n, dtype=np.float64)
    harp = np.zeros(n, dtype=np.float64)
    bass = np.zeros(n, dtype=np.float64)
    pad_m = np.zeros(n, dtype=np.float64)
    birds = np.zeros((2, n), dtype=np.float64)
    air = rng.standard_normal(n).astype(np.float64) * 0.012
    air = one_pole_hp(air, 800.0, SR)
    air = one_pole_lp(air, 2800.0, SR)
    air *= adsr(n, 0.4, 0.2, 0.85, 0.4)

    overlap = 0.28
    for start_bar, n_bars, tones, *_ in FIELD_CHORDS:
        start = beats_to_samples(start_bar * 4.0, bpm) + PRE
        dur_s = n_bars * 4.0 * beat_s + overlap
        if start_bar == 0:
            start = 0
            dur_s += PRE / float(SR)
        nn = int(dur_s * SR)
        chord = np.zeros(nn, dtype=np.float64)
        for i, m in enumerate(tones):
            w = 1.0 if i < 3 else 0.65
            chord += w * warm_pad_partial(midi_hz(m), nn, SR, detune=11.0 + 0.5 * i, phase=0.7 * i)
        chord /= max(3.4, len(tones) * 0.75)
        env = adsr(nn, 0.10, 0.32, 0.68, 0.30)
        add_at(pad_m, start, chord * env, 0.08)

    for start_bar, n_bars, _tones, root, fifth in FIELD_CHORDS:
        for b in range(n_bars):
            bar_beat = (start_bar + b) * 4.0
            # whole-note-ish root, ghost fifth on beat 3
            st = beats_to_samples(bar_beat, bpm) + PRE
            add_at(bass, st, bass_tone(midi_hz(root), int(3.6 * beat_s * SR), SR, 0.48), 1.0)
            st2 = beats_to_samples(bar_beat + 2.0, bpm) + PRE
            add_at(bass, st2, bass_tone(midi_hz(fifth), int(1.7 * beat_s * SR), SR, 0.28), 1.0)

    # slow rolled harp: 4 notes per bar (quarters)
    for start_bar, pattern in FIELD_ARP.items():
        for b in range(2):
            for i, m in enumerate(pattern):
                beat = (start_bar + b) * 4.0 + i * 1.0
                st = beats_to_samples(beat, bpm) + PRE
                st = max(0, st + int(rng.integers(-40, 120)))  # slight roll
                dur = 1.15
                vel = 0.42 if i else 0.58
                add_at(harp, st, lute(midi_hz(m), dur, SR, vel, rng, "arp"), 1.0)

    for beat, dur_b, m in eighths_to_events(FIELD_MELODY):
        st = beats_to_samples(beat, bpm) + PRE
        dur = dur_b * beat_s * 0.98 + 0.06
        vel = 0.62 if dur_b >= 1.0 else 0.54
        add_at(flute_m, st, flute(midi_hz(m), dur, SR, vel, rng), 1.0)

    for bbeat in FIELD_BIRDS:
        if bbeat < 1.2 or bbeat > beats_total - 1.4:
            continue
        st = beats_to_samples(bbeat, bpm) + PRE
        chirp = bird_chirp(SR, rng)
        pan = float(rng.uniform(-0.75, 0.75))
        add_at(birds, st, pan_mono(chirp, pan), 1.0)

    pad_st = chorus_stereo(pad_m, SR, delay_ms=17.0, depth_ms=4.0, rate=0.19)
    bed = np.zeros((2, n), dtype=np.float64)
    bed += pad_st
    bed += pan_mono(bass, 0.0) * 0.24
    bed += pan_mono(flute_m, 0.10) * 0.70
    bed += pan_mono(air, 0.0) * 0.28
    dly = int(0.013 * SR)
    delayed = np.zeros_like(bed)
    delayed[1, dly:] = bed[0, :-dly] * 0.10
    bed += delayed
    bed = filter_stereo(bed, one_pole_hp, 38.0, SR)
    bed = filter_stereo(bed, one_pole_lp, 6200.0, SR)
    bed = multitap_reverb(bed, SR, fb=0.26, mix=0.20)

    pluck = pan_mono(harp, -0.22) * 2.10
    pluck = filter_stereo(pluck, one_pole_hp, 60.0, SR)
    mix = bed + pluck + birds * 1.20
    mix = mix[:, PRE:PRE + n_loop]
    mix = equal_power_loop(mix, SR, 20.0)
    mix = normalize_bgm(mix)
    return mix


def encode_ogg(wav_path: str, ogg_path: str) -> None:
    cmd = [
        "/usr/bin/ffmpeg", "-y", "-i", wav_path,
        "-c:a", "libvorbis", "-q:a", "5", ogg_path,
    ]
    subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def analyze(stereo: np.ndarray) -> dict:
    peak = float(np.max(np.abs(stereo)))
    rms = float(np.sqrt(np.mean(stereo * stereo)))
    return {
        "dur": stereo.shape[1] / float(SR),
        "peak_db": 20.0 * np.log10(peak + 1e-12),
        "rms_db": 20.0 * np.log10(rms + 1e-12),
        "channels": 2,
    }


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    rng_city = np.random.default_rng(20260826)
    rng_field = np.random.default_rng(20260827)

    print("Rendering city...")
    city = render_city(rng_city)
    print("city", analyze(city))
    print("Rendering field...")
    field = render_field(rng_field)
    print("field", analyze(field))

    city_wav = os.path.join(OUT_DIR, "_city.wav")
    field_wav = os.path.join(OUT_DIR, "_field.wav")
    city_ogg = os.path.join(OUT_DIR, "city.ogg")
    field_ogg = os.path.join(OUT_DIR, "field.ogg")
    write_wav(city_wav, city)
    write_wav(field_wav, field)
    print("Encoding ogg...")
    encode_ogg(city_wav, city_ogg)
    encode_ogg(field_wav, field_ogg)
    for p in (city_wav, field_wav):
        try:
            os.remove(p)
        except OSError:
            pass
    for p in (city_ogg, field_ogg):
        print(p, os.path.getsize(p), "bytes")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Original RO-World combat SFX — numpy synthesis, no sampled copyright material."""
from __future__ import annotations

import os
import struct
import subprocess
import wave

import numpy as np

SR = 44100
PEAK = 10 ** (-1.0 / 20.0)  # -1 dBFS
RNG = np.random.default_rng(20260826)
OUT_DIR = "/workspace/RO-World/assets/sfx"
WAV_DIR = "/tmp/ro-sfx-wav"


# ---------------------------------------------------------------------------
# Core DSP
# ---------------------------------------------------------------------------

def n_samples(dur: float) -> int:
    return max(1, int(round(dur * SR)))


def t_axis(n: int) -> np.ndarray:
    return np.arange(n, dtype=np.float64) / SR


def zeros(dur: float) -> np.ndarray:
    return np.zeros(n_samples(dur), dtype=np.float64)


def exp_env(n: int, tau: float, start: float = 1.0) -> np.ndarray:
    t = t_axis(n)
    return start * np.exp(-t / max(tau, 1e-6))


def lin_env(n: int, a: float, b: float) -> np.ndarray:
    return np.linspace(a, b, n, dtype=np.float64)


def perc_env(n: int, attack: float, decay: float) -> np.ndarray:
    """Fast attack + exponential decay, length n."""
    na = min(n - 1, n_samples(attack))
    env = np.zeros(n, dtype=np.float64)
    if na > 0:
        env[:na] = np.linspace(0.0, 1.0, na, dtype=np.float64)
    rem = n - na
    env[na:] = exp_env(rem, decay)
    return env


def fade_edges(x: np.ndarray, fade_in: float = 0.002, fade_out: float = 0.04) -> np.ndarray:
    y = x.copy()
    ni = min(len(y) - 1, n_samples(fade_in))
    no = min(len(y) - 1, n_samples(fade_out))
    if ni > 0:
        y[:ni] *= np.linspace(0.0, 1.0, ni)
    if no > 0:
        y[-no:] *= np.linspace(1.0, 0.0, no)
    return y


def apply_biquad(x: np.ndarray, b0, b1, b2, a1, a2) -> np.ndarray:
    y = np.empty_like(x)
    x1 = x2 = y1 = y2 = 0.0
    for i, xi in enumerate(x):
        yn = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1 = x1, xi
        y2, y1 = y1, yn
        y[i] = yn
    return y


def rbj_lowpass(x: np.ndarray, fc: float, q: float = 0.707) -> np.ndarray:
    fc = float(np.clip(fc, 20.0, SR * 0.45))
    w0 = 2.0 * np.pi * fc / SR
    alpha = np.sin(w0) / (2.0 * q)
    c = np.cos(w0)
    b0 = (1.0 - c) * 0.5
    b1 = 1.0 - c
    b2 = (1.0 - c) * 0.5
    a0 = 1.0 + alpha
    a1 = -2.0 * c
    a2 = 1.0 - alpha
    return apply_biquad(x, b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0)


def rbj_highpass(x: np.ndarray, fc: float, q: float = 0.707) -> np.ndarray:
    fc = float(np.clip(fc, 20.0, SR * 0.45))
    w0 = 2.0 * np.pi * fc / SR
    alpha = np.sin(w0) / (2.0 * q)
    c = np.cos(w0)
    b0 = (1.0 + c) * 0.5
    b1 = -(1.0 + c)
    b2 = (1.0 + c) * 0.5
    a0 = 1.0 + alpha
    a1 = -2.0 * c
    a2 = 1.0 - alpha
    return apply_biquad(x, b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0)


def rbj_bandpass(x: np.ndarray, fc: float, q: float = 2.0) -> np.ndarray:
    fc = float(np.clip(fc, 20.0, SR * 0.45))
    w0 = 2.0 * np.pi * fc / SR
    alpha = np.sin(w0) / (2.0 * q)
    c = np.cos(w0)
    b0 = alpha
    b1 = 0.0
    b2 = -alpha
    a0 = 1.0 + alpha
    a1 = -2.0 * c
    a2 = 1.0 - alpha
    return apply_biquad(x, b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0)


def white(n: int) -> np.ndarray:
    return RNG.standard_normal(n).astype(np.float64)


def pinkish(n: int) -> np.ndarray:
    """Very cheap 1/f-ish noise via stacked one-pole-ish lows."""
    x = white(n)
    return rbj_lowpass(x, 1800.0, 0.6) + 0.35 * rbj_lowpass(x, 400.0, 0.5)


def sine_phase(n: int, freq, phase: float = 0.0) -> np.ndarray:
    """freq may be scalar or per-sample array."""
    t = t_axis(n)
    if np.isscalar(freq):
        return np.sin(2.0 * np.pi * float(freq) * t + phase)
    inst = np.cumsum(np.asarray(freq, dtype=np.float64) / SR)
    return np.sin(2.0 * np.pi * inst + phase)


def chirp(n: int, f0: float, f1: float, curve: float = 1.0) -> np.ndarray:
    t = t_axis(n)
    dur = n / SR
    u = (t / max(dur, 1e-9)) ** curve
    freq = f0 + (f1 - f0) * u
    return sine_phase(n, freq)


def fm_tone(n: int, fc, fm_hz: float, index, phase: float = 0.0) -> np.ndarray:
    t = t_axis(n)
    if np.isscalar(fc):
        fc = np.full(n, float(fc))
    if np.isscalar(index):
        index = np.full(n, float(index))
    inst_c = np.cumsum(np.asarray(fc, dtype=np.float64) / SR)
    mod = np.sin(2.0 * np.pi * fm_hz * t)
    return np.sin(2.0 * np.pi * inst_c + index * mod + phase)


def decaying_sine(n: int, freq: float, tau: float, phase: float = 0.0) -> np.ndarray:
    return sine_phase(n, freq, phase) * exp_env(n, tau)


def karplus_strong(n: int, freq: float, decay: float = 0.985, stretch: float = 0.5) -> np.ndarray:
    period = max(2, int(round(SR / max(freq, 20.0))))
    buf = white(period)
    buf = buf - buf.mean()
    out = np.empty(n, dtype=np.float64)
    idx = 0
    prev = 0.0
    for i in range(n):
        cur = buf[idx]
        out[i] = cur
        avg = stretch * cur + (1.0 - stretch) * prev
        buf[idx] = avg * decay
        prev = cur
        idx += 1
        if idx >= period:
            idx = 0
    return out


def impulse_click(n: int, bright: float = 0.5) -> np.ndarray:
    x = np.zeros(n, dtype=np.float64)
    x[0] = 1.0
    x[1] = 0.35 * bright
    if n > 2:
        x[2] = -0.15 * bright
    # tiny noise burst for body
    k = min(n, n_samples(0.004))
    x[:k] += 0.25 * bright * white(k) * perc_env(k, 0.0003, 0.002)
    return x


def formant_noise(n: int, f1: float, f2: float, f3: float | None = None) -> np.ndarray:
    src = white(n)
    y = 0.7 * rbj_bandpass(src, f1, 6.0) + 0.45 * rbj_bandpass(src, f2, 5.0)
    if f3 is not None:
        y = y + 0.25 * rbj_bandpass(src, f3, 4.0)
    return y


def place(dst: np.ndarray, src: np.ndarray, t0: float, gain: float = 1.0) -> None:
    i0 = int(round(t0 * SR))
    if i0 >= len(dst) or i0 < 0:
        return
    i1 = min(len(dst), i0 + len(src))
    dst[i0:i1] += gain * src[: i1 - i0]


def stereo_from_mono(x: np.ndarray, width: float = 0.12, delay_s: float = 0.0006) -> np.ndarray:
    """Subtle Haas + opposite-phase air for width; still sums cleanly."""
    d = n_samples(delay_s)
    L = x.copy()
    R = np.zeros_like(x)
    if d > 0 and d < len(x):
        R[d:] = x[:-d]
        R[:d] = x[:d] * 0.2
    else:
        R = x.copy()
    # tiny decorrelated air
    air = rbj_highpass(white(len(x)), 4000.0) * 0.012
    L = L + width * 0.15 * (x - R) + air
    R = R - width * 0.15 * (x - R) - air * 0.7
    return np.stack([L, R], axis=1)


def dc_block(x: np.ndarray) -> np.ndarray:
    if x.ndim == 1:
        return x - np.mean(x)
    return x - np.mean(x, axis=0, keepdims=True)


def normalize_peak(x: np.ndarray, peak_db: float = -1.0) -> np.ndarray:
    target = 10 ** (peak_db / 20.0)
    peak = float(np.max(np.abs(x)))
    if peak < 1e-12:
        return x
    return x * (target / peak)


def true_peak_normalize(x: np.ndarray, peak_db: float = -1.05) -> np.ndarray:
    """Scale so 4x-interpolated true peak sits at peak_db (stereo last-axis)."""
    target = 10 ** (peak_db / 20.0)
    if x.ndim == 1:
        x = x.reshape(-1, 1)
        squeeze = True
    else:
        squeeze = False
    n, ch = x.shape
    t_lo = np.arange(n, dtype=np.float64)
    t_hi = np.arange(n * 4, dtype=np.float64) / 4.0
    tp = 0.0
    for c in range(ch):
        up = np.interp(t_hi, t_lo, x[:, c])
        tp = max(tp, float(np.max(np.abs(up))))
    sample_peak = float(np.max(np.abs(x)))
    peak = max(tp, sample_peak)
    if peak < 1e-12:
        y = x
    else:
        y = x * (target / peak)
    return y[:, 0] if squeeze else y


def finish(x: np.ndarray, fade_out: float, width: float = 0.14, headroom_db: float = -1.05) -> np.ndarray:
    x = dc_block(x)
    x = fade_edges(x, fade_in=0.0015, fade_out=max(fade_out, 0.05))
    tail = n_samples(0.025)
    if tail < len(x):
        x[-tail:] *= np.linspace(1.0, 0.0, tail) ** 2
    x[-16:] = 0.0
    st = stereo_from_mono(x, width=width)
    st = dc_block(st)
    st = true_peak_normalize(st, headroom_db)
    st = np.clip(st, -PEAK, PEAK)
    st[-16:] = 0.0
    return st


def write_wav(path: str, audio: np.ndarray) -> None:
    # float64 stereo -> int16
    pcm = np.clip(audio, -1.0, 1.0)
    pcm_i16 = (pcm * 32767.0).astype(np.int16)
    nch = 2 if pcm_i16.ndim == 2 else 1
    with wave.open(path, "wb") as w:
        w.setnchannels(nch)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm_i16.tobytes())


def encode_ogg(wav_path: str, ogg_path: str) -> None:
    subprocess.check_call(
        ["/usr/bin/ffmpeg", "-y", "-i", wav_path, "-c:a", "libvorbis", "-q:a", "4", ogg_path],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


# ---------------------------------------------------------------------------
# Sound designs
# ---------------------------------------------------------------------------

def sfx_hit_slash() -> np.ndarray:
    """Metallic sword clang + short flesh/jelly thud. Body done ~180ms, dead by 260ms."""
    dur = 0.255
    out = zeros(dur)
    n = len(out)

    # --- transient clang (0-25ms) ---
    click = impulse_click(n_samples(0.018), bright=0.9)
    click = rbj_highpass(click, 800.0)
    place(out, click, 0.002, 0.85)

    burst = white(n_samples(0.028))
    burst = rbj_bandpass(burst, 4200.0, 1.1) + 0.5 * rbj_highpass(burst, 6000.0)
    burst *= perc_env(len(burst), 0.001, 0.012)
    place(out, burst, 0.001, 0.55)

    # --- metallic body: inharmonic FM + KS ---
    metals = [
        (980.0, 0.055, 0.42),
        (1480.0, 0.040, 0.28),
        (2210.0, 0.028, 0.18),
        (3170.0, 0.020, 0.12),
        (4120.0, 0.016, 0.08),
        (1870.0, 0.032, 0.16),
    ]
    for f, tau, g in metals:
        n_m = n_samples(min(0.16, tau * 4.5))
        idx = lin_env(n_m, 2.8, 0.4)
        tone = fm_tone(n_m, f, f * 1.41, idx) * exp_env(n_m, tau)
        place(out, tone, 0.003, g)

    ks = karplus_strong(n_samples(0.17), 1120.0, decay=0.968, stretch=0.42)
    ks = rbj_highpass(ks, 400.0)
    ks *= perc_env(len(ks), 0.001, 0.045)
    place(out, ks, 0.002, 0.38)

    ks2 = karplus_strong(n_samples(0.12), 1780.0, decay=0.955, stretch=0.35)
    ks2 *= perc_env(len(ks2), 0.001, 0.03)
    place(out, ks2, 0.004, 0.22)

    # --- flesh / jelly thud (arrives ~8-20ms, classic RO "body") ---
    thud_n = n_samples(0.14)
    thud = (
        0.85 * decaying_sine(thud_n, 78.0, 0.045)
        + 0.45 * decaying_sine(thud_n, 118.0, 0.032)
        + 0.22 * decaying_sine(thud_n, 164.0, 0.022)
    )
    jelly = pinkish(thud_n)
    jelly = rbj_bandpass(jelly, 280.0, 1.4) + 0.4 * rbj_bandpass(jelly, 520.0, 1.8)
    jelly *= perc_env(thud_n, 0.004, 0.038)
    place(out, thud + 0.7 * jelly, 0.010, 0.72)

    # wet squish layer
    squish = rbj_bandpass(white(n_samples(0.09)), 720.0, 1.6)
    squish *= perc_env(len(squish), 0.003, 0.028)
    place(out, squish, 0.012, 0.28)

    # hard gate: after 180ms only a short fade remains
    gate = np.ones(n)
    cut = n_samples(0.175)
    fade = n - cut
    if fade > 0:
        gate[cut:] = np.linspace(1.0, 0.0, fade) ** 1.6
    out *= gate
    return finish(out, fade_out=0.055, width=0.16)


def sfx_poring() -> np.ndarray:
    """Cute high slime hop / splat — bouncy, wet."""
    dur = 0.245
    out = zeros(dur)

    # hop 1 (higher)
    n1 = n_samples(0.11)
    f1 = lin_env(n1, 620.0, 210.0)
    hop1 = sine_phase(n1, f1) * perc_env(n1, 0.006, 0.055)
    hop1 += 0.35 * sine_phase(n1, f1 * 2.03) * perc_env(n1, 0.005, 0.04)
    place(out, hop1, 0.004, 0.7)

    # hop 2 (land / splat)
    n2 = n_samples(0.13)
    f2 = lin_env(n2, 440.0, 140.0)
    hop2 = sine_phase(n2, f2) * perc_env(n2, 0.004, 0.05)
    place(out, hop2, 0.095, 0.55)

    # wet bubble FM
    nfm = n_samples(0.10)
    bub = fm_tone(nfm, lin_env(nfm, 880.0, 320.0), 62.0, lin_env(nfm, 3.2, 0.6))
    bub *= perc_env(nfm, 0.004, 0.04)
    place(out, bub, 0.008, 0.38)

    # splat noise
    splat = rbj_bandpass(white(n_samples(0.09)), 1100.0, 1.1)
    splat += 0.4 * rbj_lowpass(white(n_samples(0.09)), 500.0)
    splat *= perc_env(len(splat), 0.003, 0.03)
    place(out, splat, 0.10, 0.42)

    # cute high tick
    tick = decaying_sine(n_samples(0.04), 1680.0, 0.012)
    place(out, tick, 0.006, 0.18)
    return finish(out, fade_out=0.04, width=0.18)


def sfx_fabre() -> np.ndarray:
    """Bug nibble + leaf rustle bite."""
    dur = 0.235
    out = zeros(dur)

    rustle = white(n_samples(0.19))
    rustle = rbj_bandpass(rustle, 5200.0, 1.4) + 0.5 * rbj_bandpass(rustle, 2800.0, 1.8)
    # irregular chomp AM
    t = t_axis(len(rustle))
    am = 0.35 + 0.65 * (0.5 + 0.5 * np.sin(2 * np.pi * 38 * t + 0.4 * np.sin(2 * np.pi * 17 * t)))
    rustle *= am * perc_env(len(rustle), 0.008, 0.09)
    place(out, rustle, 0.003, 0.55)

    # three nibble clicks
    for i, tt in enumerate((0.018, 0.055, 0.095, 0.138)):
        ck = impulse_click(n_samples(0.012), bright=0.55 + 0.1 * i)
        ck = rbj_bandpass(ck, 2400 + 300 * i, 2.2)
        place(out, ck, tt, 0.55 - 0.06 * i)

    # tiny insect chirp
    nch = n_samples(0.05)
    ch = fm_tone(nch, 2650.0, 210.0, 1.8) * perc_env(nch, 0.002, 0.016)
    place(out, ch, 0.04, 0.16)
    leaf = rbj_bandpass(white(n_samples(0.16)), 6400.0, 1.2) * perc_env(n_samples(0.16), 0.01, 0.07)
    place(out, leaf, 0.01, 0.22)
    return finish(out, fade_out=0.035, width=0.2)


def sfx_lunatic() -> np.ndarray:
    """Rabbit scratch / kick — short squeak + thud."""
    dur = 0.235
    out = zeros(dur)

    # squeak
    nsq = n_samples(0.055)
    fsq = lin_env(nsq, 2100.0, 1450.0)
    sq = fm_tone(nsq, fsq, 380.0, lin_env(nsq, 2.4, 0.7)) * perc_env(nsq, 0.003, 0.018)
    place(out, sq, 0.004, 0.42)

    # scratch (claws)
    sc = rbj_highpass(white(n_samples(0.07)), 2500.0)
    sc = rbj_bandpass(sc, 3600.0, 1.3)
    sc *= perc_env(len(sc), 0.002, 0.022)
    place(out, sc, 0.012, 0.48)

    # kick thud
    nth = n_samples(0.12)
    thud = (
        0.9 * decaying_sine(nth, 72.0, 0.04)
        + 0.35 * decaying_sine(nth, 128.0, 0.025)
        + 0.2 * rbj_lowpass(white(nth), 220.0) * perc_env(nth, 0.003, 0.03)
    )
    place(out, thud, 0.055, 0.7)

    # second light scratch
    sc2 = rbj_bandpass(white(n_samples(0.04)), 4200.0, 1.6) * perc_env(n_samples(0.04), 0.001, 0.012)
    place(out, sc2, 0.078, 0.22)
    return finish(out, fade_out=0.04, width=0.15)


def sfx_willow() -> np.ndarray:
    """Wood creak + root slap."""
    dur = 0.265
    out = zeros(dur)

    # creak: wobbling mid sine
    nc = n_samples(0.16)
    t = t_axis(nc)
    wob = 190.0 + 28.0 * np.sin(2 * np.pi * 11.0 * t) + 12.0 * np.sin(2 * np.pi * 23.0 * t)
    creak = sine_phase(nc, wob) + 0.35 * sine_phase(nc, wob * 1.97)
    creak *= perc_env(nc, 0.018, 0.07)
    # scrape noise on the creak
    scrape = rbj_bandpass(white(nc), 1400.0, 2.5) * perc_env(nc, 0.02, 0.06)
    place(out, creak + 0.28 * scrape, 0.006, 0.55)

    # wooden KS
    ks = karplus_strong(n_samples(0.14), 168.0, decay=0.972, stretch=0.55)
    ks = rbj_lowpass(ks, 2400.0)
    ks *= perc_env(len(ks), 0.002, 0.05)
    place(out, ks, 0.09, 0.4)

    # root slap
    ns = n_samples(0.11)
    slap = (
        decaying_sine(ns, 64.0, 0.04)
        + 0.4 * decaying_sine(ns, 96.0, 0.028)
        + 0.35 * rbj_lowpass(white(ns), 380.0) * perc_env(ns, 0.002, 0.028)
    )
    place(out, slap, 0.105, 0.72)
    ck = impulse_click(n_samples(0.015), 0.4)
    ck = rbj_bandpass(ck, 780.0, 2.0)
    place(out, ck, 0.108, 0.4)
    return finish(out, fade_out=0.045, width=0.12)


def sfx_condor() -> np.ndarray:
    """Wing flap + peck."""
    dur = 0.255
    out = zeros(dur)

    def flap(dur_s: float, fc: float) -> np.ndarray:
        n = n_samples(dur_s)
        src = pinkish(n)
        y = rbj_bandpass(src, fc, 1.1)
        y += 0.35 * rbj_lowpass(src, 350.0)
        return y * perc_env(n, 0.008, dur_s * 0.35)

    place(out, flap(0.09, 420.0), 0.004, 0.78)
    place(out, flap(0.08, 520.0), 0.078, 0.62)

    # air whoosh
    who = rbj_highpass(white(n_samples(0.12)), 1800.0)
    who = rbj_bandpass(who, 2400.0, 0.9) * perc_env(n_samples(0.12), 0.01, 0.04)
    place(out, who, 0.01, 0.28)

    # peck
    peck_n = n_samples(0.06)
    peck = (
        decaying_sine(peck_n, 1540.0, 0.014)
        + 0.45 * decaying_sine(peck_n, 980.0, 0.012)
        + 0.18 * impulse_click(peck_n, 0.45)
    )
    peck = rbj_highpass(peck, 400.0)
    place(out, peck, 0.145, 0.7)
    # small body tap
    tap = decaying_sine(n_samples(0.07), 180.0, 0.028) + 0.4 * decaying_sine(n_samples(0.07), 92.0, 0.03)
    place(out, tap, 0.145, 0.55)
    return finish(out, fade_out=0.045, width=0.22)


def sfx_wolf() -> np.ndarray:
    """Growl + bite."""
    dur = 0.285
    out = zeros(dur)

    ng = n_samples(0.20)
    growl = formant_noise(ng, 140.0, 310.0, 520.0)
    t = t_axis(ng)
    # glottal AM + slight pitch drop via extra low sine
    am = 0.45 + 0.55 * (0.5 + 0.5 * np.sin(2 * np.pi * 42 * t))
    growl *= am * perc_env(ng, 0.012, 0.09)
    sub = sine_phase(ng, lin_env(ng, 110.0, 78.0)) * perc_env(ng, 0.015, 0.08)
    place(out, growl + 0.35 * sub, 0.004, 0.7)

    # bite snap
    bite_n = n_samples(0.07)
    bite = impulse_click(bite_n, 0.95)
    bite = rbj_highpass(bite, 600.0) + 0.4 * rbj_bandpass(white(bite_n), 1800.0, 2.0) * perc_env(bite_n, 0.001, 0.012)
    place(out, bite, 0.145, 0.7)
    jaw = decaying_sine(n_samples(0.09), 180.0, 0.025) + 0.3 * decaying_sine(n_samples(0.09), 90.0, 0.03)
    place(out, jaw, 0.148, 0.45)
    return finish(out, fade_out=0.05, width=0.11)


def sfx_poporing() -> np.ndarray:
    """Wetter / acid slime hop — lower than poring."""
    dur = 0.255
    out = zeros(dur)

    n1 = n_samples(0.12)
    hop = sine_phase(n1, lin_env(n1, 340.0, 120.0)) * perc_env(n1, 0.007, 0.055)
    hop += 0.28 * sine_phase(n1, lin_env(n1, 510.0, 180.0)) * perc_env(n1, 0.006, 0.045)
    place(out, hop, 0.005, 0.68)

    n2 = n_samples(0.13)
    land = sine_phase(n2, lin_env(n2, 240.0, 88.0)) * perc_env(n2, 0.005, 0.05)
    place(out, land, 0.10, 0.52)

    # acid hiss
    hiss = rbj_highpass(white(n_samples(0.16)), 2800.0)
    hiss = rbj_bandpass(hiss, 4500.0, 0.9) * perc_env(n_samples(0.16), 0.01, 0.07)
    place(out, hiss, 0.012, 0.32)

    # wetter splat
    splat = rbj_lowpass(pinkish(n_samples(0.11)), 700.0)
    splat += 0.5 * rbj_bandpass(white(n_samples(0.11)), 480.0, 1.3)
    splat *= perc_env(n_samples(0.11), 0.004, 0.035)
    place(out, splat, 0.105, 0.5)

    # gurgle FM (lower, nastier)
    ng = n_samples(0.11)
    gur = fm_tone(ng, lin_env(ng, 220.0, 90.0), 38.0, lin_env(ng, 4.2, 1.0))
    gur *= perc_env(ng, 0.006, 0.045)
    place(out, gur, 0.02, 0.35)
    return finish(out, fade_out=0.045, width=0.16)


def sfx_chonchon() -> np.ndarray:
    """Buzz + dive bonk."""
    dur = 0.248
    out = zeros(dur)

    nb = n_samples(0.16)
    # insect buzz: AM + slight FM
    t = t_axis(nb)
    carrier = sine_phase(nb, lin_env(nb, 310.0, 140.0))
    buzz_am = 0.4 + 0.6 * (0.5 + 0.5 * np.sin(2 * np.pi * 92 * t))
    buzz = carrier * buzz_am
    buzz += 0.35 * sine_phase(nb, lin_env(nb, 620.0, 280.0)) * buzz_am
    buzz *= perc_env(nb, 0.008, 0.07)
    place(out, buzz, 0.003, 0.62)

    # wing noise
    wn = rbj_bandpass(white(n_samples(0.14)), 2100.0, 1.4) * perc_env(n_samples(0.14), 0.01, 0.055)
    place(out, wn, 0.006, 0.28)

    # dive bonk
    nk = n_samples(0.09)
    bonk = decaying_sine(nk, 156.0, 0.028) + 0.4 * decaying_sine(nk, 98.0, 0.022)
    bonk += 0.25 * impulse_click(nk, 0.5)
    place(out, bonk, 0.135, 0.7)
    grit = rbj_bandpass(white(n_samples(0.18)), 3400.0, 1.1) * perc_env(n_samples(0.18), 0.008, 0.07)
    place(out, grit, 0.008, 0.2)
    return finish(out, fade_out=0.035, width=0.2)


def sfx_roda_frog() -> np.ndarray:
    """Tongue whip + slam."""
    dur = 0.270
    out = zeros(dur)

    # whip: rising then falling chirp + air
    nw = n_samples(0.12)
    # two-stage freq: 240 -> 1900 -> 420
    n_up = n_samples(0.055)
    n_dn = nw - n_up
    whip = np.concatenate([chirp(n_up, 260.0, 1950.0, 0.7), chirp(n_dn, 1950.0, 380.0, 1.4)])
    whip *= perc_env(nw, 0.006, 0.05)
    air = rbj_bandpass(white(nw), 3200.0, 1.0) * perc_env(nw, 0.008, 0.04)
    place(out, whip + 0.28 * air, 0.005, 0.58)

    # wet slam
    ns = n_samples(0.13)
    slam = (
        0.9 * decaying_sine(ns, 68.0, 0.042)
        + 0.4 * decaying_sine(ns, 112.0, 0.028)
        + 0.55 * rbj_lowpass(pinkish(ns), 420.0) * perc_env(ns, 0.003, 0.032)
    )
    place(out, slam, 0.115, 0.75)
    # drip
    drip = decaying_sine(n_samples(0.04), 740.0, 0.012)
    place(out, drip, 0.155, 0.16)
    return finish(out, fade_out=0.045, width=0.14)


def sfx_spore() -> np.ndarray:
    """Puff / spore cloud — airy, magic."""
    dur = 0.295
    out = zeros(dur)

    puff = rbj_highpass(pinkish(n_samples(0.18)), 600.0)
    puff = rbj_bandpass(puff, 1600.0, 0.7) + 0.4 * rbj_highpass(puff, 3500.0)
    puff *= perc_env(len(puff), 0.012, 0.07)
    place(out, puff, 0.004, 0.55)

    # magic shimmer cluster
    for i, f in enumerate((1180.0, 1540.0, 1960.0, 2480.0, 3120.0)):
        nsh = n_samples(0.16 - i * 0.012)
        sh = decaying_sine(nsh, f + RNG.uniform(-18, 18), 0.045 + i * 0.004, phase=i * 0.7)
        place(out, sh, 0.015 + i * 0.008, 0.14 - i * 0.015)

    # airy whoosh
    who = rbj_bandpass(white(n_samples(0.22)), 900.0, 0.8)
    who *= perc_env(len(who), 0.02, 0.09)
    place(out, who, 0.008, 0.32)

    # soft sparkle tick
    sp = fm_tone(n_samples(0.06), 2400.0, 420.0, 1.6) * perc_env(n_samples(0.06), 0.003, 0.02)
    place(out, sp, 0.03, 0.18)
    return finish(out, fade_out=0.08, width=0.24)


def sfx_rocker() -> np.ndarray:
    """Cricket strum + screech."""
    dur = 0.250
    out = zeros(dur)

    # insect "guitar" KS (soft attack, band-limited)
    ks1 = karplus_strong(n_samples(0.18), 523.0, decay=0.976, stretch=0.4)
    ks2 = karplus_strong(n_samples(0.14), 784.0, decay=0.968, stretch=0.35)
    ks1 = rbj_lowpass(ks1, 6000.0) * perc_env(len(ks1), 0.004, 0.06)
    ks2 = rbj_lowpass(ks2, 6500.0) * perc_env(len(ks2), 0.004, 0.045)
    place(out, ks1, 0.004, 0.5)
    place(out, ks2, 0.012, 0.32)

    # cricket pulse — raised-cosine AM, not a hard gate (avoids encoder clips)
    nc = n_samples(0.12)
    t = t_axis(nc)
    pulse = 0.5 + 0.5 * np.sin(2 * np.pi * 48 * t)
    pulse = np.clip(pulse * 1.4 - 0.2, 0.0, 1.0)
    crick = sine_phase(nc, 3180.0) * pulse * perc_env(nc, 0.006, 0.05)
    crick = rbj_lowpass(crick, 8000.0)
    place(out, crick, 0.02, 0.22)

    # screech
    nsc = n_samples(0.08)
    sc = fm_tone(nsc, lin_env(nsc, 1680.0, 2200.0), 310.0, lin_env(nsc, 2.4, 0.8))
    sc = rbj_lowpass(sc, 7000.0) * perc_env(nsc, 0.006, 0.028)
    place(out, sc, 0.11, 0.36)

    # little body hit
    body = decaying_sine(n_samples(0.06), 190.0, 0.02)
    place(out, body, 0.125, 0.22)
    return finish(out, fade_out=0.045, width=0.17, headroom_db=-2.2)


def sfx_steel_chonchon() -> np.ndarray:
    """Heavy metal buzz + ram — lower / harsher than chonchon."""
    dur = 0.255
    out = zeros(dur)

    nb = n_samples(0.17)
    t = t_axis(nb)
    # metallic buzz via KS + AM
    ks = karplus_strong(nb, 196.0, decay=0.982, stretch=0.3)
    ks2 = karplus_strong(nb, 294.0, decay=0.975, stretch=0.28)
    am = 0.35 + 0.65 * (0.5 + 0.5 * np.sin(2 * np.pi * 68 * t))
    buzz = (ks + 0.55 * ks2) * am * perc_env(nb, 0.008, 0.07)
    # extra grit
    grit = rbj_bandpass(white(nb), 1800.0, 1.6) * am * perc_env(nb, 0.01, 0.06)
    place(out, buzz + 0.22 * grit, 0.003, 0.62)

    # heavy ram
    nr = n_samples(0.11)
    ram = (
        1.0 * decaying_sine(nr, 58.0, 0.045)
        + 0.5 * decaying_sine(nr, 92.0, 0.03)
        + 0.28 * decaying_sine(nr, 220.0, 0.018)
        + 0.35 * rbj_lowpass(white(nr), 280.0) * perc_env(nr, 0.002, 0.03)
    )
    place(out, ram, 0.125, 0.78)
    ncl = n_samples(0.05)
    clang = decaying_sine(ncl, 1340.0, 0.012) + 0.4 * decaying_sine(ncl, 2100.0, 0.008)
    place(out, clang, 0.128, 0.28)
    return finish(out, fade_out=0.04, width=0.13)


def sfx_savage_babe() -> np.ndarray:
    """Gore / charge grunt."""
    dur = 0.290
    out = zeros(dur)

    # charge rumble rising
    nc = n_samples(0.11)
    rum = formant_noise(nc, 160.0, 340.0, 680.0)
    rum *= perc_env(nc, 0.02, 0.06) * lin_env(nc, 0.4, 1.0)
    sub = sine_phase(nc, lin_env(nc, 70.0, 95.0)) * perc_env(nc, 0.02, 0.055)
    place(out, rum + 0.4 * sub, 0.004, 0.55)

    # grunt (pitch drop)
    ng = n_samples(0.14)
    gr = formant_noise(ng, 180.0, 360.0, 720.0)
    t = t_axis(ng)
    am = 0.4 + 0.6 * (0.5 + 0.5 * np.sin(2 * np.pi * 36 * t))
    voice = sine_phase(ng, lin_env(ng, 210.0, 95.0)) * 0.45
    gr = (gr + voice) * am * perc_env(ng, 0.008, 0.055)
    place(out, gr, 0.07, 0.7)

    # gore tear
    tear = rbj_bandpass(white(n_samples(0.09)), 900.0, 1.2)
    tear += 0.4 * rbj_bandpass(white(n_samples(0.09)), 1600.0, 1.6)
    tear *= perc_env(n_samples(0.09), 0.003, 0.028)
    place(out, tear, 0.145, 0.42)

    # impact
    nh = n_samples(0.09)
    hit = decaying_sine(nh, 78.0, 0.035)
    place(out, hit, 0.155, 0.55)
    place(out, impulse_click(n_samples(0.02), 0.6), 0.155, 0.3)
    return finish(out, fade_out=0.05, width=0.12)


def sfx_elder_willow() -> np.ndarray:
    """Burning branch crack + flame whoosh."""
    dur = 0.290
    out = zeros(dur)

    # crackle pops
    for tt, f in ((0.006, 2100.0), (0.028, 1650.0), (0.052, 2800.0), (0.074, 1900.0)):
        npop = n_samples(0.03)
        pop = decaying_sine(npop, f, 0.008)
        place(out, pop, tt, 0.22)
        place(out, impulse_click(n_samples(0.012), 0.45), tt, 0.10)

    # wood snap KS
    ks = karplus_strong(n_samples(0.12), 210.0, decay=0.96, stretch=0.45)
    ks *= perc_env(len(ks), 0.001, 0.035)
    place(out, ks, 0.04, 0.42)

    # flame whoosh (airy hiss with slow AM)
    nf = n_samples(0.22)
    flame = rbj_highpass(white(nf), 1800.0)
    flame = rbj_bandpass(flame, 3200.0, 0.8) + 0.35 * rbj_bandpass(flame, 1100.0, 0.9)
    t = t_axis(nf)
    flame *= (0.55 + 0.45 * np.sin(2 * np.pi * 14 * t)) * perc_env(nf, 0.02, 0.085)
    place(out, flame, 0.015, 0.5)

    # low burn body + branch thump
    body = rbj_lowpass(pinkish(n_samples(0.18)), 320.0) * perc_env(n_samples(0.18), 0.015, 0.07)
    place(out, body, 0.03, 0.48)
    thump = decaying_sine(n_samples(0.10), 72.0, 0.04) + 0.35 * decaying_sine(n_samples(0.10), 118.0, 0.03)
    place(out, thump, 0.05, 0.55)
    return finish(out, fade_out=0.055, width=0.2)


def sfx_skeleton() -> np.ndarray:
    """Bone rattle slash."""
    dur = 0.230
    out = zeros(dur)

    # hollow bone clicks
    times = (0.004, 0.018, 0.034, 0.052, 0.072, 0.096)
    for i, tt in enumerate(times):
        nh = n_samples(0.036)
        hollow = decaying_sine(nh, 980.0 + 140 * (i % 4), 0.012)
        hollow += 0.4 * decaying_sine(nh, 1560.0 + 90 * i, 0.008)
        place(out, rbj_bandpass(hollow, 1450.0, 2.4), tt, 0.42 - 0.03 * (i % 2))
        place(out, impulse_click(n_samples(0.018), 0.55 + 0.08 * (i % 3)), tt, 0.4)

    # dry slash sweep
    ns = n_samples(0.10)
    sl = rbj_bandpass(white(ns), 2400.0, 1.2)
    # downward feel via second band
    sl2 = rbj_bandpass(white(ns), 1200.0, 1.0)
    env = perc_env(ns, 0.004, 0.032)
    place(out, (sl * lin_env(ns, 1.0, 0.3) + 0.6 * sl2) * env, 0.055, 0.48)

    # light body
    body = decaying_sine(n_samples(0.07), 140.0, 0.022)
    place(out, body, 0.08, 0.22)
    return finish(out, fade_out=0.035, width=0.16)


# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

SOUNDS = [
    ("hit_slash.ogg", sfx_hit_slash, "Metallic sword clang + short flesh/jelly thud. Classic RO melee homage, original.", "Player swing-land: play when a hero melee hit connects with a monster (dmg event). Safe at 7 hits/sec."),
    ("mob_poring_attack.ogg", sfx_poring, "Cute high slime hop/splat — bouncy, wet.", "Mob hits player: field mob id poring."),
    ("mob_fabre_attack.ogg", sfx_fabre, "Bug nibble + leaf rustle bite.", "Mob hits player: field mob id fabre."),
    ("mob_lunatic_attack.ogg", sfx_lunatic, "Rabbit scratch/kick — short squeak + thud.", "Mob hits player: field mob id lunatic."),
    ("mob_willow_attack.ogg", sfx_willow, "Wood creak + root slap.", "Mob hits player: field mob id willow."),
    ("mob_condor_attack.ogg", sfx_condor, "Wing flap + peck.", "Mob hits player: field mob id condor."),
    ("mob_wolf_attack.ogg", sfx_wolf, "Growl + bite.", "Mob hits player: field mob id wolf."),
    ("mob_poporing_attack.ogg", sfx_poporing, "Wetter/acid slime hop, lower than poring.", "Mob hits player: field mob id poporing."),
    ("mob_chonchon_attack.ogg", sfx_chonchon, "Buzz + dive bonk.", "Mob hits player: field mob id chonchon."),
    ("mob_roda_frog_attack.ogg", sfx_roda_frog, "Tongue whip + slam.", "Mob hits player: field mob id roda_frog."),
    ("mob_spore_attack.ogg", sfx_spore, "Puff / spore cloud — airy, magic.", "Mob hits player: field mob id spore."),
    ("mob_rocker_attack.ogg", sfx_rocker, "Cricket strum + screech.", "Mob hits player: field mob id rocker."),
    ("mob_steel_chonchon_attack.ogg", sfx_steel_chonchon, "Heavy metal buzz + ram.", "Mob hits player: field mob id steel_chonchon."),
    ("mob_savage_babe_attack.ogg", sfx_savage_babe, "Gore / charge grunt.", "Mob hits player: field mob id savage_babe."),
    ("mob_elder_willow_attack.ogg", sfx_elder_willow, "Burning branch crack + flame whoosh.", "Mob hits player: field mob id elder_willow."),
    ("mob_skeleton_attack.ogg", sfx_skeleton, "Bone rattle slash.", "Mob hits player: field mob id skeleton."),
]


def ffprobe_info(path: str) -> tuple[float, str, int, int]:
    out = subprocess.check_output(
        [
            "/usr/bin/ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration,size:stream=codec_name,sample_rate,channels",
            "-of",
            "default=noprint_wrappers=1",
            path,
        ],
        text=True,
    )
    dur = size = sr = ch = None
    codec = "?"
    for line in out.splitlines():
        if line.startswith("duration="):
            dur = float(line.split("=", 1)[1])
        elif line.startswith("size="):
            size = int(line.split("=", 1)[1])
        elif line.startswith("codec_name="):
            codec = line.split("=", 1)[1]
        elif line.startswith("sample_rate="):
            sr = int(line.split("=", 1)[1])
        elif line.startswith("channels="):
            ch = int(line.split("=", 1)[1])
    return dur, codec, sr, ch, size


def write_manifest(rows: list[dict]) -> None:
    path = os.path.join(OUT_DIR, "MANIFEST.md")
    lines = [
        "# RO-World combat SFX",
        "",
        "Original synthesized hits (numpy + ffmpeg libvorbis). No sampled copyright audio.",
        "All files: Ogg Vorbis, 44100 Hz, stereo, peak normalized to −1 dBFS.",
        "",
        "| filename | duration | what it is | when to play |",
        "|---|---|---|---|",
    ]
    for r in rows:
        lines.append(
            f"| `{r['name']}` | {r['dur']:.3f}s | {r['what']} | {r['when']} |"
        )
    lines += [
        "",
        "## Notes",
        "",
        "- `hit_slash.ogg` is gated so the body is gone by ~180 ms and the file is silent by 280 ms — safe to overlap at 7 hits/sec.",
        "- Each mob file is a unique pitch/texture family so field packs do not blend into one hit sound.",
        "- Start padding is under 20 ms. Fade to digital zero at the end of every file.",
        "",
    ]
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(WAV_DIR, exist_ok=True)
    rows = []
    for name, fn, what, when in SOUNDS:
        audio = fn()
        wav = os.path.join(WAV_DIR, name.replace(".ogg", ".wav"))
        ogg = os.path.join(OUT_DIR, name)
        write_wav(wav, audio)
        encode_ogg(wav, ogg)
        dur, codec, sr, ch, size = ffprobe_info(ogg)
        disk = os.path.getsize(ogg)
        print(f"{name:32s} dur={dur:.4f}s  size={disk:6d}  {codec} {sr}Hz {ch}ch")
        rows.append({"name": name, "dur": dur, "what": what, "when": when, "size": disk})
    write_manifest(rows)


if __name__ == "__main__":
    main()

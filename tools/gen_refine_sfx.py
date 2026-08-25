#!/usr/bin/env python3
"""Original RO-World refine UI SFX — numpy synthesis, no sampled copyright material."""
from __future__ import annotations

import os
import subprocess
import sys

import numpy as np

# Reuse the combat DSP kit so encode / peak / stereo match existing SFX.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_combat_sfx import (  # type: ignore
    SR,
    WAV_DIR,
    chirp,
    decaying_sine,
    exp_env,
    finish,
    fm_tone,
    impulse_click,
    karplus_strong,
    lin_env,
    n_samples,
    perc_env,
    pinkish,
    place,
    rbj_bandpass,
    rbj_highpass,
    rbj_lowpass,
    sine_phase,
    t_axis,
    white,
    zeros,
    write_wav,
    encode_ogg,
    ffprobe_info,
)

OUT_DIR = "/workspace/RO-World/assets/sfx"
# Distinct seed from combat pack so textures don't collide.
from gen_combat_sfx import RNG  # noqa: E402


def sfx_refine_hit() -> np.ndarray:
    """Hammer on anvil: metal-on-metal clang + short wood/anvil body.

    Workshop smith strike — NOT sword-on-flesh. Classic RO smith homage, original.
    Target 180–280 ms.
    """
    dur = 0.235
    out = zeros(dur)

    # --- strike transient (metal-on-metal, brighter / drier than slash) ---
    click = impulse_click(n_samples(0.016), bright=1.0)
    click = rbj_highpass(click, 1200.0)
    place(out, click, 0.003, 0.92)

    spark = white(n_samples(0.022))
    spark = rbj_bandpass(spark, 5600.0, 1.05) + 0.55 * rbj_highpass(spark, 7800.0)
    spark *= perc_env(len(spark), 0.0006, 0.008)
    place(out, spark, 0.0025, 0.62)

    # mid-metal "ting" burst (anvil face)
    ting = white(n_samples(0.030))
    ting = rbj_bandpass(ting, 2650.0, 1.6) + 0.35 * rbj_bandpass(ting, 3900.0, 2.0)
    ting *= perc_env(len(ting), 0.0008, 0.011)
    place(out, ting, 0.003, 0.48)

    # --- anvil modal ring (inharmonic, workshop-bright; different modes than hit_slash) ---
    # Typical anvil-ish inharmonic stack, short so it stays a UI hit not a bell.
    modes = [
        (560.0, 0.038, 0.18),
        (890.0, 0.042, 0.28),
        (1680.0, 0.048, 0.40),
        (2430.0, 0.036, 0.32),
        (3270.0, 0.026, 0.22),
        (4120.0, 0.018, 0.14),
        (5380.0, 0.012, 0.09),
        (2140.0, 0.030, 0.16),
    ]
    for f, tau, g in modes:
        nm = n_samples(min(0.18, tau * 4.2))
        idx = lin_env(nm, 2.2, 0.25)
        tone = fm_tone(nm, f, f * 1.27, idx) * exp_env(nm, tau)
        place(out, tone, 0.0035, g)

    # extra bright KS "plate" (anvil face), not a sword string
    plate = karplus_strong(n_samples(0.16), 840.0, decay=0.958, stretch=0.28)
    plate = rbj_highpass(plate, 500.0)
    plate = rbj_lowpass(plate, 7200.0)
    plate *= perc_env(len(plate), 0.0008, 0.038)
    place(out, plate, 0.003, 0.34)

    plate2 = karplus_strong(n_samples(0.11), 1260.0, decay=0.948, stretch=0.22)
    plate2 *= perc_env(len(plate2), 0.0008, 0.024)
    place(out, plate2, 0.004, 0.18)

    # --- wood / anvil-stump body (the "thock" under the clang) ---
    nb = n_samples(0.13)
    body = (
        0.70 * decaying_sine(nb, 95.0, 0.038)
        + 0.42 * decaying_sine(nb, 148.0, 0.028)
        + 0.22 * decaying_sine(nb, 228.0, 0.018)
    )
    wood = karplus_strong(n_samples(0.12), 196.0, decay=0.962, stretch=0.58)
    wood = rbj_lowpass(wood, 1800.0)
    wood *= perc_env(len(wood), 0.0015, 0.036)
    knock = rbj_bandpass(pinkish(n_samples(0.08)), 680.0, 1.5)
    knock *= perc_env(len(knock), 0.002, 0.022)
    place(out, body, 0.006, 0.58)
    place(out, wood, 0.005, 0.36)
    place(out, knock, 0.0055, 0.28)

    # hard gate so it stays a short UI hit
    n = len(out)
    gate = np.ones(n)
    cut = n_samples(0.175)
    fade = n - cut
    if fade > 0:
        gate[cut:] = np.linspace(1.0, 0.0, fade) ** 1.7
    out *= gate
    return finish(out, fade_out=0.045, width=0.13)


def sfx_refine_ok() -> np.ndarray:
    """Refine SUCCESS: bright sparkle / holy chime / small fanfare.

    High, clear, rewarding. Not a UI click. Target 350–550 ms.
    """
    dur = 0.455
    out = zeros(dur)

    # --- opening sparkle burst ---
    spark = white(n_samples(0.07))
    spark = rbj_highpass(spark, 4500.0)
    spark = rbj_bandpass(spark, 7800.0, 0.85) + 0.4 * rbj_bandpass(spark, 5200.0, 1.2)
    spark *= perc_env(len(spark), 0.002, 0.022)
    place(out, spark, 0.004, 0.38)

    # tiny glitter ticks
    for i, tt in enumerate((0.006, 0.018, 0.034, 0.052)):
        nt = n_samples(0.035)
        tick = decaying_sine(nt, 6200.0 + 900 * i, 0.008)
        tick += 0.35 * decaying_sine(nt, 8400.0 - 400 * i, 0.006)
        place(out, tick, tt, 0.16 - 0.02 * i)

    # --- holy chime triad + octave (major, high, clear) ---
    # E6, G6, C7, E7 — uplifting, not a church organ
    bells = [
        (0.008, 1318.5, 0.095, 0.42),  # E6
        (0.018, 1568.0, 0.085, 0.30),  # G6
        (0.028, 2093.0, 0.110, 0.38),  # C7
        (0.042, 2637.0, 0.075, 0.22),  # E7
        (0.055, 3136.0, 0.055, 0.12),  # G7 shimmer
    ]
    for t0, f, tau, g in bells:
        nch = n_samples(min(0.38, tau * 4.8))
        # slight inharmonic 2nd partial so it reads as a chime, not a synth lead
        fund = decaying_sine(nch, f, tau)
        partial = decaying_sine(nch, f * 2.01, tau * 0.55) * 0.28
        air = decaying_sine(nch, f * 2.996, tau * 0.35) * 0.12
        # very light FM twinkle on the attack
        nfm = n_samples(0.06)
        tw = fm_tone(nfm, f, 7.5, lin_env(nfm, 0.55, 0.08)) * perc_env(nfm, 0.003, 0.028)
        place(out, fund + partial + air, t0, g)
        place(out, tw, t0, g * 0.22)

    # --- small 3-note fanfare (ascending, delayed so it's a reward not a click) ---
    fanfare = [
        (0.095, 1046.5, 0.070),  # C6
        (0.175, 1318.5, 0.075),  # E6
        (0.255, 1568.0, 0.095),  # G6
    ]
    for t0, f, tau in fanfare:
        nfa = n_samples(min(0.28, tau * 3.6))
        note = decaying_sine(nfa, f, tau) + 0.22 * decaying_sine(nfa, f * 2.0, tau * 0.5)
        # soft attack so it isn't percussive-clicky
        note *= perc_env(nfa, 0.008, tau)
        place(out, note, t0, 0.34)

    # final resolving octave sparkle
    nr = n_samples(0.22)
    resolve = decaying_sine(nr, 2093.0, 0.085)
    resolve += 0.18 * decaying_sine(nr, 4186.0, 0.045)
    place(out, resolve, 0.270, 0.28)

    # --- airy holy pad (very quiet, just lift) ---
    npad = n_samples(0.36)
    pad = (
        0.55 * sine_phase(npad, 523.25)
        + 0.35 * sine_phase(npad, 783.99)
        + 0.22 * sine_phase(npad, 1046.5)
    )
    pad *= perc_env(npad, 0.035, 0.14)
    pad = rbj_lowpass(pad, 2400.0)
    place(out, pad, 0.012, 0.10)

    # lingering shimmer cluster
    for i, f in enumerate((2480.0, 3120.0, 3720.0, 4460.0, 5240.0)):
        nsh = n_samples(0.22 - i * 0.018)
        sh = decaying_sine(nsh, f + (i * 11.0), 0.055 + i * 0.006, phase=i * 0.9)
        place(out, sh, 0.040 + i * 0.014, 0.10 - i * 0.012)

    return finish(out, fade_out=0.070, width=0.22)


def sfx_refine_fail() -> np.ndarray:
    """Refine FAIL (safe): dull muted thud + short descending tone.

    Disappointing, not catastrophic. Item does not break. Target 280–450 ms.
    """
    dur = 0.355
    out = zeros(dur)

    # --- dull muted thud (felt / wood, no metal crash, no glass) ---
    nth = n_samples(0.16)
    thud = (
        0.95 * decaying_sine(nth, 68.0, 0.055)
        + 0.50 * decaying_sine(nth, 102.0, 0.040)
        + 0.22 * decaying_sine(nth, 148.0, 0.026)
    )
    felt = rbj_lowpass(pinkish(nth), 320.0)
    felt *= perc_env(nth, 0.004, 0.042)
    # soft mid "thup" — muted, not a kick
    thup = rbj_bandpass(pinkish(n_samples(0.09)), 240.0, 1.1)
    thup *= perc_env(len(thup), 0.005, 0.032)
    place(out, thud + 0.55 * felt, 0.006, 0.78)
    place(out, thup, 0.008, 0.32)

    # muted wooden knock (no clang)
    wood = karplus_strong(n_samples(0.10), 110.0, decay=0.945, stretch=0.70)
    wood = rbj_lowpass(wood, 900.0)
    wood *= perc_env(len(wood), 0.003, 0.032)
    place(out, wood, 0.007, 0.28)

    # very soft closed "tick" so the miss is acknowledged (not a spark)
    tick = rbj_lowpass(impulse_click(n_samples(0.012), bright=0.18), 1400.0)
    place(out, tick, 0.006, 0.22)

    # --- short descending sigh (disappointing, not a fail-bomb) ---
    nd = n_samples(0.24)
    # 392 Hz (G4) -> 247 Hz (B3) — a small disappointed fall
    sigh = sine_phase(nd, lin_env(nd, 392.0, 247.0))
    sigh += 0.22 * sine_phase(nd, lin_env(nd, 588.0, 370.0))
    # muted: roll off highs, gentle attack
    sigh = rbj_lowpass(sigh, 1600.0)
    sigh *= perc_env(nd, 0.018, 0.095)
    place(out, sigh, 0.055, 0.42)

    # second quieter drop, a fifth below, delayed
    nd2 = n_samples(0.18)
    sigh2 = sine_phase(nd2, lin_env(nd2, 247.0, 185.0))
    sigh2 = rbj_lowpass(sigh2, 1100.0)
    sigh2 *= perc_env(nd2, 0.016, 0.08)
    place(out, sigh2, 0.145, 0.22)

    # tiny air leak so it doesn't feel clipped-dead
    air = rbj_lowpass(pinkish(n_samples(0.20)), 500.0) * perc_env(n_samples(0.20), 0.02, 0.08)
    place(out, air, 0.010, 0.10)

    return finish(out, fade_out=0.065, width=0.10)


SOUNDS = [
    (
        "ui_refine_hit.ogg",
        sfx_refine_hit,
        "Hammer-on-anvil clang + short wood/anvil body. Classic RO smith homage, original metal-on-metal workshop.",
        "Player clicks ตีบวก (refine): play on each refine strike.",
    ),
    (
        "ui_refine_ok.ogg",
        sfx_refine_ok,
        "Bright sparkle / holy chime / small fanfare — high, clear, rewarding.",
        "Refine SUCCESS.",
    ),
    (
        "ui_refine_fail.ogg",
        sfx_refine_fail,
        "Dull muted thud + short descending tone. Disappointing, not catastrophic (item is safe).",
        "Refine FAIL (safe: plus stays, only Zeno lost).",
    ),
]


def append_manifest(rows: list[dict]) -> None:
    path = os.path.join(OUT_DIR, "MANIFEST.md")
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()
    # Insert new rows at the end of the table (before the blank line + ## Notes).
    marker = "\n## Notes\n"
    if marker not in text:
        raise SystemExit("MANIFEST.md missing ## Notes section; refuse to clobber.")
    new_rows = []
    for r in rows:
        new_rows.append(
            f"| `{r['name']}` | {r['dur']:.3f}s | {r['what']} | {r['when']} |"
        )
    insert = "\n".join(new_rows) + "\n"
    # Keep existing combat rows intact; append refine rows to the table.
    text = text.replace(marker, insert + marker, 1)
    # Add a refine note if not already present.
    note = (
        "- `ui_refine_hit.ogg` / `ui_refine_ok.ogg` / `ui_refine_fail.ogg` are "
        "UI refine cues (smith workshop / success chime / safe-fail thud). "
        "Fail is disappointing, not catastrophic — the item does not break.\n"
    )
    if "ui_refine_hit.ogg" not in text.split("## Notes")[1]:
        # append note after the existing notes list
        if not text.endswith("\n"):
            text += "\n"
        text += note
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


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
    append_manifest(rows)


if __name__ == "__main__":
    main()

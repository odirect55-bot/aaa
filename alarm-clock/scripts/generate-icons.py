#!/usr/bin/env python3
"""Generates the app, adaptive, splash and notification icons in ../assets.

    python3 scripts/generate-icons.py

Everything is drawn from signed distance fields with stdlib only (no Pillow),
so the icons are reproducible and the repository carries no opaque binaries.
The glyph is a classic twin-bell alarm clock, which doubles as the Android
notification icon (Android renders that one as a silhouette, so it is exported
as white-on-transparent).
"""

from __future__ import annotations

import math
import os
import struct
import zlib

ASSETS = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets"))

BRAND = (0x6C, 0x5C, 0xE7)  # indigo used as the app's primary colour
BRAND_DEEP = (0x3B, 0x2F, 0x8F)
SUPERSAMPLE = 4


# --------------------------------------------------------------------------- SDFs
def sd_circle(px: float, py: float, cx: float, cy: float, r: float) -> float:
    return math.hypot(px - cx, py - cy) - r


def sd_ring(px: float, py: float, cx: float, cy: float, r: float, half_width: float) -> float:
    return abs(math.hypot(px - cx, py - cy) - r) - half_width


def sd_segment(px: float, py: float, ax: float, ay: float, bx: float, by: float, r: float) -> float:
    vx, vy = bx - ax, by - ay
    wx, wy = px - ax, py - ay
    length_sq = vx * vx + vy * vy
    t = 0.0 if length_sq == 0 else max(0.0, min(1.0, (wx * vx + wy * vy) / length_sq))
    return math.hypot(wx - vx * t, wy - vy * t) - r


def union(*distances: float) -> float:
    return min(distances)


def subtract(shape: float, hole: float) -> float:
    return max(shape, -hole)


def clock_glyph(px: float, py: float) -> float:
    """Signed distance of the alarm-clock glyph in a -1..1 coordinate space."""
    body_r = 0.62
    bell_r = 0.20
    bell_y = -0.60
    bell_x = 0.48

    bells = union(
        sd_circle(px, py, -bell_x, bell_y, bell_r),
        sd_circle(px, py, bell_x, bell_y, bell_r),
    )
    # The bells are cropped by the body so they read as caps, not floating dots.
    bells = subtract(bells, sd_circle(px, py, 0.0, 0.0, body_r - 0.02))

    feet = union(
        sd_segment(px, py, -0.42, 0.52, -0.60, 0.76, 0.09),
        sd_segment(px, py, 0.42, 0.52, 0.60, 0.76, 0.09),
    )
    feet = subtract(feet, sd_circle(px, py, 0.0, 0.0, body_r - 0.02))

    rim = sd_ring(px, py, 0.0, 0.0, body_r, 0.085)
    hour_hand = sd_segment(px, py, 0.0, 0.0, 0.0, -0.31, 0.062)
    minute_hand = sd_segment(px, py, 0.0, 0.0, 0.29, 0.15, 0.062)
    hub = sd_circle(px, py, 0.0, 0.0, 0.075)

    return union(bells, feet, rim, hour_hand, minute_hand, hub)


# --------------------------------------------------------------------------- PNG
def write_png(path: str, width: int, height: int, pixels: bytearray) -> None:
    """pixels is RGBA, row-major, 4 bytes per pixel."""
    raw = bytearray()
    stride = width * 4
    for y in range(height):
        raw.append(0)  # filter type 0 (None)
        raw += pixels[y * stride : (y + 1) * stride]

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")

    with open(path, "wb") as handle:
        handle.write(png)


def render(
    size: int,
    glyph_scale: float,
    background: str,
    glyph_color: tuple[int, int, int],
) -> bytearray:
    """background: 'none' | 'solid' | 'gradient' (a rounded square for 'gradient')."""
    pixels = bytearray(size * size * 4)
    step = 1.0 / SUPERSAMPLE
    offset = step / 2

    for y in range(size):
        for x in range(size):
            glyph_coverage = 0.0
            background_coverage = 0.0
            for sy in range(SUPERSAMPLE):
                for sx in range(SUPERSAMPLE):
                    fx = (x + offset + sx * step) / size * 2 - 1
                    fy = (y + offset + sy * step) / size * 2 - 1
                    if clock_glyph(fx / glyph_scale, fy / glyph_scale) <= 0:
                        glyph_coverage += 1
                    if background == "solid":
                        background_coverage += 1
                    elif background == "gradient":
                        # Rounded square covering the full canvas.
                        qx, qy = abs(fx) - 0.78, abs(fy) - 0.78
                        distance = math.hypot(max(qx, 0.0), max(qy, 0.0)) + min(
                            max(qx, qy), 0.0
                        ) - 0.20
                        if distance <= 0:
                            background_coverage += 1
            samples = SUPERSAMPLE * SUPERSAMPLE
            glyph_alpha = glyph_coverage / samples
            background_alpha = background_coverage / samples

            if background == "gradient":
                t = (x + y) / (2 * size)
                base = tuple(
                    round(BRAND[i] + (BRAND_DEEP[i] - BRAND[i]) * t) for i in range(3)
                )
            else:
                base = BRAND

            index = (y * size + x) * 4
            alpha = background_alpha + glyph_alpha * (1 - background_alpha)
            if alpha <= 0:
                continue
            for channel in range(3):
                blended = (
                    base[channel] * background_alpha * (1 - glyph_alpha)
                    + glyph_color[channel] * glyph_alpha
                ) / alpha
                pixels[index + channel] = max(0, min(255, round(blended)))
            pixels[index + 3] = round(alpha * 255)
    return pixels


TARGETS = [
    # (filename, size, glyph scale, background, glyph colour)
    ("icon.png", 512, 0.62, "gradient", (255, 255, 255)),
    ("android-icon-foreground.png", 432, 0.40, "none", (255, 255, 255)),
    ("android-icon-monochrome.png", 432, 0.40, "none", (255, 255, 255)),
    ("splash-icon.png", 384, 0.62, "none", BRAND),
    ("notification-icon.png", 96, 0.72, "none", (255, 255, 255)),
    ("favicon.png", 64, 0.62, "gradient", (255, 255, 255)),
]


if __name__ == "__main__":
    os.makedirs(ASSETS, exist_ok=True)
    for name, size, scale, background, color in TARGETS:
        data = render(size, scale, background, color)
        target = os.path.join(ASSETS, name)
        write_png(target, size, size, data)
        print(f"wrote {target} ({size}x{size}, {os.path.getsize(target) / 1024:.1f} KB)")

    # The adaptive background layer is a flat brand-coloured tile.
    flat = bytearray()
    for _ in range(432 * 432):
        flat += bytes((BRAND[0], BRAND[1], BRAND[2], 255))
    write_png(os.path.join(ASSETS, "android-icon-background.png"), 432, 432, flat)
    print(f"wrote {os.path.join(ASSETS, 'android-icon-background.png')} (432x432)")

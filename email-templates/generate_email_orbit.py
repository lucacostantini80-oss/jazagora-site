from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


HERE = Path(__file__).resolve().parent
ASSETS = HERE / "assets"
ASSETS.mkdir(parents=True, exist_ok=True)

WIDTH, HEIGHT = 520, 176
SCALE = 2
FRAMES = 48

BACKGROUND = (17, 4, 36, 255)
GOLD = (247, 199, 94, 255)
CYAN = (52, 216, 221, 255)
ROSE = (255, 85, 116, 255)


def ellipse_box(cx: float, cy: float, rx: float, ry: float) -> tuple[int, int, int, int]:
    return (
        int((cx - rx) * SCALE),
        int((cy - ry) * SCALE),
        int((cx + rx) * SCALE),
        int((cy + ry) * SCALE),
    )


def dot(draw: ImageDraw.ImageDraw, x: float, y: float, radius: float, color: tuple[int, int, int, int]) -> None:
    for multiplier, alpha in ((3.1, 30), (2.1, 64), (1.35, 120)):
        r = radius * multiplier * SCALE
        draw.ellipse(
            (x * SCALE - r, y * SCALE - r, x * SCALE + r, y * SCALE + r),
            fill=(*color[:3], alpha),
        )
    r = radius * SCALE
    draw.ellipse(
        (x * SCALE - r, y * SCALE - r, x * SCALE + r, y * SCALE + r),
        fill=color,
        outline=(255, 245, 222, 210),
        width=1 * SCALE,
    )


def render_frame(index: int) -> Image.Image:
    canvas = Image.new("RGBA", (WIDTH * SCALE, HEIGHT * SCALE), BACKGROUND)

    glow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    cx, cy = WIDTH / 2, HEIGHT / 2
    glow_draw.ellipse(ellipse_box(cx, cy, 66, 66), fill=(116, 55, 201, 118))
    glow = glow.filter(ImageFilter.GaussianBlur(28 * SCALE))
    canvas.alpha_composite(glow)

    draw = ImageDraw.Draw(canvas, "RGBA")
    rings = [
        (78, 31, (247, 199, 94, 105)),
        (105, 43, (52, 216, 221, 92)),
        (134, 56, (255, 85, 116, 74)),
    ]
    for rx, ry, color in rings:
        draw.ellipse(ellipse_box(cx, cy, rx, ry), outline=color, width=1 * SCALE)

    phase = (2 * math.pi * index) / FRAMES
    orbit_data = [
        (78, 31, phase, 5.0, GOLD),
        (105, 43, -phase * 0.82 + 1.45, 4.2, CYAN),
        (134, 56, phase * 0.64 + 3.05, 3.6, ROSE),
    ]
    for rx, ry, angle, radius, color in orbit_data:
        x = cx + math.cos(angle) * rx
        y = cy + math.sin(angle) * ry
        dot(draw, x, y, radius, color)

    draw.ellipse(ellipse_box(cx, cy, 24, 24), fill=(64, 19, 111, 255), outline=(247, 199, 94, 170), width=1 * SCALE)
    draw.ellipse(ellipse_box(cx - 6, cy - 7, 9, 9), fill=(168, 111, 239, 160))

    return canvas.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS).convert("RGB")


frames = [render_frame(i) for i in range(FRAMES)]
frames[0].save(ASSETS / "jazagora-email-orbit-static.png", optimize=True)
frames[0].save(
    ASSETS / "jazagora-email-orbit.gif",
    save_all=True,
    append_images=frames[1:],
    duration=75,
    loop=0,
    optimize=True,
    disposal=2,
)


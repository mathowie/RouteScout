#!/usr/bin/env python3
"""Draw the fictional sample map and PNG app icons (requires Pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / "dist"
FONT_DIR = Path("/System/Library/Fonts/Supplemental")
S = 2


def font(size, bold=False):
    name = "Arial Bold.ttf" if bold else "Arial.ttf"
    try:
        return ImageFont.truetype(str(FONT_DIR / name), size * S)
    except OSError:
        return ImageFont.load_default(size=size * S)


def pts(points):
    return [(round(x * S), round(y * S)) for x, y in points]


def roads(draw, road_paths, halo, color, size):
    for paint, weight in [(halo, size + 3), (color, size)]:
        for path in road_paths:
            line = pts(path)
            draw.line(line, fill=paint, width=weight * S, joint="curve")
            r = weight * S / 2
            for x, y in (line[0], line[-1]):
                draw.ellipse([x-r, y-r, x+r, y+r], fill=paint)


def sample_map():
    w, h = 850, 560
    img = Image.new("RGB", (w * S, h * S), "#ecece3")
    d = ImageDraw.Draw(img)
    d.polygon(pts([(555, 0), (850, 0), (850, 366), (686, 402), (590, 302), (560, 214)]), fill="#d7e5c9")
    d.polygon(pts([(0, 419), (119, 433), (157, 560), (0, 560)]), fill="#dbe7ca")
    d.polygon(pts([(474, 332), (523, 317), (557, 340), (550, 401), (489, 412), (463, 378)]), fill="#dde8d2")
    d.line(pts([(839, -10), (774, 80), (795, 160), (780, 238), (818, 308), (817, 377), (764, 434), (820, 565)]),
           fill="#b8d8e5", width=12 * S, joint="curve")
    for x in [36, 77, 163, 208, 249, 294, 335, 384]:
        for y in range(24, 540, 37):
            if abs(y-300) < 17 or abs(y-440) < 18 or abs(y-155) < 18:
                continue
            d.rounded_rectangle([x*S, y*S, (x+17)*S, (y+13)*S], radius=3*S, fill="#dbdcd3", outline="#d4d6cb")
    road_paths = [
        [(125, -20), (125, 560)], [(450, -10), (450, 450), (497, 517), (535, 560)],
        [(-10, 300), (548, 300), (628, 275), (721, 279), (755, 332), (850, 341)],
        [(-10, 440), (473, 440), (589, 475), (850, 480)],
        [(450, 155), (510, 155), (553, 115), (624, 108), (654, 144),
         (643, 202), (580, 221), (510, 200), (450, 155)],
        [(0, 105), (224, 105), (308, 85), (386, 85), (450, 62), (534, 60)],
        [(0, 206), (229, 205), (308, 165), (450, 165)],
        [(0, 501), (312, 501), (365, 440)], [(310, 0), (310, 85), (308, 165), (309, 440)],
        [(543, 560), (587, 475), (612, 390), (648, 353), (759, 352)],
    ]
    roads(d, road_paths, "#d1d8ce", "#fbfcf7", 8)
    route_paths = [
        [(125, 440), (125, 300), (450, 300), (450, 155), (510, 155), (553, 115), (624, 108),
         (654, 144), (643, 202), (580, 221), (510, 200), (450, 155), (450, 440), (125, 440)],
    ]
    roads(d, route_paths, "#ffffff", "#315fe5", 6)
    for x, y in [(125, 300), (450, 300), (450, 155), (450, 440)]:
        d.ellipse(pts([(x-6, y-6), (x+6, y+6)]), fill="#315fe5", outline="white", width=2*S)
    d.rounded_rectangle(pts([(105, 419), (145, 459)]), radius=9*S, fill="#17356f", outline="white", width=3*S)
    d.rounded_rectangle(pts([(116, 433), (134, 446)]), radius=2*S, outline="white", width=2*S)
    d.line(pts([(117, 435), (125, 441), (133, 435)]), fill="white", width=2*S)
    for x, y, label in [(177, 279, "JUNIPER LANE"), (176, 422, "MARKET STREET"),
                         (38, 345, "ALDER ST"), (465, 255, "PARKSIDE DR"),
                         (564, 84, "CEDAR LOOP"), (665, 193, "ALDER PARK")]:
        d.text((x*S, y*S), label, font=font(12, True), fill="#52665d", stroke_width=1, stroke_fill="#eff2e8")
    d.polygon(pts([(783, 66), (792, 41), (801, 66), (792, 61)]), fill="#213955")
    d.text((787*S, 23*S), "N", font=font(13, True), fill="#213955")
    img.resize((w,h), Image.Resampling.LANCZOS).save(OUT / "demo-map.png", optimize=True)


def icon(size):
    img = Image.new("RGB", (512, 512), "#2356df")
    d = ImageDraw.Draw(img)
    p = [(133, 344), (180, 160), (267, 272), (374, 180), (374, 344)]
    d.line(p, fill="white", width=26, joint="curve")
    for x, y in (p[0], p[-1]):
        d.ellipse((x-18, y-18, x+18, y+18), fill="white")
    img.resize((size, size), Image.Resampling.LANCZOS).save(OUT / f"icon-{size}.png", optimize=True)


if __name__ == "__main__":
    sample_map()
    icon(192)
    icon(512)

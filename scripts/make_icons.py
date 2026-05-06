"""Generate PWA icons. Run once; output goes to /icons/."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "icons"
OUT.mkdir(exist_ok=True)

BG = (45, 55, 72)        # slate
FG = (245, 222, 179)     # light wood
ACCENT = (181, 136, 99)  # dark wood

def find_font(size):
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
        "/Library/Fonts/Arial Unicode.ttf",
        "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
    ]
    for c in candidates:
        try:
            return ImageFont.truetype(c, size)
        except Exception:
            pass
    return ImageFont.load_default()

def make_icon(size, maskable=False):
    img = Image.new("RGB", (size, size), BG)
    d = ImageDraw.Draw(img)
    # Draw a small chequered border to evoke the board
    sq = size // 16
    for i in range(16):
        for j in range(16):
            on_edge = i < 1 or j < 1 or i > 14 or j > 14
            if on_edge:
                color = FG if (i + j) % 2 == 0 else ACCENT
                d.rectangle([i*sq, j*sq, (i+1)*sq, (j+1)*sq], fill=color)
    # King glyph in center
    glyph = "♚"  # ♚
    font_size = int(size * (0.55 if maskable else 0.7))
    font = find_font(font_size)
    bbox = d.textbbox((0, 0), glyph, font=font)
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    x = (size - w) // 2 - bbox[0]
    y = (size - h) // 2 - bbox[1]
    d.text((x, y), glyph, font=font, fill=FG)
    return img

for size in (180, 192, 512):
    make_icon(size).save(OUT / f"icon-{size}.png", optimize=True)

# Apple touch icon and favicon
make_icon(180).save(OUT / "apple-touch-icon.png", optimize=True)
make_icon(64).save(OUT / "favicon.png", optimize=True)
# Maskable for Android adaptive icons
make_icon(512, maskable=True).save(OUT / "icon-maskable-512.png", optimize=True)

print("Icons generated:", sorted(p.name for p in OUT.iterdir()))

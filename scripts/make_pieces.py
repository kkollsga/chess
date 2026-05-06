"""Generate an original SVG chess piece set.

Pieces are 45x45 viewBox silhouettes, centered horizontally at x=22.5.
Color is controlled by `fill` and `stroke` attributes set per output (white vs black).

White pieces: white fill, black stroke (1.5)
Black pieces: near-black fill, black stroke (1.5) — slightly lighter than the
stroke so the outline is still legible.
"""
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "icons" / "pieces"
OUT.mkdir(parents=True, exist_ok=True)

# ---- Shared shapes --------------------------------------------------------
# Pedestal (base) sits at the bottom of every piece.
PEDESTAL = '<path d="M7 41 H38 V44 H7 Z" />'
# Mid-body trapezoid base above the pedestal — varies per piece.

def svg(content: str) -> str:
    """Wrap content in an SVG element with sensible defaults."""
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" '
        'fill="currentColor" stroke="#0a0a0a" stroke-width="1.4" '
        'stroke-linejoin="round" stroke-linecap="round">\n'
        f'{content}\n'
        '</svg>\n'
    )

# ---- Pawn -----------------------------------------------------------------
PAWN = """
<circle cx="22.5" cy="11" r="5"/>
<path d="M 17 16 Q 22.5 18 28 16 L 27 22 Q 22.5 24 18 22 Z"/>
<path d="M 14 22 L 31 22 Q 31 28 33 35 L 12 35 Q 14 28 14 22 Z"/>
<path d="M 10 35 H35 L37 41 H8 Z"/>
""" + PEDESTAL

# ---- Rook -----------------------------------------------------------------
ROOK = """
<path d="M 9 8 H13 V12 H17 V8 H20 V12 H25 V8 H28 V12 H32 V8 H36 V14 L33 16 H12 L9 14 Z"/>
<path d="M 12 16 H33 V20 H12 Z"/>
<path d="M 14 20 H31 L33 33 H12 Z"/>
<path d="M 11 33 H34 L36 38 H9 Z"/>
<path d="M 8 38 H37 V41 H8 Z"/>
""" + PEDESTAL

# ---- Bishop ---------------------------------------------------------------
BISHOP = """
<circle cx="22.5" cy="7" r="2"/>
<path d="M 22.5 9 Q 14 13 15 22 Q 22.5 25 30 22 Q 31 13 22.5 9 Z"/>
<path d="M 19 16 H26" stroke-width="1.6"/>
<path d="M 13 22 Q 22.5 26 32 22 L 32 25 Q 22.5 28 13 25 Z"/>
<path d="M 14 25 L 31 25 L 33 35 L 12 35 Z"/>
<path d="M 11 35 H34 L36 38 H9 Z"/>
<path d="M 8 38 H37 V41 H8 Z"/>
""" + PEDESTAL

# ---- Knight --------------------------------------------------------------
# Stylized horse-head silhouette facing right. Smooth curves: back of neck
# rises into the crown, forehead drops to the snout, throat tucks under,
# chest curves down to the body. Ear and eye added for character.
KNIGHT = """
<path d="M 12 38
         C 10 32 8 22 14 16
         C 17 12 22 8 28 9
         L 33 13
         L 36 19
         L 37 22
         L 35 24
         L 30 24
         C 27 25 25 27 24 30
         L 24 38
         Z"/>
<path d="M 22 8 L 19 3 L 18 10 Z"/>
<circle cx="29" cy="16" r="1.2" fill="#0a0a0a" stroke="none"/>
<path d="M 13 18 Q 11 24 13 30" fill="none" stroke-width="1.3"/>
<path d="M 16 21 Q 14 26 15 30" fill="none" stroke-width="1.1"/>
<path d="M 11 38 H24 L26 41 H9 Z"/>
""" + PEDESTAL

# ---- Queen ----------------------------------------------------------------
# Five spikes with small balls + crown band + body.
QUEEN = """
<circle cx="9"   cy="8"  r="1.7"/>
<circle cx="16"  cy="6"  r="1.7"/>
<circle cx="22.5" cy="5" r="1.8"/>
<circle cx="29"  cy="6"  r="1.7"/>
<circle cx="36"  cy="8"  r="1.7"/>
<path d="M 9 9
         L 12 18
         L 16 8
         L 19 18
         L 22.5 7
         L 26 18
         L 29 8
         L 33 18
         L 36 9
         L 35 22
         L 10 22
         Z"/>
<path d="M 11 22 H34 V25 H11 Z"/>
<path d="M 12 25 H33 L35 35 H10 Z"/>
<path d="M 9 35 H36 L38 38 H7 Z"/>
<path d="M 6 38 H39 V41 H6 Z"/>
""" + PEDESTAL

# ---- King -----------------------------------------------------------------
KING = """
<path d="M 21 3 H24 V8 H29 V11 H24 V16 H21 V11 H16 V8 H21 Z"/>
<path d="M 9 16 Q 22.5 13 36 16 L 34 24 Q 22.5 27 11 24 Z"/>
<path d="M 11 24 H34 V27 H11 Z"/>
<path d="M 12 27 H33 L35 36 H10 Z"/>
<path d="M 9 36 H36 L38 39 H7 Z"/>
<path d="M 6 39 H39 V41 H6 Z"/>
""" + PEDESTAL

PIECES = {'P': PAWN, 'R': ROOK, 'B': BISHOP, 'N': KNIGHT, 'Q': QUEEN, 'K': KING}

# White: white fill, black stroke. Black: dark grey fill (so the black outline
# stays visible against the silhouette).
def colorize(content: str, color: str) -> str:
    if color == 'w':
        return content.replace('fill="currentColor"', 'fill="#f8f8f8"')\
                      .replace('stroke="#0a0a0a"', 'stroke="#1a1a1a"')
    # black: medium-dark grey body, near-black outline
    return content.replace('fill="currentColor"', 'fill="#3a3a3a"')\
                  .replace('stroke="#0a0a0a"', 'stroke="#0a0a0a"')

for color in ('w', 'b'):
    for letter, body in PIECES.items():
        content = svg(body.strip())
        content = colorize(content, color)
        out = OUT / f"{color}{letter}.svg"
        out.write_text(content)

print('Generated:', sorted(p.name for p in OUT.iterdir()))

"""Procedural 32x32 pixel-art icons for the Inferno Lance weapon family.

Each sprite is drawn on a 32x32 grid from simple shapes (beam bands by distance
to a line segment, impact starburst, emitter ring, embers) using a small
hue-shifted palette, then upscaled with nearest-neighbour so pixels stay crisp.
Needs only the Python standard library (PNG is written with zlib + struct).

Usage (run from the repo root):
    python design/make_lance_icons.py <out.png> [scale] [variant]

    scale    integer upscale factor (default 4 -> 128x128, matching game icons;
             use 8-12 for a large preview)
    variant  lance (default) | phoenix | prism

Regenerate the shipped icons:
    python design/make_lance_icons.py assets/images/icon_inferno_lance.png 4 lance
    python design/make_lance_icons.py assets/images/icon_phoenix_ray.png 4 phoenix
    python design/make_lance_icons.py assets/images/icon_frostfire_prism.png 4 prism
"""
import math
import struct
import sys
import zlib

N = 32
SCALE = 4

# Hue-shifted fire ramp: shadows drift toward crimson/magenta, highlights toward yellow/white.
PAL = {
    'outline': (42, 8, 20),
    'deep': (122, 16, 38),
    'red': (200, 40, 30),
    'orange': (240, 100, 30),
    'amber': (255, 165, 42),
    'yellow': (255, 224, 102),
    'core': (255, 250, 225),
    'iron': (52, 40, 64),
    'steel': (104, 90, 128),
    'gold': (214, 150, 48),
}

VARIANT = sys.argv[3] if len(sys.argv) > 3 else 'lance'
if VARIANT == 'phoenix':
    # Solar gold body with rose/magenta shadows; gilded emitter
    PAL.update({
        'outline': (48, 8, 36), 'deep': (130, 20, 80), 'red': (214, 50, 110),
        'orange': (245, 150, 40), 'amber': (255, 196, 60), 'yellow': (255, 236, 140),
        'core': (255, 253, 240), 'iron': (110, 40, 70), 'steel': (190, 90, 120), 'gold': (255, 200, 70),
    })
elif VARIANT == 'prism':
    # Fire core wrapped in a cryo sheath; ice-crystal emitter
    PAL.update({
        'outline': (8, 28, 52), 'red': (20, 150, 200), 'orange': (100, 220, 245),
        'amber': (255, 150, 40), 'yellow': (255, 220, 110), 'core': (240, 254, 255),
        'iron': (30, 70, 110), 'steel': (90, 170, 220), 'gold': (160, 235, 255),
    })

grid = [[None] * N for _ in range(N)]


def put(x, y, c):
    if 0 <= x < N and 0 <= y < N:
        grid[y][x] = c


def seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy)), t


# --- Beam: emitter (bottom-left) to impact (top-right), slight taper toward the tip ---
AX, AY, BX, BY = 7.5, 24.5, 25.5, 6.5
for y in range(N):
    for x in range(N):
        d, t = seg_dist(x + 0.5, y + 0.5, AX, AY, BX, BY)
        w = 1.0 - 0.18 * t  # taper
        if d < 0.75 * w:
            c = 'core'
        elif d < 1.55 * w:
            c = 'yellow'
        elif d < 2.35 * w:
            c = 'amber'
        elif d < 3.0 * w:
            c = 'orange'
        elif d < 3.6 * w:
            c = 'red'
        elif d < 4.3 * w:
            c = 'outline'
        else:
            continue
        put(x, y, c)

# --- Impact starburst at the tip ---
IX, IY = 25, 6
for y in range(N):
    for x in range(N):
        d = math.hypot(x - IX, y - IY)
        if d <= 2.2:
            put(x, y, 'core')
        elif d <= 3.3:
            put(x, y, 'yellow')
        elif d <= 4.2 and grid[y][x] in (None, 'outline', 'red'):
            put(x, y, 'amber')
# Four-point flare rays
for i in range(3, 7):
    a = 'yellow' if i < 5 else 'amber'
    put(IX + i, IY, a)
    put(IX - i, IY, a)
    put(IX, IY + i, a)
    put(IX, IY - i, a)
# Small diagonal glints
for dx, dy in ((3, 3), (-3, -3), (3, -3)):
    put(IX + dx, IY + dy, 'amber')
# Outline anything orphaned around the flare
for y in range(N):
    for x in range(N):
        if grid[y][x] is None:
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < N and 0 <= ny < N and grid[ny][nx] in ('amber', 'yellow', 'core') and math.hypot(x - IX, y - IY) < 8:
                    grid[y][x] = 'outline'
                    break

# --- Focusing crystal emitter (bottom-left): iron housing, gold collar, glowing lens ---
EX, EY = 6, 25
for y in range(N):
    for x in range(N):
        d = math.hypot(x - EX, y - EY)
        if d <= 2.0:
            put(x, y, 'core' if (x - EX) + (y - EY) <= 0 else 'yellow')
        elif d <= 3.0:
            put(x, y, 'gold')
        elif d <= 4.2:
            # Top-left lit, bottom-right shadowed (single light source, no pillow shading)
            put(x, y, 'steel' if (x - EX) - (y - EY) < -1 else 'iron')
        elif d <= 4.9:  # < 5.0 avoids single-pixel knobs at the cardinal points
            put(x, y, 'outline')
put(EX - 1, EY - 1, 'core')

# --- Embers drifting off the beam (single pixels with dark backing for readability) ---
for ex, ey, c in ((13, 13, 'amber'), (21, 19, 'orange'), (17, 23, 'amber'), (11, 9, 'orange'), (27, 15, 'yellow')):
    put(ex, ey, c)

# --- Write RGBA PNG ---
out = sys.argv[1]
scale = int(sys.argv[2]) if len(sys.argv) > 2 else SCALE
W = N * scale
raw = bytearray()
for y in range(W):
    raw.append(0)
    row = grid[y // scale]
    for x in range(W):
        c = row[x // scale]
        if c is None:
            raw += b'\x00\x00\x00\x00'
        else:
            r, g, b = PAL[c]
            raw += bytes((r, g, b, 255))


def chunk(tag, data):
    return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)


png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', W, W, 8, 6, 0, 0, 0))
png += chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b'')
open(out, 'wb').write(png)
used = {c for row in grid for c in row if c}
print(f'wrote {out} {W}x{W}, {len(used)} colours')

"""Procedural 32x32 pixel-art icons for the hero Signature Weapons and their evolutions / fusions.

Five shapes (axe, greatsword, meteor, flask, orb), each in three palettes (base / evolution / fusion),
giving 15 icons: assets/images/sig_<weapon_id>.png. Everything is drawn from simple shapes with
hard-banded shading from a top-left light, auto-outlined, and upscaled with nearest-neighbour.
Needs only the Python standard library.

Usage (run from the repo root):
    python design/make_signature_icons.py <out_dir> [scale]        write the 15 icons (default scale 4 -> 128x128)
    python design/make_signature_icons.py --sheet <out.png> [scale] write one contact sheet for review

Regenerate the shipped icons:
    python design/make_signature_icons.py assets/images 4
"""
import math
import os
import struct
import sys
import zlib

N = 32


def hexc(h):
    if not isinstance(h, str):
        return h
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


class Canvas:
    def __init__(self, outline='#1a1020'):
        self.px = [[None] * N for _ in range(N)]
        self.outline = hexc(outline)

    def put(self, x, y, c):
        if 0 <= x < N and 0 <= y < N:
            self.px[y][x] = hexc(c) if isinstance(c, str) else c

    def get(self, x, y):
        return self.px[y][x] if 0 <= x < N and 0 <= y < N else None

    def circle(self, cx, cy, r, ramp, bias=0.0, ry=None):
        """Shaded sphere/ellipse; `ramp` runs dark -> light, light source top-left."""
        ramp = [hexc(c) for c in ramp]
        ry = ry or r
        for y in range(N):
            for x in range(N):
                nx = (x + 0.5 - cx) / r
                ny = (y + 0.5 - cy) / ry
                d = nx * nx + ny * ny
                if d > 1:
                    continue
                nz = math.sqrt(max(0.0, 1 - d))
                b = 0.5 + 0.5 * (-0.55 * nx - 0.6 * ny + 0.5 * nz) - bias
                self.px[y][x] = ramp[int(max(0.0, min(0.999, b)) * len(ramp))]

    def poly(self, pts, shade):
        """Fill a polygon (even-odd). `shade(x, y)` returns a colour for each covered pixel."""
        n = len(pts)
        for y in range(N):
            for x in range(N):
                px, py = x + 0.5, y + 0.5
                inside = False
                j = n - 1
                for i in range(n):
                    xi, yi = pts[i]
                    xj, yj = pts[j]
                    if (yi > py) != (yj > py) and px < (xj - xi) * (py - yi) / (yj - yi) + xi:
                        inside = not inside
                    j = i
                if inside:
                    self.px[y][x] = hexc(shade(px, py))

    def line(self, x0, y0, x1, y1, w, ramp):
        """Thick shaded line; light on the upper-left side."""
        ramp = [hexc(c) for c in ramp]
        dx, dy = x1 - x0, y1 - y0
        length = math.hypot(dx, dy)
        ux, uy = dx / length, dy / length
        nx, ny = -uy, ux
        for y in range(N):
            for x in range(N):
                px, py = x + 0.5 - x0, y + 0.5 - y0
                t = px * ux + py * uy
                s = px * nx + py * ny
                if 0 <= t <= length and abs(s) <= w / 2:
                    idx = int(max(0.0, min(0.999, 0.5 - s / w * (1 if nx + ny < 0 else -1))) * len(ramp))
                    self.px[y][x] = ramp[idx]

    def ring(self, cx, cy, rx, ry, tilt, color, front=True, thickness=1.2):
        """Elliptical ring; `front` draws the lower arc only (in front of a sphere), else the upper arc."""
        col = hexc(color)
        steps = 160
        for i in range(steps):
            a = 2 * math.pi * i / steps
            ex, ey = rx * math.cos(a), ry * math.sin(a)
            x = cx + ex * math.cos(tilt) - ey * math.sin(tilt)
            y = cy + ex * math.sin(tilt) + ey * math.cos(tilt)
            if (math.sin(a) > 0) == front:
                for ox in range(int(-thickness), int(thickness) + 1):
                    self.put(int(x) + ox if thickness > 1 else int(x), int(y), col)

    def dot(self, x, y, c):
        self.put(x, y, c)

    def finish(self):
        add = []
        for y in range(N):
            for x in range(N):
                if self.px[y][x] is None:
                    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                        v = self.get(nx, ny)
                        if v is not None and v != self.outline:
                            add.append((x, y))
                            break
        for x, y in add:
            self.px[y][x] = self.outline


# ----------------------------------------------------------------------------------------------
# Palettes (dark -> light ramps)
# ----------------------------------------------------------------------------------------------
STEEL = ('#3b4a63', '#6b7f9c', '#a9b8cf', '#dbe5f2', '#ffffff')
CRIMSON = ('#3f0a0a', '#8f1b1b', '#d02828', '#f26a6a', '#ffd0d0')
STORM = ('#1d3557', '#2f6fd0', '#6cc4f5', '#d4f0ff', '#ffffff')
WOOD = ('#2e1707', '#5e3410', '#935a25', '#c48a48')
GOLD = ('#6b4a0e', '#b8861c', '#eec04a', '#fde68a')
SPECTRAL = ('#2a4a6b', '#5b8fbf', '#a8d3f0', '#e0f4ff', '#ffffff')
WIND = ('#0b5568', '#1596b0', '#5ed7ec', '#c5f6ff', '#ffffff')
DAWN = ('#8a5a06', '#d99a14', '#fcd34d', '#fff0b0', '#ffffff')
FIRE = ('#7a1410', '#c8301c', '#f26a1a', '#ffb02e', '#ffe58a')
ROCK = ('#2a1f1c', '#4f3b34', '#7a5e52', '#a38472')
APOC = ('#2a0a22', '#7a1236', '#d42a4a', '#ff7a70', '#ffd7b0')
STAR = ('#1c0a3a', '#4b1d8f', '#8a3fd8', '#c084fc', '#f0dcff')
ACID = ('#1a4710', '#2f8a1c', '#5fd02a', '#a3f04a', '#e4ffb0')
GLASS = ('#4a6a78', '#7fa3b4', '#b9d6e2', '#e6f4fa')
IRON = ('#14161c', '#262a33', '#3d4350', '#5a6372')
ORB = ('#2a1670', '#5b3bd0', '#8f6cf2', '#c4b0ff', '#f0e8ff')
VOID = ('#080414', '#1a0a3a', '#3a1670', '#6a2fc4')
STORMORB = ('#0f2a5a', '#2358b8', '#4fa0ee', '#a6dcff', '#f0fbff')


def x_shade(ramp, x0, x1):
    r = [hexc(c) for c in ramp]
    return lambda x, y: r[int(max(0.0, min(0.999, (x - x0) / (x1 - x0))) * len(r))]


def axe(blade, accent=None, spikes=False):
    c = Canvas()
    br = [hexc(h) for h in blade]
    c.line(6, 28, 19.5, 11.5, 3.2, WOOD)
    # crescent axe head: a big disc with a smaller disc cut out toward the haft
    c1x, c1y, r1 = 22.5, 11.5, 9.2
    c2x, c2y, r2 = 15.5, 11.5, 7.0
    for y in range(N):
        for x in range(N):
            px, py = x + 0.5, y + 0.5
            d1 = math.hypot(px - c1x, py - c1y)
            d2 = math.hypot(px - c2x, py - c2y)
            if d1 <= r1 and d2 > r2:
                t = max(0.0, min(0.999, (d2 - r2) / (r1 + c1x - c2x - r2)))
                idx = int(t * (len(br) - 1))
                if d1 > r1 - 1.3:  # bright cutting edge on the outer rim
                    idx = len(br) - 1
                elif py < c1y - 2:  # catch the light on the upper half
                    idx = min(len(br) - 1, idx + 1)
                c.px[y][x] = br[idx]
    if spikes:
        # jagged teeth along the outer edge
        for ang in (-62, -22, 22, 62):
            a = math.radians(ang)
            bx0, by0 = c1x + math.cos(a) * (r1 - 1.5), c1y + math.sin(a) * (r1 - 1.5)
            tx0, ty0 = c1x + math.cos(a) * (r1 + 2.6), c1y + math.sin(a) * (r1 + 2.6)
            px_, py_ = -math.sin(a) * 1.6, math.cos(a) * 1.6
            c.poly([(bx0 + px_, by0 + py_), (tx0, ty0), (bx0 - px_, by0 - py_)], lambda x, y: br[3])
    # socket joining the haft to the head
    c.line(18.5, 12.5, 23.8, 11.5, 3.4, blade)
    # binding wrap
    for i in range(3):
        c.put(13 + i * 2, 20 - i * 2, GOLD[1])
        c.put(14 + i * 2, 20 - i * 2, GOLD[2])
    if accent == 'blood':
        for x, y in ((25, 22), (26, 23), (26, 25), (20, 22), (20, 23)):
            c.dot(x, y, '#dc2626')
    if accent == 'lightning':
        zig = [(27, 5), (24, 9), (28, 11), (25, 17)]
        for (x0, y0), (x1, y1) in zip(zig, zig[1:]):
            for i in range(6):
                t = i / 5
                c.put(int(x0 + (x1 - x0) * t), int(y0 + (y1 - y0) * t), '#facc15')
        c.dot(25, 18, '#fff7c2')
    c.finish()
    return c


def sword(blade, guard=GOLD, accent=None):
    c = Canvas()
    # direction from hilt (bottom-left) to tip (top-right)
    bx, by, tx, ty = 11.0, 21.0, 27.0, 5.0
    dx, dy = tx - bx, ty - by
    ln = math.hypot(dx, dy)
    ux, uy = dx / ln, dy / ln
    nx, ny = -uy, ux
    pr = [hexc(h) for h in blade]

    def blade_shade(x, y):
        s = (x - bx) * nx + (y - by) * ny
        idx = int(max(0.0, min(0.999, 0.5 - s / 6.5)) * len(pr))
        return pr[idx]

    w0 = 3.4
    pts = [
        (bx + nx * w0, by + ny * w0),
        (bx + nx * (w0 - 0.4) + ux * ln * 0.88, by + ny * (w0 - 0.4) + uy * ln * 0.88),
        (tx, ty),
        (bx - nx * (w0 - 0.4) + ux * ln * 0.88, by - ny * (w0 - 0.4) + uy * ln * 0.88),
        (bx - nx * w0, by - ny * w0),
    ]
    c.poly(pts, blade_shade)
    # fuller (central groove)
    fl = [hexc(blade[1]), hexc(blade[0])]
    for i in range(int(ln * 0.8)):
        t = 2 + i
        c.put(int(bx + ux * t), int(by + uy * t), fl[0])
    # crossguard
    c.line(bx - nx * 7.5 - ux, by - ny * 7.5 - uy, bx + nx * 7.5 - ux, by + ny * 7.5 - uy, 3.0, guard)
    # grip and pommel
    c.line(bx - ux * 1.5, by - uy * 1.5, bx - ux * 6.5, by - uy * 6.5, 2.6, WOOD)
    c.circle(bx - ux * 8.2, by - uy * 8.2, 2.4, guard)
    if accent == 'wind':
        for (cx, cy, r) in ((8, 8, 4), (23, 24, 3)):
            for i in range(14):
                a = i * 0.45
                c.put(int(cx + math.cos(a) * (r - i * 0.1)), int(cy + math.sin(a) * (r - i * 0.1)), '#c5f6ff')
    if accent == 'dawn':
        for ang in range(0, 360, 45):
            a = math.radians(ang)
            for r in (13, 14):
                c.put(int(tx - 4 + math.cos(a) * r * 0.5), int(ty + 4 + math.sin(a) * r * 0.5), '#fff0b0')
    if accent == 'ghost':
        for sx, sy in ((6, 6), (26, 25), (4, 20)):
            c.dot(sx, sy, '#a8d3f0')
    c.finish()
    return c


def meteor(rock, fire, craters=True, cracks=False, ring=False):
    c = Canvas()
    fr = [hexc(h) for h in fire]
    # flame tail streaming toward the upper right
    sx, sy, ex, ey = 12.5, 20.5, 30.0, 3.0
    for layer in (1.0, 0.55):
        steps = 22
        for i in range(steps, -1, -1):
            t = i / steps
            cx = sx + (ex - sx) * t
            cy = sy + (ey - sy) * t
            r = (6.6 * (1 - t) + 1.3) * layer
            idx = max(0, min(len(fr) - 1, int((1 - t) * (len(fr) - 1) + (1 if layer < 1 else 0))))
            for y in range(N):
                for x in range(N):
                    if (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r:
                        c.px[y][x] = fr[idx]
    c.circle(12.5, 20.5, 8.5, rock, bias=0.05)
    if craters:
        for cx, cy, r in ((10, 19, 2.0), (15, 23, 1.6), (13, 16, 1.3)):
            for y in range(N):
                for x in range(N):
                    if (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r and c.get(x, y) is not None:
                        c.put(x, y, rock[0])
    if cracks:
        for x, y in ((9, 22), (10, 23), (11, 24), (14, 18), (15, 19), (16, 20), (12, 15), (12, 14)):
            c.dot(x, y, fire[-2])
    if ring:
        c.ring(12.5, 20.5, 13.5, 4.5, -0.45, '#c084fc', front=True, thickness=1)
        c.ring(12.5, 20.5, 13.5, 4.5, -0.45, '#6a2fc4', front=False, thickness=1)
    c.finish()
    return c


def flask(liquid, kind='flask'):
    c = Canvas('#0f2a14')
    lr = [hexc(h) for h in liquid]
    if kind == 'cauldron':
        c.circle(16, 20, 12.5, IRON, ry=9.5)
        c.circle(16, 12.5, 12.0, ACID, ry=3.8)
        c.line(4, 12, 28, 12, 2.0, IRON)
        # rim
        for x in range(5, 28):
            c.put(x, 11, hexc(IRON[3]))
        # legs and handles
        c.dot(8, 29, IRON[1]); c.dot(9, 29, IRON[1]); c.dot(23, 29, IRON[1]); c.dot(24, 29, IRON[1])
        for bx_, by_, r in ((12, 8, 2), (18, 6, 1.5), (21, 9, 1.5), (9, 10, 1)):
            for y in range(N):
                for x in range(N):
                    if (x + 0.5 - bx_) ** 2 + (y + 0.5 - by_) ** 2 <= r * r:
                        c.put(x, y, '#c9f56a')
        # skull emblem
        c.dot(14, 20, '#e4ffb0'); c.dot(15, 20, '#e4ffb0'); c.dot(17, 20, '#e4ffb0'); c.dot(18, 20, '#e4ffb0')
        c.dot(16, 22, '#e4ffb0')
        c.finish()
        return c
    if kind == 'seeker':
        # exhaust first, then a diagonal missile with a glowing acid nose and fins
        for i in range(7, -1, -1):
            t = i / 7
            cx, cy, r = 7 - t * 3.5, 25 + t * 3.5, 4.2 * (1 - t * 0.7) + 0.8
            col = hexc('#e4ffb0') if t < 0.3 else hexc('#a3f04a') if t < 0.65 else hexc('#2f8a1c')
            for y in range(N):
                for x in range(N):
                    if (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r:
                        c.px[y][x] = col
        c.line(9, 23, 22, 10, 6.0, IRON)
        c.poly([(8, 18), (12, 22), (8, 24)], lambda x, y: IRON[1])
        c.poly([(14, 28), (10, 24), (16, 24)], lambda x, y: IRON[1])
        c.circle(23, 9, 4.6, ACID)
        c.line(12.5, 20, 16, 16.5, 1.4, ('#5fd02a', '#a3f04a'))
        for x, y in ((24, 17), (26, 22), (21, 26)):
            c.dot(x, y, '#5fd02a')
            c.dot(x, y + 1, '#a3f04a')
        c.finish()
        return c
    # classic round-bottom flask
    c.circle(16, 20, 9, GLASS)
    c.circle(16, 22, 8.2, liquid, ry=6.2)
    c.line(13.5, 5, 18.5, 5, 3.0, GLASS) if False else None
    for y in range(7, 13):
        for x in range(13, 19):
            c.put(x, y, GLASS[3] if x == 13 else GLASS[2] if x < 17 else GLASS[1])
    # neck rim and cork
    for x in range(12, 20):
        c.put(x, 6, GLASS[3])
    for y in range(3, 6):
        for x in range(13, 19):
            c.put(x, y, WOOD[2] if x < 17 else WOOD[1])
    # liquid surface line, bubbles, highlight
    for x in range(10, 23):
        if c.get(x, 18) == hexc(liquid[1]) or c.get(x, 18) == hexc(liquid[2]):
            c.put(x, 18, hexc(liquid[3]))
    for bx_, by_ in ((14, 22), (18, 24), (16, 20), (19, 21)):
        c.dot(bx_, by_, liquid[4])
    c.dot(11, 17, '#ffffff'); c.dot(11, 18, '#ffffff'); c.dot(12, 16, '#ffffff')
    # drip
    c.dot(25, 25, liquid[2]); c.dot(25, 26, liquid[3])
    c.finish()
    return c


def orb(body, glow, kind='orb'):
    c = Canvas('#0a0820')
    c.ring(16, 16, 14.5, 4.6, -0.5, glow, front=False, thickness=1)
    c.circle(16, 16, 9.5, body)
    c.ring(16, 16, 14.5, 4.6, -0.5, glow, front=True, thickness=1)
    if kind == 'orb':
        # constellation sparkles on the surface
        for x, y in ((12, 12), (19, 14), (15, 19), (20, 10)):
            c.dot(x, y, '#ffffff')
        c.dot(13, 12, glow); c.dot(11, 12, glow)
    if kind == 'singularity':
        c.circle(16, 16, 5.5, VOID, bias=-0.1)
        c.ring(16, 16, 10.5, 3.2, -0.5, '#ffb02e', front=True, thickness=1)
    if kind == 'storm':
        zig = [(18, 8), (14, 15), (18, 16), (13, 24)]
        for (x0, y0), (x1, y1) in zip(zig, zig[1:]):
            for i in range(7):
                t = i / 6
                c.put(int(x0 + (x1 - x0) * t), int(y0 + (y1 - y0) * t), '#facc15')
                c.put(int(x0 + (x1 - x0) * t) + 1, int(y0 + (y1 - y0) * t), '#fff7c2')
    for x, y in ((4, 6), (28, 9), (5, 26), (27, 25)):
        c.dot(x, y, '#ffffff')
        c.dot(x - 1, y, glow); c.dot(x + 1, y, glow); c.dot(x, y - 1, glow); c.dot(x, y + 1, glow)
    c.finish()
    return c


ICONS = {
    'whirling_axe': lambda: axe(STEEL),
    'bloodreaver': lambda: axe(CRIMSON, accent='blood', spikes=True),
    'thunder_cleaver': lambda: axe(STORM, accent='lightning'),
    'spectral_greatsword': lambda: sword(SPECTRAL, accent='ghost'),
    'tempest_oath': lambda: sword(WIND, accent='wind'),
    'dawnbreaker': lambda: sword(DAWN, accent='dawn'),
    'meteor_storm': lambda: meteor(ROCK, FIRE),
    'armageddon': lambda: meteor(IRON, APOC, cracks=True),
    'collapsing_star': lambda: meteor(VOID, STAR, craters=False, ring=True),
    'corrosive_flask': lambda: flask(ACID),
    'pandemic_cauldron': lambda: flask(ACID, kind='cauldron'),
    'blight_seekers': lambda: flask(ACID, kind='seeker'),
    'astral_orb': lambda: orb(ORB, '#c4b0ff'),
    'astral_singularity': lambda: orb(STAR, '#ffb02e', kind='singularity'),
    'storm_orb': lambda: orb(STORMORB, '#7dd3fc', kind='storm'),
}


def to_png(rows, w, h):
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        for x in range(w):
            col = rows[y][x]
            raw += b'\x00\x00\x00\x00' if col is None else bytes((col[0], col[1], col[2], 255))

    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)

    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b'')


def scaled(canvas, scale):
    w = N * scale
    return [[canvas.px[y // scale][x // scale] for x in range(w)] for y in range(w)], w


if __name__ == '__main__':
    args = sys.argv[1:]
    if args and args[0] == '--sheet':
        out = args[1]
        scale = int(args[2]) if len(args) > 2 else 5
        names = list(ICONS)
        cols, rows_n = 3, 5
        pad = 4
        cell = N * scale
        W = cols * cell + (cols + 1) * pad
        H = rows_n * cell + (rows_n + 1) * pad
        sheet = [[(40, 36, 56)] * W for _ in range(H)]
        for i, name in enumerate(names):
            r, cidx = divmod(i, cols)
            ox = pad + cidx * (cell + pad)
            oy = pad + r * (cell + pad)
            rows, w = scaled(ICONS[name](), scale)
            for y in range(w):
                for x in range(w):
                    if rows[y][x] is not None:
                        sheet[oy + y][ox + x] = rows[y][x]
        with open(out, 'wb') as f:
            f.write(to_png(sheet, W, H))
        print(f'wrote {out}')
    else:
        out_dir = args[0] if args else '.'
        scale = int(args[1]) if len(args) > 1 else 4
        os.makedirs(out_dir, exist_ok=True)
        for name, fn in ICONS.items():
            rows, w = scaled(fn(), scale)
            path = os.path.join(out_dir, f'sig_{name}.png')
            with open(path, 'wb') as f:
                f.write(to_png(rows, w, w))
            print(f'wrote {path} ({w}x{w})')

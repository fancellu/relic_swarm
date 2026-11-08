"""Procedural 32x32 pixel-art icons for the four Boosters (burn, poison, frost, knockback).

Each sprite is drawn on a 32x32 grid from simple shapes with hard-banded shading from a single
top-left light source, then auto-outlined and upscaled with nearest-neighbour so pixels stay crisp.
Needs only the Python standard library (PNG is written with zlib + struct).

Usage (run from the repo root):
    python design/make_booster_icons.py <out_dir> [scale]

    scale   integer upscale factor (default 4 -> 128x128, matching other game icons;
            use 10 for a large preview)

Regenerate the shipped icons:
    python design/make_booster_icons.py assets/images 4
"""
import math
import os
import struct
import sys
import zlib

N = 32


def hexc(h):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


class Canvas:
    def __init__(self, outline):
        self.px = [[None] * N for _ in range(N)]
        self.outline = hexc(outline)

    def put(self, x, y, c):
        if 0 <= x < N and 0 <= y < N:
            self.px[y][x] = c

    def get(self, x, y):
        return self.px[y][x] if 0 <= x < N and 0 <= y < N else None

    def ellipse(self, cx, cy, rx, ry, ramp, seam=None, bias=0.0):
        """Shaded ellipse. `ramp` runs dark -> light. `seam` darkens the rim where it overlaps existing art."""
        ramp = [hexc(c) for c in ramp]
        seam_c = hexc(seam) if seam else None
        for y in range(N):
            for x in range(N):
                nx = (x + 0.5 - cx) / rx
                ny = (y + 0.5 - cy) / ry
                d = nx * nx + ny * ny
                if d > 1:
                    continue
                if seam_c and d > 0.74 and self.get(x, y) is not None:
                    self.put(x, y, seam_c)
                    continue
                nz = math.sqrt(max(0.0, 1 - d))
                b = 0.5 + 0.5 * (-0.55 * nx - 0.6 * ny + 0.5 * nz) - bias
                b = max(0.0, min(0.999, b))
                self.put(x, y, ramp[int(b * len(ramp))])

    def rect(self, x0, y0, x1, y1, ramp, horizontal=True):
        """Shaded rectangle (inclusive). Bands run left->right (dark on the right) or top->bottom."""
        ramp = [hexc(c) for c in ramp]
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                t = (x - x0) / max(1, x1 - x0) if horizontal else (y - y0) / max(1, y1 - y0)
                self.put(x, y, ramp[int((1 - t) * (len(ramp) - 1) + 0.5)])

    def dot(self, x, y, color):
        self.put(x, y, hexc(color))

    def finish(self):
        """Adds a 1px outline around all filled pixels."""
        add = []
        for y in range(N):
            for x in range(N):
                if self.px[y][x] is None:
                    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                        if self.get(nx, ny) is not None and self.get(nx, ny) != self.outline:
                            add.append((x, y))
                            break
        for x, y in add:
            self.px[y][x] = self.outline


def flame_icon():
    c = Canvas('#2a0814')
    ramp = [hexc(h) for h in ('#7a1020', '#c8281e', '#f06414', '#ffa52a', '#ffe066')]

    def cx_at(t, base):
        return base + 5.0 * (1 - t) ** 1.8  # tip leans right

    def half_at(t, scale):
        if t < 0.62:
            return 11 * scale * (t / 0.62) ** 1.4
        return 11 * scale * math.sqrt(max(0.0, 1 - ((t - 0.62) / 0.38) ** 2))

    top, bottom = 2, 29
    for y in range(top, bottom + 1):
        t = (y + 0.5 - top) / (bottom - top)
        h = half_at(t, 1.0)
        if h < 0.4:
            continue
        cx = cx_at(t, 15.5)
        for x in range(N):
            r = abs(x + 0.5 - cx) / h
            if r > 1:
                continue
            s = min(1.0, r * 0.9 + 0.25 * (1 - t))
            idx = 4 if s < 0.25 else 3 if s < 0.45 else 2 if s < 0.7 else 1 if s < 0.9 else 0
            c.put(x, y, ramp[idx])

    # white-hot inner flame, lower and smaller
    itop, ibottom = 11, 27
    for y in range(itop, ibottom + 1):
        t = (y + 0.5 - itop) / (ibottom - itop)
        h = half_at(t, 0.5)
        if h < 0.4:
            continue
        cx = cx_at(t, 15.5) - 1.5 * (1 - t)
        for x in range(N):
            r = abs(x + 0.5 - cx) / h
            if r > 1:
                continue
            c.put(x, y, hexc('#fffae1') if r < 0.5 else hexc('#ffe066'))

    # a few embers
    for ex, ey, col in ((6, 12, '#ffa52a'), (25, 8, '#ffe066'), (4, 20, '#f06414')):
        c.dot(ex, ey, col)
    c.finish()
    return c


def poison_icon():
    c = Canvas('#10260f')
    stem = ('#a8a29e', '#d6cfc4', '#f5f0e6', '#fffbeb')
    cap = ('#14532d', '#15803d', '#22c55e', '#4ade80', '#86efac')
    # stem first, then cap overlaps it
    c.rect(11, 17, 20, 27, stem, horizontal=True)
    c.dot(11, 27, '#a8a29e')
    c.dot(20, 27, '#a8a29e')
    # underside of the cap (dark gills band)
    c.rect(4, 16, 27, 18, ('#365314', '#4d7c0f'), horizontal=False)
    # cap dome: top half of an ellipse
    ramp = [hexc(h) for h in cap]
    cx, cy, rx, ry = 15.5, 17.0, 13.0, 12.5
    for y in range(N):
        for x in range(N):
            if y + 0.5 > cy:
                continue
            nx = (x + 0.5 - cx) / rx
            ny = (y + 0.5 - cy) / ry
            d = nx * nx + ny * ny
            if d > 1:
                continue
            nz = math.sqrt(max(0.0, 1 - d))
            b = 0.5 + 0.5 * (-0.55 * nx - 0.6 * ny + 0.5 * nz) - 0.18
            b = max(0.0, min(0.999, b))
            c.put(x, y, ramp[int(b * len(ramp))])
    # spots
    for sx, sy, r in ((10, 9, 2.4), (20, 8, 2.0), (16, 12, 2.0), (7, 14, 1.4), (24, 13, 1.4)):
        for y in range(N):
            for x in range(N):
                if (x + 0.5 - sx) ** 2 + (y + 0.5 - sy) ** 2 <= r * r and c.get(x, y) is not None:
                    c.put(x, y, hexc('#fef9c3'))
    # drip of poison
    c.dot(25, 21, '#22c55e')
    c.dot(25, 22, '#4ade80')
    c.finish()
    return c


def frost_icon():
    c = Canvas('#0b2540')
    snow = ('#7aa7c7', '#a9cbe3', '#d4e8f5', '#f2f9ff', '#ffffff')
    c.ellipse(15.5, 21.5, 9.0, 8.5, snow)
    c.ellipse(15.5, 10.0, 6.6, 6.4, snow, seam='#7aa7c7')
    # scarf
    c.rect(9, 15, 22, 17, ('#0e7490', '#06b6d4', '#67e8f9'), horizontal=False)
    c.rect(20, 17, 22, 21, ('#0e7490', '#06b6d4'), horizontal=True)
    # face
    c.dot(13, 9, '#1e293b')
    c.dot(13, 8, '#1e293b')
    c.dot(18, 9, '#1e293b')
    c.dot(18, 8, '#1e293b')
    for nx_, ny_, col in ((15, 11, '#f97316'), (16, 11, '#f97316'), (17, 11, '#ea580c'), (18, 12, '#c2410c'), (19, 12, '#c2410c')):
        c.dot(nx_, ny_, col)
    # coal buttons
    for by in (20, 23, 26):
        c.dot(15, by, '#1e293b')
        c.dot(16, by, '#1e293b')
    # stick arms
    for i in range(5):
        c.dot(6 - i, 20 - i // 2 - 1, '#7c4a1e')
        c.dot(25 + i, 20 - i // 2 - 1, '#7c4a1e')
    # sparkles
    for sx, sy in ((4, 6), (27, 5), (28, 26)):
        c.dot(sx, sy, '#e0f7ff')
        c.dot(sx - 1, sy, '#67e8f9')
        c.dot(sx + 1, sy, '#67e8f9')
        c.dot(sx, sy - 1, '#67e8f9')
        c.dot(sx, sy + 1, '#67e8f9')
    c.finish()
    return c


def knockback_icon():
    c = Canvas('#2a0a0a')
    red = ('#7f1d1d', '#b91c1c', '#ef4444', '#f87171', '#fecaca')
    # cuff and band first
    c.rect(9, 21, 21, 29, ('#94a3b8', '#cbd5e1', '#f1f5f9', '#ffffff'), horizontal=True)
    c.rect(9, 21, 21, 22, ('#7f1d1d', '#b91c1c'), horizontal=False)
    # thumb (left), then the fist
    c.ellipse(7.0, 17.0, 4.2, 5.4, red, seam='#7f1d1d', bias=0.22)
    c.ellipse(16.0, 13.5, 10.5, 9.5, red, seam='#7f1d1d', bias=0.22)
    # knuckle crease and laces
    for x in range(12, 22):
        c.dot(x, 20, '#7f1d1d')
    for lx in (13, 16, 19):
        c.dot(lx, 25, '#94a3b8')
        c.dot(lx, 26, '#94a3b8')
    # impact lines
    for dx, dy in ((0, 0), (1, 0), (2, 0)):
        c.dot(25 + dx, 8 + dy, '#fde68a')
        c.dot(26 + dx, 13 + dy, '#fde68a')
        c.dot(25 + dx, 18 + dy, '#fde68a')
    c.finish()
    return c


ICONS = {
    'booster_burn.png': flame_icon,
    'booster_poison.png': poison_icon,
    'booster_frost.png': frost_icon,
    'booster_knockback.png': knockback_icon,
}


def write_png(path, canvas, scale):
    w = N * scale
    raw = bytearray()
    for y in range(w):
        raw.append(0)
        row = canvas.px[y // scale]
        for x in range(w):
            col = row[x // scale]
            raw += b'\x00\x00\x00\x00' if col is None else bytes((col[0], col[1], col[2], 255))

    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, w, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)


if __name__ == '__main__':
    out_dir = sys.argv[1] if len(sys.argv) > 1 else '.'
    scale = int(sys.argv[2]) if len(sys.argv) > 2 else 4
    os.makedirs(out_dir, exist_ok=True)
    for name, fn in ICONS.items():
        write_png(os.path.join(out_dir, name), fn(), scale)
        print(f'wrote {os.path.join(out_dir, name)} ({N * scale}x{N * scale})')

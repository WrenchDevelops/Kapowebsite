"""Build KAPO Custom Black from the wordmark's geometry.

The K / A / P logo is the design source. Uppercase stems are ~30% of the
cap height, terminals are round, the A has an open crotch and a triangular
counter, and the P bowl carries a horizontal pill counter. Lowercase
descenders keep the bowl in the x-height and drop only the stem or tail.
"""

from __future__ import annotations

import math
import traceback
from pathlib import Path

import pathops
from fontTools.cu2qu.cu2qu import curve_to_quadratic
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

# ---------------------------------------------------------------------------
# Design grid. Measured from the KAPO wordmark (cap height 175 px in the
# 1080 logo): stem / cap = 0.30, K width / cap = 0.93, A = 1.04, P = 0.94.
# ---------------------------------------------------------------------------

UPM = 1000
CAP = 720
X = 540
ASC = 768
DESC = -204
OVER = 18
STEM = 214
LC = 166

OUT = Path(r"C:\Users\bende\OneDrive\Desktop\Kapo website\kapo-custom-font-final")
LOGO = Path(r"C:\Users\bende\Downloads\Kapo large logo.png")

ROUND = pathops.LineCap.ROUND_CAP
RJOIN = pathops.LineJoin.ROUND_JOIN


def _path():
    return pathops.Path()


def add_ellipse_arc(path, cx, cy, rx, ry, a0, a1, move=False):
    """Elliptical arc, degrees, 0 = east. Sweep is a1 - a0 (negative = clockwise)."""
    sweep = a1 - a0
    steps = max(1, int(math.ceil(abs(sweep) / 80.0)))
    for i in range(steps):
        t0 = math.radians(a0 + sweep * i / steps)
        t1 = math.radians(a0 + sweep * (i + 1) / steps)
        p0 = (cx + rx * math.cos(t0), cy + ry * math.sin(t0))
        p3 = (cx + rx * math.cos(t1), cy + ry * math.sin(t1))
        k = 4.0 / 3.0 * math.tan((t1 - t0) / 4.0)
        c1 = (p0[0] + k * (-rx * math.sin(t0)), p0[1] + k * (ry * math.cos(t0)))
        c2 = (p3[0] - k * (-rx * math.sin(t1)), p3[1] - k * (ry * math.cos(t1)))
        if i == 0 and move:
            path.moveTo(*p0)
        path.cubicTo(c1[0], c1[1], c2[0], c2[1], p3[0], p3[1])


def stroke(path, width):
    path.stroke(width, ROUND, RJOIN, 2.0)
    path.convertConicsToQuads(0.45)
    return path


def polyline(points, width):
    path = _path()
    path.moveTo(*points[0])
    for x, y in points[1:]:
        path.lineTo(x, y)
    return stroke(path, width)


def curve(cmds, width):
    path = _path()
    for cmd in cmds:
        op = cmd[0]
        if op == "M":
            path.moveTo(cmd[1], cmd[2])
        elif op == "L":
            path.lineTo(cmd[1], cmd[2])
        elif op == "C":
            path.cubicTo(cmd[1], cmd[2], cmd[3], cmd[4], cmd[5], cmd[6])
        else:
            raise ValueError(op)
    return stroke(path, width)


def oval(cx, cy, rx, ry):
    k = 0.5522847498307936
    path = _path()
    path.moveTo(cx + rx, cy)
    path.cubicTo(cx + rx, cy + ry * k, cx + rx * k, cy + ry, cx, cy + ry)
    path.cubicTo(cx - rx * k, cy + ry, cx - rx, cy + ry * k, cx - rx, cy)
    path.cubicTo(cx - rx, cy - ry * k, cx - rx * k, cy - ry, cx, cy - ry)
    path.cubicTo(cx + rx * k, cy - ry, cx + rx, cy - ry * k, cx + rx, cy)
    path.close()
    return path


def round_rect(x, y, w, h, rad):
    r = max(1.0, min(rad, w / 2.0, h / 2.0))
    path = _path()
    path.moveTo(x + r, y)
    path.lineTo(x + w - r, y)
    add_ellipse_arc(path, x + w - r, y + r, r, r, -90, 0)
    path.lineTo(x + w, y + h - r)
    add_ellipse_arc(path, x + w - r, y + h - r, r, r, 0, 90)
    path.lineTo(x + r, y + h)
    add_ellipse_arc(path, x + r, y + h - r, r, r, 90, 180)
    path.lineTo(x, y + r)
    add_ellipse_arc(path, x + r, y + r, r, r, 180, 270)
    path.close()
    return path


def unite(*paths):
    acc = paths[0]
    for other in paths[1:]:
        acc = pathops.op(acc, other, pathops.PathOp.UNION, clockwise=True)
    return acc


def cut(base, hole):
    return pathops.op(base, hole, pathops.PathOp.DIFFERENCE, clockwise=True)


def ring(cx, cy, rx, ry, irx, iry):
    return cut(oval(cx, cy, rx, ry), oval(cx, cy, irx, iry))


def soften(points, rad):
    """Filled polygon with rounded corners, produced by expanding a sharp fill."""
    path = _path()
    path.moveTo(*points[0])
    for x, y in points[1:]:
        path.lineTo(x, y)
    path.close()
    edge = _path()
    edge.moveTo(*points[0])
    for x, y in points[1:]:
        edge.lineTo(x, y)
    edge.close()
    edge = stroke(edge, rad * 2.0)
    return unite(path, edge)


def arc_stroke(cx, cy, rx, ry, a0, a1, width):
    path = _path()
    add_ellipse_arc(path, cx, cy, rx, ry, a0, a1, move=True)
    return stroke(path, width)


def ncontours(path):
    return sum(1 for _ in path.contours)


def shift(path, dx, dy):
    # pathops.Path.transform returns a new path and leaves the original in place.
    return path.transform(1, 0, 0, 1, dx, dy)


def flip_x(path):
    x0, _y0, x1, _y1 = path.bounds
    return path.transform(-1, 0, 0, 1, x0 + x1, 0)


def flip_y(path):
    _x0, y0, _x1, y1 = path.bounds
    return path.transform(1, 0, 0, -1, 0, y0 + y1)


# ---------------------------------------------------------------------------
# Shared lowercase bowl. Same outer oval and counter for a, b, d, g, o, p, q.
# ---------------------------------------------------------------------------

def bowl_metrics():
    top = X + OVER
    bot = -OVER
    ry = (top - bot) / 2.0
    cy = (top + bot) / 2.0
    rx = ry * 1.05
    wall = LC * 0.98
    return cy, rx, ry, rx - wall, ry - wall, wall


def lc_bowl(cx):
    cy, rx, ry, irx, iry, _wall = bowl_metrics()
    return ring(cx, cy, rx, ry, irx, iry), rx, cy


def cap_bowl_o():
    top = CAP + OVER
    bot = -OVER
    ry = (top - bot) / 2.0
    cy = (top + bot) / 2.0
    rx = ry * 1.02
    wall = STEM * 0.98
    return ring(0, cy, rx, ry, rx - wall, ry - wall)


# ---------------------------------------------------------------------------
# Glyphs
# ---------------------------------------------------------------------------

def g_notdef():
    return cut(round_rect(30, 20, 440, 680, 70), round_rect(110, 110, 280, 500, 40))


def g_space():
    return None


def g_A():
    width = 760
    left = (STEM * 0.48, STEM * 0.50)
    right = (width - STEM * 0.48, STEM * 0.50)
    apex = (width / 2.0, CAP - STEM * 0.28)
    body = polyline([left, apex, right], STEM * 0.98)
    # Crossbar sits low, matching the logo (open crotch underneath).
    by = CAP * 0.33
    t = (by - left[1]) / (apex[1] - left[1])
    lx = left[0] + (apex[0] - left[0]) * t
    rx = right[0] + (apex[0] - right[0]) * t
    bar = polyline([(lx, by), (rx, by)], STEM * 0.78)
    path = unite(body, bar)
    if ncontours(path) < 2:
        tri = soften(
            [
                (width * 0.50, CAP * 0.60),
                (width * 0.33, CAP * 0.40),
                (width * 0.67, CAP * 0.40),
            ],
            26,
        )
        path = cut(path, tri)
    return path


def g_B():
    width = 700
    stem = polyline([(STEM / 2, STEM / 2), (STEM / 2, CAP - STEM / 2)], STEM)
    upper = round_rect(-4, CAP * 0.48, width, CAP * 0.52 + OVER, 150)
    lower = round_rect(-4, -OVER * 0.4, width + 16, CAP * 0.56, 160)
    body = unite(stem, upper, lower)
    upper_hole = round_rect(STEM * 0.92, CAP * 0.62, width * 0.46, CAP * 0.24, 70)
    lower_hole = round_rect(STEM * 0.92, CAP * 0.12, width * 0.52, CAP * 0.28, 80)
    return cut(body, unite(upper_hole, lower_hole))


def g_C():
    cy = CAP / 2.0
    rx = 300
    ry = CAP / 2.0 + OVER - STEM / 2.0
    return arc_stroke(rx, cy, rx - STEM / 2.0, ry, 58, 302, STEM)


def g_D():
    stem = polyline([(STEM / 2, STEM / 2), (STEM / 2, CAP - STEM / 2)], STEM)
    cy = CAP / 2.0
    outer = oval(250, cy, 300, cy + OVER)
    body = unite(stem, outer)
    hole = oval(270, cy, 130, 168)
    return cut(body, hole)


def g_E():
    x = STEM / 2
    stem = polyline([(x, STEM / 2), (x, CAP - STEM / 2)], STEM)
    top = polyline([(x, CAP - STEM / 2), (430, CAP - STEM / 2)], STEM)
    mid = polyline([(x, CAP * 0.50), (330, CAP * 0.50)], STEM * 0.92)
    bot = polyline([(x, STEM / 2), (430, STEM / 2)], STEM)
    return unite(stem, top, mid, bot)


def g_F():
    x = STEM / 2
    stem = polyline([(x, STEM / 2), (x, CAP - STEM / 2)], STEM)
    top = polyline([(x, CAP - STEM / 2), (420, CAP - STEM / 2)], STEM)
    mid = polyline([(x, CAP * 0.50), (320, CAP * 0.50)], STEM * 0.92)
    return unite(stem, top, mid)


def g_G():
    cy = CAP / 2.0
    rx = 250
    ry = CAP / 2.0 + OVER - STEM / 2.0
    arc = arc_stroke(rx + 20, cy, rx, ry, 18, 308, STEM)
    bar = polyline([(rx + 20, cy), (rx + 20 + rx, cy)], STEM * 0.92)
    return unite(arc, bar)


def g_H():
    x0 = STEM / 2
    x1 = 520
    left = polyline([(x0, STEM / 2), (x0, CAP - STEM / 2)], STEM)
    right = polyline([(x1, STEM / 2), (x1, CAP - STEM / 2)], STEM)
    bar = polyline([(x0, CAP / 2), (x1, CAP / 2)], STEM * 0.92)
    return unite(left, right, bar)


def g_I():
    return polyline([(STEM / 2, STEM / 2), (STEM / 2, CAP - STEM / 2)], STEM)


def g_J():
    x = 280
    return curve(
        [
            ("M", x, CAP - STEM / 2),
            ("L", x, 150),
            ("C", x, 40, x - 40, -70, x - 180, -78),
        ],
        STEM,
    )


def g_K():
    # Proportions from the wordmark K: full pill stem, arms leaving the middle.
    x = STEM / 2
    stem = polyline([(x, STEM / 2), (x, CAP - STEM / 2)], STEM)
    upper = polyline([(x + 8, CAP * 0.56), (500, CAP - STEM * 0.46)], STEM * 0.96)
    lower = polyline([(x + 8, CAP * 0.44), (500, STEM * 0.46)], STEM * 0.96)
    return unite(stem, upper, lower)


def g_L():
    x = STEM / 2
    stem = polyline([(x, STEM / 2), (x, CAP - STEM / 2)], STEM)
    arm = polyline([(x, STEM / 2), (430, STEM / 2)], STEM)
    return unite(stem, arm)


def g_M():
    return polyline(
        [
            (STEM * 0.5, STEM * 0.5),
            (STEM * 0.5, CAP - STEM * 0.42),
            (390, STEM * 1.15),
            (730, CAP - STEM * 0.42),
            (730, STEM * 0.5),
        ],
        STEM * 0.92,
    )


def g_N():
    left = polyline([(STEM / 2, STEM / 2), (STEM / 2, CAP - STEM / 2)], STEM)
    right = polyline([(560, STEM / 2), (560, CAP - STEM / 2)], STEM)
    diag = polyline([(STEM * 0.35, CAP - STEM * 0.7), (560, STEM * 0.85)], STEM * 0.90)
    return unite(left, right, diag)


def g_O():
    return cap_bowl_o()


def g_P():
    # Logo P: stem is full height, bowl is the top ~70%, counter is a wide pill.
    stem = polyline([(STEM / 2, STEM / 2), (STEM / 2, CAP - STEM / 2)], STEM)
    bowl = round_rect(-6, CAP * 0.30, 640, CAP * 0.70 + OVER, 168)
    body = unite(stem, bowl)
    hole = round_rect(STEM * 0.95, CAP * 0.50, 280, 148, 74)
    return cut(body, hole)


def g_Q():
    base = cap_bowl_o()
    x0, y0, x1, y1 = base.bounds
    tail = polyline([(x1 - 230, 210), (x1 - 40, 20)], STEM * 0.72)
    return unite(base, tail)


def g_R():
    body = g_P()
    leg = polyline([(240, CAP * 0.36), (600, STEM * 0.48)], STEM * 0.92)
    return unite(body, leg)


def g_S():
    w = 500
    wall = STEM * 0.92
    top = CAP + OVER - wall * 0.35
    bot = -OVER + wall * 0.35
    return curve(
        [
            ("M", w * 0.78, top - 150),
            ("C", w * 0.92, top - 40, w * 0.70, top, w * 0.42, top - 8),
            ("C", w * 0.08, top - 20, w * 0.06, CAP * 0.58, w * 0.40, CAP * 0.50),
            ("C", w * 0.78, CAP * 0.42, w * 0.92, CAP * 0.28, w * 0.62, bot + 36),
            ("C", w * 0.32, bot + 20, w * 0.10, bot + 55, w * 0.22, bot + 150),
        ],
        wall,
    )


def g_T():
    arm = polyline([(40, CAP - STEM / 2), (560, CAP - STEM / 2)], STEM)
    stem = polyline([(300, STEM / 2), (300, CAP - STEM / 2)], STEM)
    return unite(arm, stem)


def g_U():
    x0, x1 = STEM / 2, 480
    radius = (x1 - x0) / 2.0
    sole = -OVER * 0.25 + STEM / 2.0
    arch_cy = sole + radius
    path = _path()
    path.moveTo(x0, CAP - STEM / 2)
    path.lineTo(x0, arch_cy)
    add_ellipse_arc(path, (x0 + x1) / 2.0, arch_cy, radius, radius, 180, 360)
    path.lineTo(x1, CAP - STEM / 2)
    return stroke(path, STEM)


def g_V():
    return polyline([(36, CAP - 108), (310, 104), (584, CAP - 108)], STEM * 0.94)


def g_W():
    return polyline(
        [(28, CAP - 100), (180, 100), (370, CAP * 0.46), (560, 100), (712, CAP - 100)],
        STEM * 0.84,
    )


def g_X():
    a = polyline([(36, CAP - 96), (540, 100)], STEM * 0.9)
    b = polyline([(36, 100), (540, CAP - 96)], STEM * 0.9)
    return unite(a, b)


def g_Y():
    left = polyline([(48, CAP - 100), (290, CAP * 0.48)], STEM * 0.96)
    right = polyline([(532, CAP - 100), (290, CAP * 0.48)], STEM * 0.96)
    stem = polyline([(290, CAP * 0.48), (290, STEM / 2)], STEM)
    return unite(left, right, stem)


def g_Z():
    top = polyline([(40, CAP - STEM / 2), (500, CAP - STEM / 2)], STEM)
    diag = polyline([(470, CAP - STEM * 0.7), (70, STEM * 0.75)], STEM * 0.94)
    bot = polyline([(40, STEM / 2), (500, STEM / 2)], STEM)
    return unite(top, diag, bot)


def _digit_width():
    return 640


def g_zero():
    top = CAP + OVER * 0.6
    bot = -OVER * 0.6
    ry = (top - bot) / 2.0
    cy = (top + bot) / 2.0
    rx = 250
    wall = STEM * 0.96
    return ring(0, cy, rx, ry, rx - wall, ry - wall)


def g_one():
    stem = polyline([(250, STEM / 2), (250, CAP - STEM / 2)], STEM)
    flag = polyline([(250, CAP - STEM * 0.85), (120, CAP - STEM * 1.55)], STEM * 0.88)
    base = polyline([(110, STEM / 2), (390, STEM / 2)], STEM * 0.9)
    return unite(stem, flag, base)


def g_two():
    # Curved upper bowl into a diagonal, then a full horizontal base. Not a Z.
    w = 560
    yb = STEM * 0.52
    return curve(
        [
            ("M", w * 0.20, CAP * 0.64),
            ("C", w * 0.10, CAP * 0.92, w * 0.96, CAP * 0.96, w * 0.78, CAP * 0.50),
            ("C", w * 0.64, CAP * 0.18, w * 0.34, CAP * 0.14, w * 0.16, yb),
            ("L", w * 0.90, yb),
        ],
        STEM * 0.98,
    )


def g_three():
    w = 520
    return curve(
        [
            ("M", w * 0.18, CAP * 0.78),
            ("C", w * 0.18, CAP * 0.98, w * 0.96, CAP * 0.98, w * 0.78, CAP * 0.78),
            ("C", w * 0.55, CAP * 0.58, w * 0.55, CAP * 0.50, w * 0.82, CAP * 0.36),
            ("C", w * 0.98, CAP * 0.22, w * 0.78, -OVER * 0.2, w * 0.40, -OVER * 0.15),
            ("C", w * 0.16, -OVER * 0.1, w * 0.12, CAP * 0.18, w * 0.22, CAP * 0.28),
        ],
        STEM * 0.94,
    )


def g_four():
    stem = polyline([(470, STEM / 2), (470, CAP - STEM / 2)], STEM)
    bar = polyline([(70, CAP * 0.38), (560, CAP * 0.38)], STEM * 0.9)
    arm = polyline([(300, CAP - STEM * 0.4), (80, CAP * 0.38)], STEM * 0.92)
    return unite(stem, bar, arm)


def g_five():
    w = 520
    top = polyline([(w * 0.84, CAP - STEM / 2), (w * 0.16, CAP - STEM / 2)], STEM * 0.92)
    spine = curve(
        [
            ("M", w * 0.22, CAP - STEM / 2),
            ("L", w * 0.22, CAP * 0.56),
            ("C", w * 0.22, CAP * 0.40, w * 0.70, CAP * 0.50, w * 0.74, CAP * 0.32),
            ("C", w * 0.82, CAP * 0.08, w * 0.40, -OVER * 0.4, w * 0.16, CAP * 0.16),
        ],
        STEM * 0.94,
    )
    return unite(top, spine)


def g_six():
    wall = 142
    rx, ry = 214, 206
    by = ry - OVER * 0.2
    bowl = ring(310, by, rx, ry, 82, 74)
    join_x = 310 - rx + wall * 0.48
    join_y = by + 16
    hook = curve(
        [
            ("M", 310 + 80, CAP - wall * 0.7),
            ("C", 160, CAP * 0.84, 70, CAP * 0.50, join_x, join_y),
        ],
        wall,
    )
    return unite(bowl, hook)


def g_seven():
    top = polyline([(40, CAP - STEM / 2), (540, CAP - STEM / 2)], STEM)
    diag = curve(
        [
            ("M", 470, CAP - STEM * 0.72),
            ("C", 400, CAP * 0.55, 220, CAP * 0.28, 80, STEM * 0.55),
        ],
        STEM * 0.96,
    )
    return unite(top, diag)


def g_eight():
    upper = ring(0, CAP * 0.69, 188, 168, 72, 58)
    lower = ring(0, CAP * 0.30, 206, 186, 78, 64)
    return unite(upper, lower)


def g_nine():
    return flip_y(g_six())


def g_a():
    _cy, rx, _ry, _irx, _iry, wall = bowl_metrics()
    stem_x = rx * 1.55
    bowl, _rx, _cy = lc_bowl(rx * 0.92)
    stem = polyline([(stem_x, wall / 2), (stem_x, X - wall / 2)], wall)
    return unite(bowl, stem)


def g_b():
    _cy, rx, _ry, _irx, _iry, wall = bowl_metrics()
    stem = polyline([(wall / 2, -OVER + wall / 2), (wall / 2, ASC - wall / 2)], wall)
    bowl, _rx, _cy = lc_bowl(wall * 0.55 + rx * 0.78)
    return unite(stem, bowl)


def g_c():
    cy, rx, ry, _irx, _iry, wall = bowl_metrics()
    return arc_stroke(rx, cy, rx - wall / 2, ry - wall / 2, 56, 304, wall)


def g_d():
    return flip_x(g_b())


def g_e():
    cy, rx, ry, irx, iry, wall = bowl_metrics()
    cx = rx
    mrx = (rx + irx) / 2.0
    mry = (ry + iry) / 2.0
    # Round-capped bowl, open on the right, with a bar across the opening.
    arc = arc_stroke(cx, cy, mrx, mry, 50, 315, wall)
    bar = polyline([(cx - mrx * 0.05, cy - mry * 0.02), (cx + mrx * 1.02, cy - mry * 0.02)], wall * 0.9)
    return unite(arc, bar)


def g_f():
    wall = LC
    x = 180
    spine = curve(
        [
            ("M", x, wall / 2),
            ("L", x, ASC - wall * 1.55),
            ("C", x, ASC - wall * 0.55, x + wall * 1.45, ASC - wall * 0.45, x + wall * 1.35, ASC - wall * 1.05),
        ],
        wall,
    )
    bar = polyline([(x - wall * 0.85, X), (x + wall * 1.15, X)], wall * 0.82)
    return unite(spine, bar)


def g_g():
    """Single-story g: o-like bowl on the baseline, tail only below it."""
    cy, rx, ry, irx, iry, wall = bowl_metrics()
    bx = rx + 10
    bowl = ring(bx, cy, rx, ry, irx, iry)
    # Tail leaves the lower-right of the stroke and hooks left under the baseline.
    # It does not curl back into the counter.
    mid_r = (rx + irx) / 2.0
    ang = math.radians(-40)
    tail = curve(
        [
            ("M", bx + mid_r * math.cos(ang), cy + mid_r * math.sin(ang)),
            (
                "C",
                bx + rx * 0.95,
                cy - ry * 0.95,
                bx + rx * 0.15,
                DESC + wall * 0.85,
                bx - rx * 0.35,
                DESC + wall * 0.55,
            ),
        ],
        wall,
    )
    return unite(bowl, tail)


def g_h():
    wall = LC
    x0 = wall / 2.0
    stem = polyline([(x0, wall / 2), (x0, ASC - wall / 2)], wall)
    return unite(stem, arch_top(x0, x0 + 280, 0, X, wall))


def g_i():
    wall = LC
    stem = polyline([(wall / 2, wall / 2), (wall / 2, X - wall / 2)], wall)
    dot_d = 128
    gap = 78
    dot = oval(wall / 2, X + gap + dot_d / 2, dot_d / 2, dot_d / 2)
    return unite(stem, dot)


def g_j():
    wall = LC
    x = 230
    stem = curve(
        [
            ("M", x, X - wall / 2),
            ("L", x, -30),
            ("C", x, -130, x - 30, DESC + wall * 0.45, x - 175, DESC + wall * 0.50),
        ],
        wall,
    )
    dot_d = 128
    gap = 78
    dot = oval(x, X + gap + dot_d / 2, dot_d / 2, dot_d / 2)
    return unite(stem, dot)


def g_k():
    wall = LC
    x = wall / 2
    stem = polyline([(x, wall / 2), (x, ASC - wall / 2)], wall)
    upper = polyline([(x, X * 0.58), (x + 250, X - wall * 0.35)], wall * 0.96)
    lower = polyline([(x, X * 0.46), (x + 250, wall * 0.45)], wall * 0.96)
    return unite(stem, upper, lower)


def g_l():
    wall = LC
    return polyline([(wall / 2, wall / 2), (wall / 2, ASC - wall / 2)], wall)


def g_m():
    wall = LC
    radius = 132
    x0 = wall / 2.0
    x1 = x0 + radius * 2
    x2 = x1 + radius * 2
    crown = X - wall / 2.0
    arch_cy = crown - radius
    foot = wall / 2.0
    path = _path()
    path.moveTo(x0, foot)
    path.lineTo(x0, arch_cy)
    add_ellipse_arc(path, x0 + radius, arch_cy, radius, radius, 180, 0)
    add_ellipse_arc(path, x1 + radius, arch_cy, radius, radius, 180, 0)
    path.lineTo(x2, foot)
    return stroke(path, wall)


def arch_top(x0, x1, y_base, y_top, width):
    """Vertical stems joined by a shoulder. y_base / y_top are the outer ink edges."""
    radius = (x1 - x0) / 2.0
    crown = y_top - width / 2.0
    arch_cy = crown - radius
    foot = y_base + width / 2.0
    path = _path()
    path.moveTo(x0, foot)
    path.lineTo(x0, arch_cy)
    add_ellipse_arc(path, (x0 + x1) / 2.0, arch_cy, radius, radius, 180, 0)
    path.lineTo(x1, foot)
    return stroke(path, width)


def arch_bottom(x0, x1, y_base, y_top, width):
    radius = (x1 - x0) / 2.0
    sole = y_base + width / 2.0
    arch_cy = sole + radius
    head = y_top - width / 2.0
    path = _path()
    path.moveTo(x0, head)
    path.lineTo(x0, arch_cy)
    add_ellipse_arc(path, (x0 + x1) / 2.0, arch_cy, radius, radius, 180, 360)
    path.lineTo(x1, head)
    return stroke(path, width)


def g_n():
    wall = LC
    x0 = wall / 2.0
    return arch_top(x0, x0 + 300, 0, X, wall)


def g_o():
    cy, rx, ry, irx, iry, _wall = bowl_metrics()
    return ring(rx, cy, rx, ry, irx, iry)


def g_p():
    _cy, rx, _ry, _irx, _iry, wall = bowl_metrics()
    stem = polyline([(wall / 2, DESC + wall / 2), (wall / 2, X - wall / 2)], wall)
    bowl, _rx, _cy = lc_bowl(wall * 0.55 + rx * 0.78)
    return unite(stem, bowl)


def g_q():
    return flip_x(g_p())


def g_r():
    wall = LC
    x = wall / 2
    stem = polyline([(x, wall / 2), (x, X - wall / 2)], wall)
    hook = curve(
        [
            ("M", x, X - wall * 1.35),
            ("C", x + wall * 0.15, X - wall * 0.45, x + wall * 1.35, X - wall * 0.15, x + wall * 2.05, X - wall * 0.85),
        ],
        wall,
    )
    return unite(stem, hook)


def g_s():
    w = 390
    wall = LC * 0.94
    top = X + OVER - wall * 0.15
    bot = -OVER + wall * 0.2
    return curve(
        [
            ("M", w * 0.76, top - 120),
            ("C", w * 0.94, top - 20, w * 0.62, top, w * 0.36, top - 6),
            ("C", w * 0.06, top - 16, w * 0.08, X * 0.58, w * 0.42, X * 0.50),
            ("C", w * 0.78, X * 0.42, w * 0.90, X * 0.22, w * 0.58, bot + 28),
            ("C", w * 0.26, bot + 16, w * 0.08, bot + 48, w * 0.22, bot + 120),
        ],
        wall,
    )


def g_t():
    wall = LC
    x = 170
    spine = curve(
        [
            ("M", x, 690 - wall / 2),
            ("L", x, wall * 0.85),
            ("C", x, wall * 0.35, x + wall * 0.35, wall * 0.15, x + wall * 1.05, wall * 0.42),
        ],
        wall,
    )
    bar = polyline([(x - wall * 0.7, X * 0.78), (x + wall * 0.95, X * 0.78)], wall * 0.78)
    return unite(spine, bar)


def g_u():
    wall = LC
    x0 = wall / 2.0
    return arch_bottom(x0, x0 + 300, -OVER * 0.35, X, wall)


def g_v():
    return polyline([(24, X - 86), (210, 82), (396, X - 86)], LC * 0.94)


def g_w():
    return polyline([(18, X - 82), (120, 78), (240, X * 0.48), (360, 78), (462, X - 82)], LC * 0.86)


def g_x():
    a = polyline([(24, X - 78), (360, 78)], LC * 0.9)
    b = polyline([(24, 78), (360, X - 78)], LC * 0.9)
    return unite(a, b)


def g_y():
    wall = LC
    left = polyline([(36, X - 78), (220, 96)], wall * 0.96)
    right = curve(
        [
            ("M", 410, X - 78),
            ("L", 248, 110),
            ("C", 210, 20, 188, -80, 78, DESC + wall * 0.55),
        ],
        wall * 0.96,
    )
    return unite(left, right)


def g_z():
    top = polyline([(20, X - LC / 2), (360, X - LC / 2)], LC)
    diag = polyline([(330, X - LC * 0.85), (50, LC * 0.7)], LC * 0.94)
    bot = polyline([(20, LC / 2), (360, LC / 2)], LC)
    return unite(top, diag, bot)


def g_period():
    return oval(0, 86, 78, 78)


def g_comma():
    head = oval(0, 86, 78, 78)
    tail = curve([("M", 10, 40), ("C", 20, -10, -20, -70, -70, -90)], 70)
    return unite(head, tail)


def g_exclam():
    stem = polyline([(0, 230), (0, CAP - 20)], STEM * 0.72)
    dot = oval(0, 86, 72, 72)
    return unite(stem, dot)


def g_question():
    hook = curve(
        [
            ("M", -150, CAP * 0.62),
            ("C", -170, CAP * 0.98, 180, CAP * 1.0, 40, CAP * 0.62),
            ("C", -40, CAP * 0.38, 20, CAP * 0.36, 0, 250),
        ],
        STEM * 0.78,
    )
    dot = oval(0, 86, 72, 72)
    return unite(hook, dot)


def g_colon():
    return unite(oval(0, 150, 72, 72), oval(0, CAP * 0.62, 72, 72))


def g_semicolon():
    return unite(g_comma(), oval(0, CAP * 0.62, 72, 72))


def g_quotesingle():
    blob = oval(0, 620, 58, 78)
    tail = curve([("M", 8, 560), ("C", 16, 500, -10, 470, -36, 450)], 64)
    return unite(blob, tail)


def g_quotedbl():
    a = g_quotesingle()
    b = shift(g_quotesingle(), 150, 0)
    return unite(a, b)


def g_hyphen():
    return polyline([(-130, CAP * 0.46), (130, CAP * 0.46)], STEM * 0.7)


def g_underscore():
    return polyline([(-180, -36), (180, -36)], 64)


def g_slash():
    return polyline([(-40, -20), (280, CAP + 10)], STEM * 0.72)


def g_ampersand():
    lower = ring(220, 250, 180, 160, 64, 54)
    upper = arc_stroke(240, 455, 155, 145, 195, 15, 150)
    leg = polyline([(130, 190), (480, 48)], 148)
    return unite(lower, upper, leg)


def g_at():
    outer = arc_stroke(280, CAP * 0.48, 250, 300, 40, 350, 70)
    cy, rx, ry, irx, iry, _wall = bowl_metrics()
    inner = ring(250, CAP * 0.46, 120, 130, 58, 64)
    return unite(outer, inner)


def g_numbersign():
    s = 118
    v1 = polyline([(150, 40), (210, CAP - 30)], s)
    v2 = polyline([(360, 40), (420, CAP - 30)], s)
    h1 = polyline([(70, CAP * 0.32), (520, CAP * 0.32)], s)
    h2 = polyline([(90, CAP * 0.66), (540, CAP * 0.66)], s)
    return unite(v1, v2, h1, h2)


def g_dollar():
    base = g_S()
    x0, _y0, x1, _y1 = base.bounds
    bar = polyline([((x0 + x1) / 2, -30), ((x0 + x1) / 2, CAP + 36)], 52)
    return unite(base, bar)


def g_percent():
    a = ring(-20, CAP * 0.70, 130, 120, 62, 54)
    b = ring(300, CAP * 0.26, 130, 120, 62, 54)
    diag = polyline([(40, 40), (250, CAP - 30)], 70)
    return unite(a, b, diag)


def g_plus():
    c = CAP * 0.48
    h = polyline([(c - 180, c), (c + 180, c)], 150)
    v = polyline([(c, c - 180), (c, c + 180)], 150)
    return unite(h, v)


def g_equal():
    c = CAP * 0.48
    a = polyline([(40, c + 70), (400, c + 70)], 120)
    b = polyline([(40, c - 70), (400, c - 70)], 120)
    return unite(a, b)


def g_parenleft():
    return arc_stroke(180, CAP * 0.48, 150, 400, 110, 250, LC)


def g_parenright():
    return flip_x(g_parenleft())


def g_bracketleft():
    path = _path()
    path.moveTo(220, -30)
    path.lineTo(80, -30)
    path.lineTo(80, CAP + 24)
    path.lineTo(220, CAP + 24)
    return stroke(path, LC)


def g_bracketright():
    return flip_x(g_bracketleft())


def g_braceleft():
    return curve(
        [
            ("M", 260, CAP + 16),
            ("C", 120, CAP + 16, 140, CAP * 0.62, 150, CAP * 0.52),
            ("C", 160, CAP * 0.44, 40, CAP * 0.50, 70, CAP * 0.46),
            ("C", 150, CAP * 0.40, 160, CAP * 0.30, 150, CAP * 0.22),
            ("C", 130, -10, 200, -20, 260, -24),
        ],
        LC * 0.85,
    )


def g_braceright():
    return flip_x(g_braceleft())


def g_asterisk():
    arms = []
    cx, cy = 0, CAP * 0.52
    for i in range(5):
        ang = math.radians(-90 + i * 72)
        arms.append(
            polyline(
                [(cx, cy), (cx + math.cos(ang) * 150, cy + math.sin(ang) * 150)],
                78,
            )
        )
    return unite(*arms)


BUILDERS = {
    ".notdef": g_notdef,
    "space": g_space,
    "A": g_A, "B": g_B, "C": g_C, "D": g_D, "E": g_E, "F": g_F, "G": g_G, "H": g_H,
    "I": g_I, "J": g_J, "K": g_K, "L": g_L, "M": g_M, "N": g_N, "O": g_O, "P": g_P,
    "Q": g_Q, "R": g_R, "S": g_S, "T": g_T, "U": g_U, "V": g_V, "W": g_W, "X": g_X,
    "Y": g_Y, "Z": g_Z,
    "a": g_a, "b": g_b, "c": g_c, "d": g_d, "e": g_e, "f": g_f, "g": g_g, "h": g_h,
    "i": g_i, "j": g_j, "k": g_k, "l": g_l, "m": g_m, "n": g_n, "o": g_o, "p": g_p,
    "q": g_q, "r": g_r, "s": g_s, "t": g_t, "u": g_u, "v": g_v, "w": g_w, "x": g_x,
    "y": g_y, "z": g_z,
    "zero": g_zero, "one": g_one, "two": g_two, "three": g_three, "four": g_four,
    "five": g_five, "six": g_six, "seven": g_seven, "eight": g_eight, "nine": g_nine,
    "period": g_period, "comma": g_comma, "exclam": g_exclam, "question": g_question,
    "colon": g_colon, "semicolon": g_semicolon, "quotesingle": g_quotesingle,
    "quotedbl": g_quotedbl, "hyphen": g_hyphen, "underscore": g_underscore,
    "slash": g_slash, "ampersand": g_ampersand, "at": g_at, "numbersign": g_numbersign,
    "dollar": g_dollar, "percent": g_percent, "plus": g_plus, "equal": g_equal,
    "parenleft": g_parenleft, "parenright": g_parenright,
    "bracketleft": g_bracketleft, "bracketright": g_bracketright,
    "braceleft": g_braceleft, "braceright": g_braceright, "asterisk": g_asterisk,
}

CMAP_NAMES = {
    "space": 0x20, "exclam": 0x21, "quotedbl": 0x22, "numbersign": 0x23,
    "dollar": 0x24, "percent": 0x25, "ampersand": 0x26, "quotesingle": 0x27,
    "parenleft": 0x28, "parenright": 0x29, "asterisk": 0x2A, "plus": 0x2B,
    "comma": 0x2C, "hyphen": 0x2D, "period": 0x2E, "slash": 0x2F,
    "zero": 0x30, "one": 0x31, "two": 0x32, "three": 0x33, "four": 0x34,
    "five": 0x35, "six": 0x36, "seven": 0x37, "eight": 0x38, "nine": 0x39,
    "colon": 0x3A, "semicolon": 0x3B, "equal": 0x3D, "question": 0x3F, "at": 0x40,
    "bracketleft": 0x5B, "bracketright": 0x5D, "underscore": 0x5F,
    "braceleft": 0x7B, "braceright": 0x7D,
}
for _ch in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz":
    CMAP_NAMES[_ch] = ord(_ch)

# Sidebearings. Rounds sit tighter than flats; diagonals tighter still.
BEARING = {
    "A": (18, 18), "B": (36, 28), "C": (34, 34), "D": (36, 28), "E": (36, 28),
    "F": (36, 22), "G": (34, 34), "H": (36, 36), "I": (36, 36), "J": (20, 28),
    "K": (36, 18), "L": (36, 16), "M": (28, 28), "N": (32, 32), "O": (36, 36),
    "P": (36, 28), "Q": (36, 20), "R": (36, 18), "S": (32, 32), "T": (12, 12),
    "U": (28, 28), "V": (8, 8), "W": (6, 6), "X": (10, 10), "Y": (8, 8), "Z": (22, 22),
}
for _ch in "abcdefghijklmnopqrstuvwxyz":
    BEARING[_ch] = (28, 28)
BEARING.update({
    "c": (32, 32), "o": (34, 34), "e": (32, 30), "s": (30, 30),
    "v": (8, 8), "w": (6, 6), "x": (10, 10), "y": (8, 10), "z": (18, 18),
    "f": (14, 16), "j": (10, 20), "t": (16, 16), "r": (28, 14), "l": (32, 32),
})

DIGITS = {"zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"}


def prepare(path):
    path.convertConicsToQuads(0.4)
    path.simplify(clockwise=True)
    return path


def draw_path(path, pen):
    cx = cy = None
    for op, pts in path.segments:
        if op == "moveTo":
            cx, cy = round(pts[0][0]), round(pts[0][1])
            pen.moveTo((cx, cy))
        elif op == "lineTo":
            cx, cy = round(pts[0][0]), round(pts[0][1])
            pen.lineTo((cx, cy))
        elif op == "qCurveTo":
            rounded = [(round(x), round(y)) for x, y in pts]
            pen.qCurveTo(*rounded)
            cx, cy = rounded[-1]
        elif op == "curveTo":
            c1, c2, end = pts
            spline = curve_to_quadratic(((cx, cy), c1, c2, end), 0.6)
            rounded = [(round(x), round(y)) for x, y in spline[1:]]
            pen.qCurveTo(*rounded)
            cx, cy = rounded[-1]
        elif op == "closePath":
            pen.closePath()
        else:
            raise RuntimeError(op)


def contours_as_cubics(path):
    """Return closed contours as lists of ('l', x, y) or ('c', c1, c2, x, y)."""
    contours = []
    current = []
    cx = cy = None
    start = None

    def push_quads(qpts):
        nonlocal cx, cy
        offs = [(qpts[i][0], qpts[i][1]) for i in range(len(qpts) - 1)]
        end = qpts[-1]
        if not offs:
            current.append(("l", end[0], end[1]))
            cx, cy = end
            return
        pts = offs[:]
        # Implied on-curve points sit halfway between consecutive off-curves.
        segs = []
        cur = (cx, cy)
        for i in range(len(pts) - 1):
            mid = ((pts[i][0] + pts[i + 1][0]) / 2.0, (pts[i][1] + pts[i + 1][1]) / 2.0)
            segs.append((cur, pts[i], mid))
            cur = mid
        segs.append((cur, pts[-1], (end[0], end[1])))
        for p0, ctrl, p1 in segs:
            c1 = (p0[0] + 2 / 3 * (ctrl[0] - p0[0]), p0[1] + 2 / 3 * (ctrl[1] - p0[1]))
            c2 = (p1[0] + 2 / 3 * (ctrl[0] - p1[0]), p1[1] + 2 / 3 * (ctrl[1] - p1[1]))
            current.append(("c", c1, c2, p1[0], p1[1]))
        cx, cy = end

    for op, pts in path.segments:
        if op == "moveTo":
            if current:
                contours.append(current)
            cx, cy = pts[0]
            start = (cx, cy)
            current = [("m", cx, cy)]
        elif op == "lineTo":
            cx, cy = pts[0]
            current.append(("l", cx, cy))
        elif op == "qCurveTo":
            push_quads(pts)
        elif op == "curveTo":
            c1, c2, end = pts
            current.append(("c", c1, c2, end[0], end[1]))
            cx, cy = end
        elif op == "closePath":
            if start and (abs(cx - start[0]) > 0.1 or abs(cy - start[1]) > 0.1):
                current.append(("l", start[0], start[1]))
            contours.append(current)
            current = []
            cx = cy = start = None
    if current:
        contours.append(current)
    return contours


def build_glyphs():
    glyphs = {}
    metrics = {}
    cubics = {}
    errors = []
    order = [".notdef", "space"] + [n for n in BUILDERS if n not in (".notdef", "space")]
    for name in order:
        try:
            raw = BUILDERS[name]()
            if name == "space":
                glyphs[name] = TTGlyphPen(None).glyph()
                metrics[name] = (280, 0)
                cubics[name] = []
                continue
            path = prepare(raw)
            lsb, rsb = BEARING.get(name, (30, 30))
            x0, y0, x1, y1 = path.bounds
            if name in DIGITS:
                target = 640
                ink = x1 - x0
                lsb = max(24, (target - ink) / 2.0)
                path = shift(path, lsb - x0, 0)
                x0, y0, x1, y1 = path.bounds
                adv = int(round(max(target, x1 + 24)))
            else:
                path = shift(path, lsb - x0, 0)
                x0, y0, x1, y1 = path.bounds
                adv = int(round(x1 + rsb))
            path = prepare(path)
            pen = TTGlyphPen(None)
            draw_path(path, pen)
            glyphs[name] = pen.glyph()
            metrics[name] = (adv, int(round(path.bounds[0])))
            cubics[name] = contours_as_cubics(path)
        except Exception:
            errors.append((name, traceback.format_exc()))
    return order, glyphs, metrics, cubics, errors


def write_sfd(path, order, metrics, cubics):
    lines = [
        "SplineFontDB: 3.2",
        "FontName: KAPOCustom-Black",
        "FullName: KAPO Custom Black",
        "FamilyName: KAPO Custom",
        "Weight: Black",
        "Copyright: Copyright (c) 2026 KAPO",
        "Version: 2.000",
        "ItalicAngle: 0",
        "UnderlinePosition: -120",
        "UnderlineWidth: 50",
        "Ascent: 800",
        "Descent: 250",
        "LayerCount: 2",
        'Layer: 0 0 "Back" 1',
        'Layer: 1 0 "Fore" 0',
        "OS2TypoAscent: 800",
        "OS2TypoDescent: -250",
        "OS2WinAscent: 920",
        "OS2WinDescent: 340",
        "OS2TypoLineGap: 0",
        "OS2Weight: 900",
        "OS2Width: 5",
        "Encoding: UnicodeFull",
        "BeginChars: %d %d" % (len(order), len(order)),
        "",
    ]
    for index, name in enumerate(order):
        uni = CMAP_NAMES.get(name, -1)
        enc = uni if uni >= 0 else index
        adv, _lsb = metrics[name]
        lines.append("StartChar: %s" % name)
        lines.append("Encoding: %d %d %d" % (enc, uni if uni >= 0 else -1, index))
        lines.append("Width: %d" % adv)
        lines.append("Flags: HW")
        lines.append("LayerCount: 2")
        lines.append("Fore")
        contours = cubics.get(name) or []
        if contours:
            lines.append("SplineSet")
            for contour in contours:
                sx, sy = contour[0][1], contour[0][2]
                lines.append("%s %s m 1" % (_n(sx), _n(sy)))
                for seg in contour[1:]:
                    if seg[0] == "l":
                        lines.append(" %s %s l 0" % (_n(seg[1]), _n(seg[2])))
                    else:
                        c1, c2, x, y = seg[1], seg[2], seg[3], seg[4]
                        lines.append(
                            " %s %s %s %s %s %s c 0"
                            % (_n(c1[0]), _n(c1[1]), _n(c2[0]), _n(c2[1]), _n(x), _n(y))
                        )
                lines.append(" %s %s l 0" % (_n(sx), _n(sy)))
            lines.append("EndSplineSet")
        lines.append("EndChar")
        lines.append("")
    lines.append("EndChars")
    lines.append("EndSplineFont")
    path.write_text("\n".join(lines), encoding="utf-8")


def _n(v):
    return str(int(round(v)))


def write_fonts(order, glyphs, metrics, cubics):
    OUT.mkdir(parents=True, exist_ok=True)
    cmap = {code: name for name, code in CMAP_NAMES.items()}
    fb = FontBuilder(UPM, isTTF=True)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=800, descent=250, lineGap=0)
    fb.setupOS2(
        sTypoAscender=800,
        sTypoDescender=-250,
        sTypoLineGap=0,
        usWinAscent=920,
        usWinDescent=340,
        sxHeight=X,
        sCapHeight=CAP,
        usWeightClass=900,
        usWidthClass=5,
        fsSelection=0x20 | 0x80,
        achVendID="KAPO",
    )
    fb.setupPost(keepGlyphNames=True)
    fb.setupNameTable(
        {
            "copyright": "Copyright (c) 2026 KAPO",
            "familyName": "KAPO Custom",
            "styleName": "Black",
            "uniqueFontIdentifier": "KAPO Custom Black 2.000",
            "fullName": "KAPO Custom Black",
            "version": "Version 2.000",
            "psName": "KAPOCustom-Black",
            "typographicFamily": "KAPO Custom",
            "typographicSubfamily": "Black",
            "sampleText": "SHOPKAPO",
            "designer": "KAPO",
            "description": "Custom display face rebuilt from the KAPO wordmark.",
        }
    )
    ttf_path = OUT / "KAPO-Custom-Black.ttf"
    fb.font["OS/2"].version = 4
    fb.font["head"].macStyle = 0x01
    fb.save(str(ttf_path))

    # OpenType CFF with the same cubic outlines.
    charstrings = {}
    for name in order:
        adv = metrics[name][0]
        pen = T2CharStringPen(adv, None)
        for contour in cubics.get(name) or []:
            if not contour:
                continue
            pen.moveTo((contour[0][1], contour[0][2]))
            for seg in contour[1:]:
                if seg[0] == "l":
                    pen.lineTo((seg[1], seg[2]))
                else:
                    c1, c2, x, y = seg[1], seg[2], seg[3], seg[4]
                    pen.curveTo(c1, c2, (x, y))
            pen.closePath()
        charstrings[name] = pen.getCharString()
    ob = FontBuilder(UPM, isTTF=False)
    ob.setupGlyphOrder(order)
    ob.setupCharacterMap(cmap)
    ob.setupHorizontalMetrics(metrics)
    ob.setupHorizontalHeader(ascent=800, descent=250, lineGap=0)
    ob.setupCFF(
        "KAPOCustom-Black",
        {
            "FullName": "KAPO Custom Black",
            "FamilyName": "KAPO Custom",
            "Weight": "Black",
            "FontBBox": [0, -280, 1400, 860],
            "UnderlinePosition": -120,
            "UnderlineThickness": 50,
        },
        charstrings,
        {},
    )
    ob.setupOS2(
        sTypoAscender=800,
        sTypoDescender=-250,
        sTypoLineGap=0,
        usWinAscent=920,
        usWinDescent=340,
        sxHeight=X,
        sCapHeight=CAP,
        usWeightClass=900,
        usWidthClass=5,
        fsSelection=0x20 | 0x80,
        achVendID="KAPO",
    )
    ob.setupPost(keepGlyphNames=True)
    ob.setupNameTable(
        {
            "copyright": "Copyright (c) 2026 KAPO",
            "familyName": "KAPO Custom",
            "styleName": "Black",
            "uniqueFontIdentifier": "KAPO Custom Black 2.000",
            "fullName": "KAPO Custom Black",
            "version": "Version 2.000",
            "psName": "KAPOCustom-Black",
            "sampleText": "SHOPKAPO",
        }
    )
    otf_path = OUT / "KAPO-Custom-Black.otf"
    ob.save(str(otf_path))

    woff = TTFont(str(ttf_path))
    woff.flavor = "woff2"
    woff_path = OUT / "KAPO-Custom-Black.woff2"
    woff.save(str(woff_path))
    write_sfd(OUT / "KAPO-Custom-Black.sfd", order, metrics, cubics)
    return ttf_path


def load_font(size):
    return ImageFont.truetype(str(OUT / "KAPO-Custom-Black.ttf"), size)


def text_size(font, text):
    box = font.getbbox(text)
    return box[2] - box[0], box[3] - box[1]


def render_previews():
    font_paths_ok = (OUT / "KAPO-Custom-Black.ttf").exists()
    assert font_paths_ok
    label = ImageFont.load_default()
    width = 2600
    rows = []

    def block(title, text, size, pad=28):
        font = load_font(size)
        ascent, descent = font.getmetrics()
        lines = text.split("\n")
        line_h = ascent + descent + 8
        h = pad + 22 + len(lines) * line_h + pad
        im = Image.new("RGB", (width, h), "white")
        draw = ImageDraw.Draw(im)
        draw.text((pad, 8), title, fill=(140, 140, 140), font=label)
        y = pad + 8
        for line in lines:
            draw.text((pad, y), line, fill=(0, 0, 0), font=font)
            y += line_h
        return im

    rows.append(block("SHOPKAPO", "SHOPKAPO", 150))
    rows.append(block("UPPERCASE", "ABCDEFGHIJKLMNOPQRSTUVWXYZ", 78))
    rows.append(block("LOWERCASE", "abcdefghijklmnopqrstuvwxyz", 78))
    rows.append(block("NUMBERS", "0123456789", 110))
    rows.append(block("PUNCTUATION", ".,!?:;'\"-_/&@#$%+=()[]{}*", 72))
    rows.append(
        block(
            "TEXT",
            "Keycaps with character.\nSome character. Two ways to use it.\njumpy pygmy\ngadget typography\n2026",
            64,
        )
    )
    rows.append(block("DESCENDERS", "g j p q y     a o b d", 120))
    rows.append(block("SIZE 16", "SHOPKAPO  jumpy pygmy  gjpqy  2026", 16))
    rows.append(block("SIZE 24", "SHOPKAPO  jumpy pygmy  gjpqy  2026", 24))
    rows.append(block("SIZE 48", "SHOPKAPO  jumpy pygmy  gjpqy  2026", 48))
    rows.append(block("SIZE 96", "SHOPKAPO  the quick pygmy  2026", 96))
    rows.append(block("SIZE 144", "SHOPKAPO  pygmy  2026", 144))

    # Logo comparison: real KAP crop beside the same letters in the new font.
    logo = Image.open(LOGO).convert("RGB")
    crop = logo.crop((176, 430, 712, 636))
    target_h = 220
    scale = target_h / crop.height
    crop = crop.resize((int(crop.width * scale), target_h), Image.Resampling.LANCZOS)
    comp_h = target_h + 80
    comp = Image.new("RGB", (width, comp_h + 160), "white")
    draw = ImageDraw.Draw(comp)
    draw.text((28, 8), "WORDMARK K A P  vs  FONT", fill=(140, 140, 140), font=label)
    comp.paste(crop, (28, 36))
    font = load_font(int(target_h * UPM / (CAP + 8)))
    draw.text((40 + crop.width + 40, 48), "KAP", fill=(0, 0, 0), font=font)
    draw.text((28, comp_h + 10), "SHOPKAPO", fill=(0, 0, 0), font=load_font(120))
    rows.append(comp)

    total_h = sum(im.height for im in rows) + 20
    sheet = Image.new("RGB", (width, total_h), "white")
    y = 10
    for im in rows:
        sheet.paste(im, (0, y))
        y += im.height
    sheet.save(OUT / "KAPO-Font-Specimen.png")

    # Metrics diagram with baseline, x-height, cap, ascender, descender.
    size = 180
    font = load_font(size)
    ascent, descent = font.getmetrics()
    sample = "Hnx o a g j p q y"
    mw, mh = text_size(font, sample)
    pad = 80
    mw2 = 2400
    mh2 = ascent + descent + pad * 2
    im = Image.new("RGB", (mw2, mh2), "white")
    draw = ImageDraw.Draw(im)
    baseline = pad + ascent
    guides = [
        (DESC, (200, 60, 60), "descender"),
        (0, (20, 20, 20), "baseline"),
        (X, (40, 90, 180), "x-height"),
        (CAP, (20, 120, 60), "cap"),
        (ASC, (180, 110, 20), "ascender"),
    ]
    for unit, color, name in guides:
        yy = baseline - unit * size / UPM
        draw.line((20, yy, mw2 - 20, yy), fill=color, width=2)
        draw.text((24, yy - 14), name, fill=color, font=label)
    draw.text((pad, pad), sample, fill=(0, 0, 0), font=font)
    draw.text((pad, pad + ascent + descent + 16), "gjpqy   jumpy pygmy   gadget", fill=(0, 0, 0), font=load_font(90))
    # Extend canvas for the second line
    extra = Image.new("RGB", (mw2, mh2 + 160), "white")
    extra.paste(im, (0, 0))
    ImageDraw.Draw(extra).text(
        (pad, mh2 + 20),
        "gjpqy    jumpy pygmy    gadget typography",
        fill=(0, 0, 0),
        font=load_font(80),
    )
    extra.save(OUT / "KAPO-Glyph-Metrics.png")

    # Full glyph sheet for inspection.
    chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?:;'\"-_/&@#$%+=()[]{}*"
    cell = 150
    cols = 13
    rows_n = math.ceil(len(chars) / cols)
    sheet = Image.new("RGB", (cols * cell, rows_n * cell), "white")
    draw = ImageDraw.Draw(sheet)
    gfont = load_font(86)
    gascent, _ = gfont.getmetrics()
    for i, ch in enumerate(chars):
        cx = (i % cols) * cell
        cy = (i // cols) * cell
        draw.rectangle((cx, cy, cx + cell - 2, cy + cell - 2), outline=(230, 230, 230))
        base = cy + 28 + gascent
        draw.line((cx + 8, base, cx + cell - 8, base), fill=(210, 210, 210))
        draw.text((cx + 18, cy + 28), ch, fill=(0, 0, 0), font=gfont)
    sheet.save(OUT / "_glyph-sheet.png")


def ink_components(image, threshold=80):
    w, h = image.size
    pix = image.load()
    seen = [False] * (w * h)
    count = 0
    boxes = []
    for y in range(h):
        for x in range(w):
            i = y * w + x
            if seen[i] or pix[x, y][0] > threshold:
                continue
            count += 1
            stack = [(x, y)]
            seen[i] = True
            minx = maxx = x
            miny = maxy = y
            n = 0
            while stack:
                cx, cy = stack.pop()
                n += 1
                minx = min(minx, cx)
                maxx = max(maxx, cx)
                miny = min(miny, cy)
                maxy = max(maxy, cy)
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < w and 0 <= ny < h:
                        j = ny * w + nx
                        if not seen[j] and pix[nx, ny][0] <= threshold:
                            seen[j] = True
                            stack.append((nx, ny))
            boxes.append((minx, miny, maxx, maxy, n))
    return count, boxes


def render_char(ch, size=420, pad=30):
    font = load_font(size)
    ascent, descent = font.getmetrics()
    tmp = Image.new("L", (20, 20), 255)
    # Measure with a wide canvas.
    probe = ImageDraw.Draw(Image.new("RGB", (8, 8)))
    box = font.getbbox(ch)
    w = max(8, box[2] - box[0] + pad * 2 + 20)
    h = ascent + descent + pad * 2
    im = Image.new("RGB", (w, h), "white")
    draw = ImageDraw.Draw(im)
    draw.text((pad - box[0], pad), ch, fill=(0, 0, 0), font=font)
    baseline = pad + ascent
    return im, baseline, size


def column_runs(image, y, threshold=80):
    w, h = image.size
    pix = image.load()
    y = max(0, min(h - 1, int(y)))
    runs = []
    on = False
    start = 0
    for x in range(w):
        dark = pix[x, y][0] <= threshold
        if dark and not on:
            start = x
            on = True
        elif not dark and on:
            runs.append((start, x - 1))
            on = False
    if on:
        runs.append((start, w - 1))
    return runs


def iou(a, b):
    wa, ha = a.size
    wb, hb = b.size
    w, h = max(wa, wb), max(ha, hb)
    A = a.convert("L").resize((w, h))
    B = b.convert("L").resize((w, h))
    pa, pb = A.load(), B.load()
    inter = union = 0
    for y in range(h):
        for x in range(w):
            ia = pa[x, y] < 128
            ib = pb[x, y] < 128
            if ia and ib:
                inter += 1
            if ia or ib:
                union += 1
    return inter / union if union else 0


def run_qa(build_errors):
    font = TTFont(str(OUT / "KAPO-Custom-Black.ttf"))
    cmap = font.getBestCmap()
    glyf = font["glyf"]
    hmtx = font["hmtx"]
    required = [chr(c) for c in CMAP_NAMES.values()]
    lines = []
    fails = []

    def check(ok, msg):
        lines.append(("PASS " if ok else "FAIL ") + msg)
        if not ok:
            fails.append(msg)

    check(not build_errors, "builders succeeded (%d errors)" % len(build_errors))
    for err_name, err in build_errors:
        lines.append("BUILD ERROR %s\n%s" % (err_name, err))

    missing = [ch for ch in required if ord(ch) not in cmap]
    check(not missing, "cmap covers required characters; missing %s" % missing)

    # Vertical metrics from the exported glyf, not the construction sketch.
    expect = {
        "H": ( -8, 12, CAP - 12, CAP + 12),
        "O": (-OVER - 10, -4, CAP + 4, CAP + OVER + 12),
        "o": (-OVER - 12, -2, X + 2, X + OVER + 14),
        "n": (-8, 14, X - 24, X + 10),
        "x": (-8, 16, X - 30, X + 12),
        "b": (-OVER - 14, 8, ASC - 24, ASC + 10),
        "p": (DESC - 8, DESC + 30, X - 8, X + OVER + 16),
        "q": (DESC - 8, DESC + 30, X - 8, X + OVER + 16),
        "g": (DESC - 16, DESC + 40, X - 16, X + OVER + 30),
        "y": (DESC - 16, DESC + 40, X - 30, X + 16),
        "l": (-8, 14, ASC - 24, ASC + 10),
    }
    for name, (ymin_lo, ymin_hi, ymax_lo, ymax_hi) in expect.items():
        g = glyf[name]
        ok = ymin_lo <= g.yMin <= ymin_hi and ymax_lo <= g.yMax <= ymax_hi
        check(ok, "%s vertical bounds yMin=%s yMax=%s expected yMin %s..%s yMax %s..%s" % (
            name, g.yMin, g.yMax, ymin_lo, ymin_hi, ymax_lo, ymax_hi))

    # j dot reaches above x-height and the hook drops below the baseline.
    j = glyf["j"]
    check(j.yMin < -140, "j descends (yMin=%s)" % j.yMin)
    check(j.yMax > X + 40, "j dot clears x-height (yMax=%s)" % j.yMax)

    # No glyph explodes outside the win metrics.
    for name in font.getGlyphOrder():
        g = glyf[name]
        if g.numberOfContours == 0:
            continue
        if g.yMin < -340 or g.yMax > 920:
            check(False, "%s clipped by win metrics y %s..%s" % (name, g.yMin, g.yMax))
        adv, lsb = hmtx[name]
        if adv <= 0:
            check(False, "%s non-positive advance" % name)
        if g.xMax > adv + 2:
            check(False, "%s ink past advance xMax=%s adv=%s" % (name, g.xMax, adv))

    # Pixel structure of the priority glyphs.
    def structure(ch):
        im, baseline, size = render_char(ch, 460, 36)
        w, h = im.size
        pix = im.load()
        # Split ink above / below the baseline.
        above = below = 0
        above_box = [w, h, 0, 0]
        below_box = [w, h, 0, 0]
        for y in range(h):
            for x in range(w):
                if pix[x, y][0] > 80:
                    continue
                if y < baseline - 2:
                    above += 1
                    above_box[0] = min(above_box[0], x)
                    above_box[1] = min(above_box[1], y)
                    above_box[2] = max(above_box[2], x)
                    above_box[3] = max(above_box[3], y)
                elif y > baseline + 2:
                    below += 1
                    below_box[0] = min(below_box[0], x)
                    below_box[1] = min(below_box[1], y)
                    below_box[2] = max(below_box[2], x)
                    below_box[3] = max(below_box[3], y)
        comps, boxes = ink_components(im)
        return {
            "im": im,
            "baseline": baseline,
            "above": above,
            "below": below,
            "above_box": above_box,
            "below_box": below_box,
            "components": comps,
            "boxes": boxes,
        }

    for ch, expect_components in (("g", 1), ("j", 2), ("p", 1), ("q", 1), ("y", 1), ("i", 2)):
        info = structure(ch)
        check(info["components"] == expect_components, "%s connected components %s expected %s" % (
            ch, info["components"], expect_components))
        if ch != "i":
            check(info["below"] > 40, "%s has ink below the baseline (%s px)" % (ch, info["below"]))
        else:
            check(info["below"] < 30, "i stays on the baseline (%s px below)" % info["below"])
        check(info["above"] > 80, "%s has ink in the x-height (%s px)" % (ch, info["above"]))

    def deep_span(info):
        im = info["im"]
        pix = im.load()
        w, h = im.size
        # Ignore the round overshoot. 40 font units at 460 ppem is about 18 px.
        y0 = info["baseline"] + 22
        minx, maxx, n = w, 0, 0
        for y in range(y0, h):
            for x in range(w):
                if pix[x, y][0] <= 80:
                    n += 1
                    minx = min(minx, x)
                    maxx = max(maxx, x)
        return minx, maxx, n

    p = structure("p")
    aw = p["above_box"][2] - p["above_box"][0]
    px0, px1, pn = deep_span(p)
    bw = px1 - px0
    check(pn > 30 and aw > bw * 1.45, "p bowl is wider than its descender stem (above %s, below %s)" % (aw, bw))
    check(px0 <= p["above_box"][0] + 30, "p descender is the left stem")
    check(px1 < (p["above_box"][0] + p["above_box"][2]) / 2, "p bowl does not descend")

    q = structure("q")
    qx0, qx1, qn = deep_span(q)
    check(qn > 30 and qx0 > (q["above_box"][0] + q["above_box"][2]) / 2 - 10, "q bowl does not descend")

    ginfo = structure("g")
    gaw = ginfo["above_box"][2] - ginfo["above_box"][0]
    gbw = ginfo["below_box"][2] - ginfo["below_box"][0]
    check(ginfo["above"] > ginfo["below"], "g bowl mass sits above the baseline")
    # Counter: the middle of the upper ink box should be paper.
    gx = (ginfo["above_box"][0] + ginfo["above_box"][2]) // 2
    gy = (ginfo["above_box"][1] + ginfo["above_box"][3]) // 2
    check(ginfo["im"].getpixel((gx, gy))[0] > 180, "g upper bowl has an open counter")

    # y has two branches near the top.
    yinfo = structure("y")
    top_y = yinfo["above_box"][1] + 8
    runs = column_runs(yinfo["im"], top_y)
    check(len(runs) >= 2, "y has two upper branches (%s runs)" % len(runs))

    # 2 is not a Z: the upper bowl has a counter, Z does not.
    im2, _, _ = render_char("2", 360, 20)
    imz, _, _ = render_char("Z", 360, 20)
    overlap = iou(im2, imz)
    check(overlap < 0.78, "numeral 2 is not a copy of Z (IoU %.2f)" % overlap)

    def upper_has_counter(im):
        w, h = im.size
        pix = im.load()
        # Search the upper 45% for a white pixel enclosed by ink.
        for y in range(int(h * 0.15), int(h * 0.48)):
            row = [x for x in range(w) if pix[x, y][0] < 80]
            if len(row) < 8:
                continue
            for x in range(row[0] + 4, row[-1] - 4):
                if pix[x, y][0] > 200:
                    return True
        return False

    check(upper_has_counter(im2), "numeral 2 has a curved upper counter")
    check(not upper_has_counter(imz), "uppercase Z has no upper counter")
    # Top of 2 should be a curve: the uppermost ink is narrower than the base.
    pix = im2.load()
    w, h = im2.size
    rows_ink = []
    for y in range(h):
        xs = [x for x in range(w) if pix[x, y][0] < 80]
        if xs:
            rows_ink.append((y, xs[0], xs[-1]))
    if rows_ink:
        top_span = rows_ink[2][2] - rows_ink[2][1]
        bot_span = rows_ink[-3][2] - rows_ink[-3][1]
        check(bot_span > top_span * 1.15, "2 base is wider than its top (top %s base %s)" % (top_span, bot_span))

    # Spacing: two straight letters and two rounds keep a paper column between them.
    def separated(text, size=160):
        font = load_font(size)
        ascent, descent = font.getmetrics()
        im = Image.new("RGB", (900, ascent + descent + 20), "white")
        ImageDraw.Draw(im).text((10, 10), text, fill=(0, 0, 0), font=font)
        pix = im.load()
        # A column is a gap when it is almost white while neighbors are ink.
        dark_cols = []
        for x in range(im.width):
            dark = any(pix[x, y][0] < 80 for y in range(im.height))
            dark_cols.append(dark)
        gaps = 0
        in_dark = False
        for dark in dark_cols:
            if dark and not in_dark:
                in_dark = True
            elif not dark and in_dark:
                gaps += 1
                in_dark = False
        return gaps

    check(separated("HH") >= 2, "H H do not collide")
    check(separated("OO") >= 2, "O O do not collide")
    check(separated("nn") >= 2, "n n do not collide")
    check(separated("oo") >= 2, "o o do not collide")

    report = ["# KAPO Custom Black — automated QA", "", "Font: KAPO Custom Black 2.000", ""]
    report.append("Failures: %d" % len(fails))
    report.append("")
    report.extend(lines)
    (OUT / "FONT-QA-REPORT.md").write_text("\n".join(report) + "\n", encoding="utf-8")
    print("\n".join(report))
    print("FAILS", len(fails))
    return fails


def main():
    order, glyphs, metrics, cubics, errors = build_glyphs()
    if errors:
        for name, err in errors:
            print("ERROR", name)
            print(err)
    write_fonts(order, glyphs, metrics, cubics)
    render_previews()
    fails = run_qa(errors)
    if fails:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

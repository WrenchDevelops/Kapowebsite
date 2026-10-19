"""Detailed measurements of K, A, P from the wordmark."""
from PIL import Image

im = Image.open(r"C:\Users\bende\Downloads\Kapo large logo.png").convert("L")
pix = im.load()

letters = {
    "K": (186, 447, 347, 621),
    "A": (349, 448, 529, 621),
    "P": (539, 447, 702, 621),
}

def ink(x, y):
    return pix[x, y] < 80

for name, (x0, y0, x1, y1) in letters.items():
    H = y1 - y0 + 1
    W = x1 - x0 + 1
    print(f"\n== {name} {W}x{H} ==")
    # row runs
    for frac in (0.05, 0.12, 0.25, 0.38, 0.5, 0.62, 0.75, 0.88, 0.96):
        y = int(y0 + (y1 - y0) * frac)
        runs = []
        on = False
        s = 0
        for x in range(x0 - 2, x1 + 3):
            if ink(x, y) and not on:
                s = x
                on = True
            elif not ink(x, y) and on:
                runs.append((s - x0, x - 1 - x0))
                on = False
        print(f"  y {frac:.2f} runs {[(a, b, b-a+1) for a, b in runs]}")

    # find white holes (counters) by scanning interior
    # vertical scan at mid x
    print("  vertical mid scan:")
    for frac in (0.15, 0.3, 0.45, 0.55, 0.7, 0.85):
        x = int(x0 + (x1 - x0) * frac)
        runs = []
        on = False
        s = 0
        for y in range(y0 - 2, y1 + 3):
            if ink(x, y) and not on:
                s = y
                on = True
            elif not ink(x, y) and on:
                runs.append((s - y0, y - 1 - y0))
                on = False
        print(f"  x {frac:.2f} runs {[(a, b, b-a+1) for a, b in runs]}")

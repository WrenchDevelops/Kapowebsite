"""Measure KAPO wordmark proportions from the high-resolution logo."""
from PIL import Image

im = Image.open(r"C:\Users\bende\Downloads\Kapo large logo.png").convert("L")
w, h = im.size
pix = im.load()
print("size", w, h)

ink_cols = []
minx, miny, maxx, maxy = w, h, 0, 0
count = 0
for x in range(w):
    col_on = False
    for y in range(h):
        if pix[x, y] < 80:
            col_on = True
            count += 1
            if x < minx:
                minx = x
            if y < miny:
                miny = y
            if x > maxx:
                maxx = x
            if y > maxy:
                maxy = y
    ink_cols.append(col_on)
print("bbox", minx, miny, maxx, maxy, "count", count)

runs = []
in_run = False
start = 0
for i, on in enumerate(ink_cols):
    if on and not in_run:
        start = i
        in_run = True
    elif not on and in_run:
        runs.append((start, i - 1))
        in_run = False
if in_run:
    runs.append((start, w - 1))

print("column runs:")
for x0, x1 in runs:
    y0, y1 = h, 0
    for x in range(x0, x1 + 1):
        for y in range(h):
            if pix[x, y] < 80:
                if y < y0:
                    y0 = y
                if y > y1:
                    y1 = y
    print(f"  x={x0}-{x1} w={x1-x0+1} y={y0}-{y1} h={y1-y0+1}")

pad = 8
crop = im.crop((minx - pad, miny - pad, maxx + pad + 1, maxy + pad + 1))
crop.save(r"C:\Users\bende\OneDrive\Desktop\Kapo website\scripts\_logo_crop.png")
print("saved crop", crop.size)

# Also save each run as its own image, scaled 2x for inspection
for i, (x0, x1) in enumerate(runs):
    y0, y1 = h, 0
    for x in range(x0, x1 + 1):
        for y in range(h):
            if pix[x, y] < 80:
                if y < y0:
                    y0 = y
                if y > y1:
                    y1 = y
    letter = im.crop((x0 - 4, y0 - 4, x1 + 5, y1 + 5))
    letter = letter.resize((letter.width * 2, letter.height * 2), Image.Resampling.NEAREST)
    path = rf"C:\Users\bende\OneDrive\Desktop\Kapo website\scripts\_logo_part_{i}.png"
    letter.save(path)
    print("part", i, letter.size)

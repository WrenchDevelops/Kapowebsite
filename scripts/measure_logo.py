"""Connected components and stroke measurements of the KAPO wordmark."""
from PIL import Image, ImageDraw

im = Image.open(r"C:\Users\bende\Downloads\Kapo large logo.png").convert("L")
w, h = im.size
pix = im.load()
seen = [[False] * h for _ in range(w)]
components = []

for x in range(w):
    for y in range(h):
        if pix[x, y] >= 80 or seen[x][y]:
            continue
        stack = [(x, y)]
        seen[x][y] = True
        minx = maxx = x
        miny = maxy = y
        count = 0
        pts = []
        while stack:
            cx, cy = stack.pop()
            count += 1
            if cx < minx:
                minx = cx
            if cx > maxx:
                maxx = cx
            if cy < miny:
                miny = cy
            if cy > maxy:
                maxy = cy
            if count < 8000:
                pts.append((cx, cy))
            for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                if 0 <= nx < w and 0 <= ny < h and not seen[nx][ny] and pix[nx, ny] < 80:
                    seen[nx][ny] = True
                    stack.append((nx, ny))
        if count > 200:
            components.append((count, minx, miny, maxx, maxy))

components.sort(key=lambda c: c[1])
print("components", len(components))
for i, (count, x0, y0, x1, y1) in enumerate(components):
    print(f"  #{i} n={count} x={x0}-{x1} w={x1-x0+1} y={y0}-{y1} h={y1-y0+1}")
    crop = im.crop((x0, y0, x1 + 1, y1 + 1))
    crop.save(rf"C:\Users\bende\OneDrive\Desktop\Kapo website\scripts\_cc_{i}.png")

# Stroke samples on the first letter (K): horizontal scan at several y
if components:
    _, x0, y0, x1, y1 = components[0]
    print("K horizontal chord widths:")
    for frac in (0.08, 0.2, 0.35, 0.5, 0.65, 0.8, 0.92):
        y = int(y0 + (y1 - y0) * frac)
        runs = []
        on = False
        s = 0
        for x in range(x0, x1 + 1):
            if pix[x, y] < 80 and not on:
                s = x
                on = True
            elif pix[x, y] >= 80 and on:
                runs.append((s, x - 1))
                on = False
        if on:
            runs.append((s, x1))
        widths = [b - a + 1 for a, b in runs]
        print(f"  yfrac={frac:.2f} y={y} runs={widths}")

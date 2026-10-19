from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

font_path = r"C:\Users\bende\OneDrive\Desktop\Kapo website\kapo-custom-font-final\KAPO-Custom-Black.ttf"
f = TTFont(font_path)
g = f["glyf"]
h = f["hmtx"]
names = list("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz") + ["two", "six", "nine", "zero"]
for n in names:
    gl = g[n]
    print("%-8s contours=%3d y=%5d..%-5d x=%5d..%-5d adv=%d" % (n, gl.numberOfContours, gl.yMin, gl.yMax, gl.xMin, gl.xMax, h[n][0]))

# Large labeled review of problem glyphs
chars = list("KAPOHBGRS") + ["2", "Z", "0", "1", "3", "4", "5", "6", "7", "8", "9"] + list("abdegjnmhpqystuvwx") + list("&@#") + ["[", "]", "(", ")", "{", "}"]
size = 220
font = ImageFont.truetype(font_path, size)
ascent, descent = font.getmetrics()
cols = 6
cell_w, cell_h = 280, ascent + descent + 36
rows = (len(chars) + cols - 1) // cols
im = Image.new("RGB", (cols * cell_w, rows * cell_h), "white")
draw = ImageDraw.Draw(im)
label = ImageFont.load_default()
for i, ch in enumerate(chars):
    x = (i % cols) * cell_w
    y = (i // cols) * cell_h
    base = y + 18 + ascent
    draw.line((x + 8, base, x + cell_w - 8, base), fill=(220, 80, 80))
    xh = base - 540 * size / 1000
    cap = base - 720 * size / 1000
    draw.line((x + 8, xh, x + cell_w - 8, xh), fill=(180, 180, 220))
    draw.line((x + 8, cap, x + cell_w - 8, cap), fill=(180, 220, 180))
    draw.text((x + 8, y + 2), ch, fill=(150, 150, 150), font=label)
    draw.text((x + 24, y + 18), ch, fill=(0, 0, 0), font=font)
im.save(r"C:\Users\bende\OneDrive\Desktop\Kapo website\kapo-custom-font-final\_review.png")
print("saved review", im.size)

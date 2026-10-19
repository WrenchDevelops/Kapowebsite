from fontTools.ttLib import TTFont

path = r"C:\Users\bende\OneDrive\Desktop\Kapo website\public\fonts\KAPO-Custom-Black-v3.ttf"
font = TTFont(path)
glyf = font["glyf"]
cmap = font.getBestCmap()
need = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?:;'\"-_/&@#$%+=()[]{}* "
missing = [ch for ch in need if ord(ch) not in cmap]
print("missing", "".join(missing) or "none")
for ch in "gjpqy2Z":
    glyph = glyf[cmap[ord(ch)]]
    print(ch, glyph.yMin, glyph.yMax, glyph.numberOfContours)

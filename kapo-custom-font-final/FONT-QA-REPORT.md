# KAPO Custom Black — automated QA

Font: KAPO Custom Black 2.000

Failures: 0

PASS builders succeeded (0 errors)
PASS cmap covers required characters; missing []
PASS H vertical bounds yMin=0 yMax=720 expected yMin -8..12 yMax 708..732
PASS O vertical bounds yMin=-18 yMax=738 expected yMin -28..-4 yMax 724..750
PASS o vertical bounds yMin=-18 yMax=558 expected yMin -30..-2 yMax 542..572
PASS n vertical bounds yMin=0 yMax=540 expected yMin -8..14 yMax 516..550
PASS x vertical bounds yMin=2 yMax=538 expected yMin -8..16 yMax 510..552
PASS b vertical bounds yMin=-18 yMax=768 expected yMin -32..8 yMax 744..778
PASS p vertical bounds yMin=-204 yMax=558 expected yMin -212..-174 yMax 532..574
PASS q vertical bounds yMin=-204 yMax=558 expected yMin -212..-174 yMax 532..574
PASS g vertical bounds yMin=-197 yMax=558 expected yMin -220..-164 yMax 524..588
PASS y vertical bounds yMin=-194 yMax=543 expected yMin -220..-164 yMax 510..556
PASS l vertical bounds yMin=0 yMax=768 expected yMin -8..14 yMax 744..778
PASS j descends (yMin=-208)
PASS j dot clears x-height (yMax=746)
PASS g connected components 1 expected 1
PASS g has ink below the baseline (11585 px)
PASS g has ink in the x-height (47263 px)
PASS j connected components 2 expected 2
PASS j has ink below the baseline (11491 px)
PASS j has ink in the x-height (20775 px)
PASS p connected components 1 expected 1
PASS p has ink below the baseline (6528 px)
PASS p has ink in the x-height (53106 px)
PASS q connected components 1 expected 1
PASS q has ink below the baseline (6525 px)
PASS q has ink in the x-height (53112 px)
PASS y connected components 1 expected 1
PASS y has ink below the baseline (7588 px)
PASS y has ink in the x-height (32284 px)
PASS i connected components 2 expected 2
PASS i stays on the baseline (0 px below)
PASS i has ink in the x-height (20251 px)
PASS p bowl is wider than its descender stem (above 288, below 74)
PASS p descender is the left stem
PASS p bowl does not descend
PASS q bowl does not descend
PASS g bowl mass sits above the baseline
PASS g upper bowl has an open counter
PASS y has two upper branches (2 runs)
PASS numeral 2 is not a copy of Z (IoU 0.62)
PASS numeral 2 has a curved upper counter
PASS uppercase Z has no upper counter
PASS 2 base is wider than its top (top 47 base 173)
PASS H H do not collide
PASS O O do not collide
PASS n n do not collide
PASS o o do not collide

## Visual review

Rendered from the exported TTF with the system rasterizer, not from the construction sketch.

Checked at large size and in real strings: SHOPKAPO, "Keycaps with character.", "Some character. Two ways to use it.", "jumpy pygmy", "gadget typography", "g j p q y", and "2026".

- K, A, and P follow the wordmark: pill stem, open-crotch A with a triangular counter, P bowl with a horizontal pill counter and a stem that continues to the baseline.
- g is a single-story form. The bowl and its circular counter sit on the baseline. Only the tail drops below the baseline and hooks left. One connected black shape.
- j has a dot at the same height as i, a stem through the x-height, and a smooth hook to the left below the baseline.
- p and q keep the bowl in the x-height. Only the stem descends. The bowl does not float and does not stretch to the descender.
- y has two branches in the x-height and one tail below the baseline.
- Numeral 2 has a curved upper bowl with a counter and a thick horizontal base. It is not the Z outline. Z remains a straight-bar zigzag.
- 6 and 9 have open counters. 8 has two counters. Lowercase n, m, h, and u sit on the x-height instead of overshooting toward the cap.
- Round letters overshoot the baseline and x-height or cap by about 18 units. Flat letters sit on the guides.
- H/H, O/O, n/n, and o/o keep a gap.

Notes that are acceptable at this weight and worth knowing:

- The lowercase e is very closed, which is what this stroke weight does. The eye and bar are there, and it reads in "the", but it is nearer to a bold e than to a light text e.
- The ampersand is a simplified two-part form. It reads as &, and it is not as refined as the letters K, A, and P.
- S and s still sit a few units lower than the flat caps. They are not clipped.

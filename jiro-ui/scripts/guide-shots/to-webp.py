"""Convert a guide's raw screenshots into the webp pairs the app serves.

    python scripts/guide-shots/to-webp.py <guide> [name ...]

Reads scripts/guide-shots/.raw/<guide>/<name>-{light,dark}.png (from
capture.mjs) and writes public/images/guide/<guide>/<name>-{light,dark}.webp,
at most 1600px wide, lowering the quality until each file is under the size
budget. Prints each file's width, height and size: width and height go
straight into <guide-shot [width] [height]>.
"""
import os
import sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, ".raw")
OUT = os.path.join(HERE, "..", "..", "public", "images", "guide")

GUIDES = ("basics", "jym", "culinara", "journaly", "ledger")
MAX_WIDTH = 1600
BUDGET = 120 * 1024
QUALITIES = (82, 76, 70, 64, 58, 52, 46, 40)


def convert(src, dst):
    img = Image.open(src).convert("RGB")
    if img.width > MAX_WIDTH:
        img = img.resize((MAX_WIDTH, round(img.height * MAX_WIDTH / img.width)), Image.LANCZOS)
    for q in QUALITIES:
        img.save(dst, "WEBP", quality=q, method=6)
        size = os.path.getsize(dst)
        if size <= BUDGET:
            break
    return img.width, img.height, size, q


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in GUIDES:
        sys.exit(f"usage: python scripts/guide-shots/to-webp.py <{'|'.join(GUIDES)}> [name ...]")
    guide, only = sys.argv[1], set(sys.argv[2:])
    src_dir = os.path.join(RAW, guide)
    dst_dir = os.path.normpath(os.path.join(OUT, guide))
    if not os.path.isdir(src_dir):
        sys.exit(f"to-webp: no raw shots in {src_dir}; run capture.mjs {guide} first")
    os.makedirs(dst_dir, exist_ok=True)

    pngs = sorted(f for f in os.listdir(src_dir) if f.endswith((".png")))
    if only:
        pngs = [f for f in pngs if f.rsplit("-", 1)[0] in only]
    if not pngs:
        sys.exit("to-webp: nothing to convert")

    over = 0
    for f in pngs:
        dst = os.path.join(dst_dir, f[:-4] + ".webp")
        w, h, size, q = convert(os.path.join(src_dir, f), dst)
        flag = "" if size <= BUDGET else "  OVER BUDGET: crop the shot tighter"
        over += size > BUDGET
        print(f"  {guide}/{f[:-4]}.webp  width={w} height={h}  {size / 1024:.0f} KB  q{q}{flag}")
    if over:
        sys.exit(f"to-webp: {over} file(s) over {BUDGET // 1024} KB")


if __name__ == "__main__":
    main()

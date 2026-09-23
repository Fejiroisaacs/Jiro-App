"""Compose the Open Graph card at public/images/og/jiro-og.png.

Re-runnable. Built from the real dark-mode dashboard shot rather than a mockup,
because the product itself is the most honest thing to show. 1200x630 is the
size every platform crops toward.

Text is kept large and well inside the edges: Twitter, Slack and LinkedIn all
crop this differently, and anything near a border is the first thing lost.
"""
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.join(HERE, "..", "public")
SRC = os.path.join(PUB, "images", "landing", "dashboard-dark.webp")
OUT = os.path.join(PUB, "images", "og", "jiro-og.png")

W, H = 1200, 630
# "Earth & Clay", the app's own palette.
INK = (38, 29, 24)
CREAM = (241, 233, 223)
CLAY = (110, 49, 40)   # --jiro-maroon, the brand primary
MUTED = (176, 162, 150)

DISPLAY = "C:/Windows/Fonts/BOOKOSB.TTF"   # a serif, closest to Newsreader
BODY = "C:/Windows/Fonts/calibri.ttf"

def font(path, size, fallback_size=None):
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default(fallback_size or size)

def main():
    card = Image.new("RGB", (W, H), INK)

    # The screenshot, blurred and dimmed, as texture rather than content: at
    # card size the individual UI is unreadable, so showing it sharp would just
    # look noisy.
    if os.path.exists(SRC):
        shot = Image.open(SRC).convert("RGB")
        scale = max(W / shot.width, H / shot.height) * 1.08
        shot = shot.resize((round(shot.width * scale), round(shot.height * scale)), Image.LANCZOS)
        left = (shot.width - W) // 2
        top = (shot.height - H) // 3
        shot = shot.crop((left, top, left + W, top + H))
        shot = shot.filter(ImageFilter.GaussianBlur(14))
        card.paste(shot, (0, 0))
        veil = Image.new("RGB", (W, H), INK)
        card = Image.blend(card, veil, 0.72)
    else:
        print("note: %s missing, using a flat ground" % SRC)

    d = ImageDraw.Draw(card)

    # A clay rule, the one piece of brand colour.
    d.rectangle([(84, 210), (84 + 96, 210 + 7)], fill=CLAY)

    d.text((84, 264), "Jiro", font=font(DISPLAY, 132), fill=CREAM)
    d.text((84, 416), "Your life, in one place.", font=font(BODY, 42), fill=CREAM)
    d.text((84, 470), "Recipes, workouts, journal and money.", font=font(BODY, 42), fill=CREAM)
    # Must stay literally true: the app keeps a first-party event log, so no
    # plain "no tracking" here.
    d.text((84, 536), "No ads.  No third-party tracking.  Never sold.", font=font(BODY, 30), fill=MUTED)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    card.save(OUT, "PNG", optimize=True)
    kb = os.path.getsize(OUT) / 1024
    print("wrote %s  %dx%d  %.1f kB" % (OUT, W, H, kb))
    if kb > 300:
        print("WARNING: over the 300 kB budget")

if __name__ == "__main__":
    main()

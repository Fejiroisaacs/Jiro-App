#!/usr/bin/env python3
"""
Convert the Jym how-to-use guide screenshots from PNG to WebP.

Why: the guide shipped 2561x1238 PNGs (~1.7 MB each) that the browser renders
into a prose column at most 904px wide (.page-container max-width 1000px minus
2 x --space-2xl/48px of .content-wrapper padding). Every one of those images was
being downscaled by ~2.8x on the way to the screen, so roughly 60% of the pixels
paid for in bytes were discarded before a single one was painted.

MAX_WIDTH is 1600: that is 1.77x the 904px column, which is effectively 2x-Retina
sharpness for flat UI screenshots (no photographic gradients or fine texture where
the last 0.23x would show), while cutting the pixel count by 61%.

Follows the same recipe as the landing-page conversion already done in this repo:
open with Pillow, convert('RGB'), resize if wider than MAX_WIDTH, save as WebP
with quality=82, method=6.

Re-runnable. A source PNG is deleted only after its WebP is written and verified;
files already converted are reported and skipped rather than treated as an error.

Usage (the PYTHONIOENCODING guard matters on Windows):
    PYTHONIOENCODING=utf-8 python jiro-ui/scripts/convert-guide-images.py
"""

import os
import sys

from PIL import Image

# --- configuration ---------------------------------------------------------

MAX_WIDTH = 1600
QUALITY = 82
METHOD = 6

# scripts/ -> jiro-ui/ -> public/images/jym-guide/
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
IMAGE_DIR = os.path.join(SCRIPT_DIR, os.pardir, "public", "images", "jym-guide")
IMAGE_DIR = os.path.normpath(IMAGE_DIR)


def human(num_bytes):
    """Format a byte count as a short MB/KB string."""
    if num_bytes >= 1024 * 1024:
        return "{:.2f} MB".format(num_bytes / (1024.0 * 1024.0))
    return "{:.1f} KB".format(num_bytes / 1024.0)


def convert(png_path):
    """
    Convert one PNG to WebP beside it.

    Returns a dict describing the result. The source PNG is unlinked only after
    the WebP exists on disk and re-opens cleanly.
    """
    webp_path = os.path.splitext(png_path)[0] + ".webp"
    old_bytes = os.path.getsize(png_path)

    with Image.open(png_path) as img:
        img = img.convert("RGB")
        src_size = (img.width, img.height)

        if img.width > MAX_WIDTH:
            new_height = round(img.height * MAX_WIDTH / img.width)
            img = img.resize((MAX_WIDTH, new_height), Image.LANCZOS)

        out_size = (img.width, img.height)
        img.save(webp_path, "WEBP", quality=QUALITY, method=METHOD)

    # Verify the save before destroying the only copy of the source.
    if not os.path.exists(webp_path):
        raise IOError("WebP was not written: {}".format(webp_path))
    with Image.open(webp_path) as check:
        check.load()
        if (check.width, check.height) != out_size:
            raise IOError(
                "WebP dimensions {}x{} do not match expected {}x{}: {}".format(
                    check.width, check.height, out_size[0], out_size[1], webp_path
                )
            )

    new_bytes = os.path.getsize(webp_path)
    os.remove(png_path)

    return {
        "name": os.path.basename(webp_path),
        "old_bytes": old_bytes,
        "new_bytes": new_bytes,
        "src_size": src_size,
        "out_size": out_size,
        "deleted": os.path.basename(png_path),
    }


def main():
    # Belt and braces alongside PYTHONIOENCODING: keep stdout on UTF-8 so a
    # non-ASCII filename in this table cannot raise UnicodeEncodeError on
    # a cp1252 Windows console.
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        pass

    if not os.path.isdir(IMAGE_DIR):
        print("ERROR: image directory not found: {}".format(IMAGE_DIR))
        return 1

    print("Guide image conversion: PNG -> WebP")
    print("Directory : {}".format(IMAGE_DIR))
    print("Settings  : max width {}px, quality {}, method {}".format(MAX_WIDTH, QUALITY, METHOD))
    print("")

    pngs = sorted(f for f in os.listdir(IMAGE_DIR) if f.lower().endswith(".png"))
    existing = sorted(f for f in os.listdir(IMAGE_DIR) if f.lower().endswith(".webp"))

    if not pngs:
        print("Nothing to convert: no PNG files present.")
        if existing:
            total = 0
            print("Already converted ({} files):".format(len(existing)))
            for name in existing:
                path = os.path.join(IMAGE_DIR, name)
                size = os.path.getsize(path)
                total += size
                with Image.open(path) as img:
                    dims = "{}x{}".format(img.width, img.height)
                print("  {:<46} {:>10} bytes  {}".format(name, size, dims))
            print("")
            print("Total on disk: {} bytes ({})".format(total, human(total)))
        return 0

    header = "{:<46} {:>11} {:>11} {:>9} {:>12}".format(
        "FILE", "OLD BYTES", "NEW BYTES", "SAVED", "NEW DIMS"
    )
    print(header)
    print("-" * len(header))

    results = []
    failures = []
    for name in pngs:
        png_path = os.path.join(IMAGE_DIR, name)
        try:
            res = convert(png_path)
        except Exception as exc:  # keep going; report at the end
            failures.append((name, exc))
            print("{:<46} {:>11} {:>11} {:>9} {:>12}".format(name, "-", "-", "FAILED", str(exc)[:12]))
            continue

        results.append(res)
        saved_pct = 100.0 * (res["old_bytes"] - res["new_bytes"]) / res["old_bytes"]
        print(
            "{:<46} {:>11} {:>11} {:>8.1f}% {:>12}".format(
                res["name"],
                res["old_bytes"],
                res["new_bytes"],
                saved_pct,
                "{}x{}".format(res["out_size"][0], res["out_size"][1]),
            )
        )

    print("-" * len(header))

    old_total = sum(r["old_bytes"] for r in results)
    new_total = sum(r["new_bytes"] for r in results)
    if results:
        saved_pct = 100.0 * (old_total - new_total) / old_total
        print(
            "{:<46} {:>11} {:>11} {:>8.1f}%".format(
                "TOTAL ({} files)".format(len(results)), old_total, new_total, saved_pct
            )
        )
        print("")
        print("Before : {} bytes ({})".format(old_total, human(old_total)))
        print("After  : {} bytes ({})".format(new_total, human(new_total)))
        print("Saved  : {} bytes ({})".format(old_total - new_total, human(old_total - new_total)))

    if results:
        print("")
        print("Deleted source PNGs ({}):".format(len(results)))
        for res in results:
            print("  - {}".format(res["deleted"]))

    if existing:
        print("")
        print("Already-converted WebP files left untouched ({}):".format(len(existing)))
        for name in existing:
            print("  - {}".format(name))

    if failures:
        print("")
        print("FAILURES ({}) - source PNGs kept:".format(len(failures)))
        for name, exc in failures:
            print("  - {}: {}".format(name, exc))
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())

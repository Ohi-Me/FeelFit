#!/usr/bin/env python3
"""Generate placeholder PNG icons for the FeelFit mobile app.

This produces:
  - public/icons/apple-touch-icon.png (180×180, iOS home screen)
  - public/icon-192.png (192×192, PWA manifest)
  - public/icon-512.png (512×512, PWA manifest)
  - android/app/src/main/res/mipmap-*/ic_launcher.png (multiple densities)
  - android/app/src/main/res/mipmap-*/ic_launcher_round.png
  - ios/App/App/Assets.xcassets/AppIcon.appiconset/icon-1024.png

It uses Pillow + cairosvg if available, otherwise it falls back to a flat
square with the brand color. Run from the project root:
    python3 scripts/generate-icons.py
"""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BRAND_BG = (10, 10, 10)          # #0a0a0a (matches globals.css :root --bg)
BRAND_FG = (255, 255, 255)       # white "F" mark
ACCENT   = (16, 185, 129)        # emerald accent

def draw_icon(size: int) -> bytes:
    """Return PNG bytes for a FeelFit icon of the given size."""
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        raise RuntimeError("Pillow is required: pip install pillow")

    img = Image.new("RGB", (size, size), BRAND_BG)
    d = ImageDraw.Draw(img)

    # Centered "F" mark — a tall rounded rectangle with a crossbar (mimics the
    # favicon path). Sizes are proportional to the icon size.
    margin = int(size * 0.18)
    body_w = int(size * 0.18)
    body_h = size - 2 * margin
    x0, y0 = (size - body_w) // 2, margin
    x1, y1 = x0 + body_w, y0 + body_h
    d.rounded_rectangle([x0, y0, x1, y1], radius=int(size * 0.05), fill=BRAND_FG)

    # Crossbar
    cb_w = int(size * 0.28)
    cb_h = int(size * 0.10)
    cb_y0 = int(size * 0.40)
    cb_x0 = (size - cb_w) // 2
    d.rounded_rectangle([cb_x0, cb_y0, cb_x0 + cb_w, cb_y0 + cb_h], radius=int(size * 0.03), fill=BRAND_FG)

    # Subtle accent dot — a small emerald circle at the bottom-right of the F mark
    dot_r = max(2, int(size * 0.04))
    d.ellipse([x1 - dot_r, y1 - dot_r - int(size*0.02), x1 + dot_r, y1 + dot_r - int(size*0.02)], fill=ACCENT)

    from io import BytesIO
    buf = BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def main():
    targets = [
        # Web / PWA
        (ROOT / "public/icons/apple-touch-icon.png", 180),
        (ROOT / "public/icon-192.png", 192),
        (ROOT / "public/icon-512.png", 512),
        # iOS AppIcon (single 1024×1024 — Xcode 14+ asset catalog)
        (ROOT / "ios/App/App/Assets.xcassets/AppIcon.appiconset/icon-1024.png", 1024),
        # Android mipmap densities
        (ROOT / "android/app/src/main/res/mipmap-mdpi/ic_launcher.png", 48),
        (ROOT / "android/app/src/main/res/mipmap-hdpi/ic_launcher.png", 72),
        (ROOT / "android/app/src/main/res/mipmap-xhdpi/ic_launcher.png", 96),
        (ROOT / "android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png", 144),
        (ROOT / "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png", 192),
    ]
    # Round icons for Android (same drawing works as round)
    for density, size in [("mdpi", 48), ("hdpi", 72), ("xhdpi", 96), ("xxhdpi", 144), ("xxxhdpi", 192)]:
        targets.append((ROOT / f"android/app/src/main/res/mipmap-{density}/ic_launcher_round.png", size))

    # Splash images — large background-only PNGs in brand color
    splash_sizes = {
        "drawable-xxxhdpi": (1280, 1920),
        "drawable-xxhdpi":  (960, 1600),
        "drawable-xhdpi":   (640, 960),
        "drawable-hdpi":    (480, 800),
        "drawable-mdpi":    (320, 480),
    }

    n = 0
    for path, size in targets:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(draw_icon(size))
        n += 1
        print(f"  ✓ {path.relative_to(ROOT)}  ({size}×{size})")

    # Splash: just brand color with a centered white "F" mark
    try:
        from PIL import Image, ImageDraw
        for density, (w, h) in splash_sizes.items():
            img = Image.new("RGB", (w, h), BRAND_BG)
            d = ImageDraw.Draw(img)
            # Centered small icon mark
            ms = min(w, h) // 3
            mx0, my0 = (w - ms) // 2, (h - ms) // 2
            body_w = int(ms * 0.18)
            body_h = ms - 2 * int(ms * 0.18)
            x0, y0 = (w - body_w) // 2, my0
            x1, y1 = x0 + body_w, y0 + body_h
            d.rounded_rectangle([x0, y0, x1, y1], radius=int(ms * 0.05), fill=BRAND_FG)
            cb_w = int(ms * 0.28); cb_h = int(ms * 0.10); cb_y0 = int(h * 0.40)
            cb_x0 = (w - cb_w) // 2
            d.rounded_rectangle([cb_x0, cb_y0, cb_x0 + cb_w, cb_y0 + cb_h], radius=int(ms * 0.03), fill=BRAND_FG)
            from io import BytesIO
            buf = BytesIO()
            img.save(buf, format="PNG", optimize=True)
            p = ROOT / f"android/app/src/main/res/{density}/splash.png"
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(buf.getvalue())
            n += 1
            print(f"  ✓ {p.relative_to(ROOT)}  ({w}×{h})")

        # iOS splash: a single 2732×2732 PNG used for all scales
        ios_splash = Image.new("RGB", (2732, 2732), BRAND_BG)
        d = ImageDraw.Draw(ios_splash)
        ms = 2732 // 3
        body_w = int(ms * 0.18)
        body_h = ms - 2 * int(ms * 0.18)
        x0 = (2732 - body_w) // 2
        y0 = (2732 - ms) // 2
        x1, y1 = x0 + body_w, y0 + body_h
        d.rounded_rectangle([x0, y0, x1, y1], radius=int(ms * 0.05), fill=BRAND_FG)
        cb_w = int(ms * 0.28); cb_h = int(ms * 0.10); cb_y0 = int(2732 * 0.40)
        cb_x0 = (2732 - cb_w) // 2
        d.rounded_rectangle([cb_x0, cb_y0, cb_x0 + cb_w, cb_y0 + cb_h], radius=int(ms * 0.03), fill=BRAND_FG)
        from io import BytesIO
        buf = BytesIO()
        ios_splash.save(buf, format="PNG", optimize=True)
        for fname in ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]:
            p = ROOT / f"ios/App/App/Assets.xcassets/Splash.imageset/{fname}"
            if p.parent.exists():
                p.write_bytes(buf.getvalue())
                n += 1
                print(f"  ✓ {p.relative_to(ROOT)}  (2732×2732)")
    except Exception as e:
        print(f"  ! Skipped splash generation: {e}")

    print(f"\n[generate-icons] Wrote {n} icon(s).")


if __name__ == "__main__":
    main()

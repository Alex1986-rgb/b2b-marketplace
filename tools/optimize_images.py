#!/usr/bin/env python3
"""Пережимает исходники project/img/src/*.png → project/img/<имя>.jpg (прогрессивный JPEG) + <имя>.webp.

Ширина по фактическому размеру показа на сайте (замер headless Chrome, DPR 2, 14.09.26):
  • товарные packshot p-*            — до 900 px (показ до 888×380 contain, миниатюры 80×80);
  • крупные сцены (HERO)            — до 1600 px (src 1536, поэтому фактически 1536);
  • остальные сцены (карточки, баннеры) — до 1000 px (показ ≤ 509 CSS px).
Качество: JPEG q=76 (ImageMagick, 4:2:0, progressive, без метаданных), WebP q=74 (cwebp, -m 6).
og-cover.jpg исходника не имеет — ему только lossless-перепаковка jpegtran в progressive.

Запуск:  python3 tools/optimize_images.py            — только новые/изменённые исходники
         python3 tools/optimize_images.py --force    — пересобрать всё
         python3 tools/optimize_images.py --no-webp  — без .webp
Нужны: magick (ImageMagick 7), cwebp, jpegtran — все есть в Homebrew. Без magick откатывается на sips (без progressive).
"""
import glob, os, shutil, subprocess, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
IMG = os.path.join(ROOT, "project", "img")
SRC = os.path.join(IMG, "src")

JPEG_Q, WEBP_Q = 76, 74
HERO = {  # показ шире ~500 CSS px (hero, обложки статей, баннер поставщиков)
    "hero-pump-hall", "supplier-dock", "project-commissioning", "about-engineer",
    "art-hero", "art-vfd", "blog-boiler",
}
SMALL = {"nameplate": 800}  # показ 246×90 cover


def target_width(name):
    if name in SMALL:
        return SMALL[name]
    if name.startswith("p-"):
        return 900
    return 1600 if name in HERO else 1000


def run(cmd):
    subprocess.run(cmd, check=True, capture_output=True)


def main():
    force = "--force" in sys.argv
    webp = "--no-webp" not in sys.argv and shutil.which("cwebp")
    magick = shutil.which("magick")
    before = after = n = 0
    for png in sorted(glob.glob(os.path.join(SRC, "*.png"))):
        name = os.path.splitext(os.path.basename(png))[0]
        jpg, wp = os.path.join(IMG, name + ".jpg"), os.path.join(IMG, name + ".webp")
        fresh = os.path.exists(jpg) and os.path.getmtime(jpg) >= os.path.getmtime(png)
        if fresh and (not webp or os.path.exists(wp)) and not force:
            continue
        w = target_width(name)
        old = os.path.getsize(jpg) if os.path.exists(jpg) else 0
        if magick:
            # "w>" — только уменьшать, не растягивать мелкий исходник
            run([magick, png, "-resize", f"{w}x{w * 4}>", "-strip", "-sampling-factor", "4:2:0",
                 "-interlace", "Plane", "-quality", str(JPEG_Q), jpg])
        else:
            run(["sips", "-Z", str(w), "-s", "format", "jpeg", "-s", "formatOptions", str(JPEG_Q), png, "--out", jpg])
        if webp:
            iw = int(subprocess.run(["sips", "-g", "pixelWidth", png], capture_output=True, text=True).stdout.split()[-1])
            cmd = ["cwebp", "-quiet", "-q", str(WEBP_Q), "-m", "6", "-metadata", "none"]
            if iw > w:
                cmd += ["-resize", str(w), "0"]
            run(cmd + [png, "-o", wp])
        before += old
        after += os.path.getsize(jpg)
        n += 1
        print(f"{name:26} {w:>5}px  {old // 1024:>4} → {os.path.getsize(jpg) // 1024:>4} KB"
              + (f"  webp {os.path.getsize(wp) // 1024:>4} KB" if webp else ""))
    # og-cover: без исходника — lossless progressive
    og = os.path.join(IMG, "og-cover.jpg")
    if os.path.exists(og) and shutil.which("jpegtran") and (force or n):
        tmp = og + ".tmp"
        run(["jpegtran", "-copy", "none", "-optimize", "-progressive", "-outfile", tmp, og])
        os.replace(tmp, og)
    print(f"пережато: {n}, JPEG {before // 1024} → {after // 1024} KB")


if __name__ == "__main__":
    main()

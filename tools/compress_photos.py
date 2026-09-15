#!/usr/bin/env python3
"""Сжимает project/img/src/*.png → project/img/*.jpg (sips). Товарные и квадратные — до 900 px, сцены — до 1400 px.
Пропускает уже сжатые (jpg новее png)."""
import os, glob, subprocess
IMG = os.path.join(os.path.dirname(__file__), "..", "project", "img")
n = 0
for png in sorted(glob.glob(os.path.join(IMG, "src", "*.png"))):
    name = os.path.splitext(os.path.basename(png))[0]
    jpg = os.path.join(IMG, name + ".jpg")
    if os.path.exists(jpg) and os.path.getmtime(jpg) >= os.path.getmtime(png):
        continue
    w = "900" if name.startswith("p-") or name == "nameplate" else "1400"
    subprocess.run(["sips", "-Z", w, "-s", "format", "jpeg", "-s", "formatOptions", "72", png, "--out", jpg], check=True, capture_output=True)
    n += 1
print("сжато новых:", n)

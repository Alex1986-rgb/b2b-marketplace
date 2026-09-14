#!/usr/bin/env python3
"""Сжимает project/img/src/*.png в project/img/*.jpg (sips) и вставляет фото в плейсхолдеры .ph макета.
Идемпотентно: повторный прогон ничего не дублирует (метка data-photo)."""
import os, re, subprocess, glob
ROOT = os.path.join(os.path.dirname(__file__), "..", "project")
F = os.path.join(ROOT, "Промышленный агрегатор.dc.html")
SRC, OUT = os.path.join(ROOT, "img", "src"), os.path.join(ROOT, "img")

for png in sorted(glob.glob(os.path.join(SRC, "*.png"))):
    name = os.path.splitext(os.path.basename(png))[0]
    jpg = os.path.join(OUT, name + ".jpg")
    if not os.path.exists(jpg) or os.path.getmtime(jpg) < os.path.getmtime(png):
        w = "900" if name.startswith("p-") or name == "nameplate" else "1400"
        subprocess.run(["sips", "-Z", w, "-s", "format", "jpeg", "-s", "formatOptions", "74", png, "--out", jpg],
                       check=True, capture_output=True)

def bg(name): return f"url(img/{name}.jpg) center/cover no-repeat"

s = open(F, encoding="utf-8").read()
ph = [m for m in re.finditer(r'<(div|figure) class="(ph duotone|blueprint duotone ph|ph)" style="', s)]
# порядок плейсхолдеров в файле → фото (None = не трогать; "{{ x.bg }}" = из данных цикла)
plan = ["warehouse", "{{ p.bg }}", "p-cr32", "p-lgcy75", "p-cr32", "{{ c.bg }}", None, "brand",
        "nameplate", "{{ p.bg }}", "p-cr32", "dir-pumps", "blog-boiler", "{{ a.bg }}", "art-hero", "art-vfd"]
assert len(ph) == len(plan) + 1 or len(ph) == len(plan), (len(ph), len(plan))
for m, name in reversed(list(zip(ph, plan))):
    if name is None: continue
    tag_end = s.find(">", m.end())
    if "data-photo" in s[m.start():tag_end]: continue
    val = name if name.startswith("{{") else bg(name)
    s = s[:m.end()] + f"background:{val};" + s[m.end():tag_end] + ' data-photo="1"' + s[tag_end:]
# убрать подписи-заглушки «фото · …»
s = re.sub(r'\s*<span class="mono" style="[^"]*">фото · [^<]*</span>', "", s)
s = re.sub(r'\s*<span class="mono" style="[^"]*">\{\{ a\.photo \}\}</span>', "", s)

# данные циклов
prod = {"96122802": "p-cr32", "98160680": "p-nb40", "WL-CNP-2-80": "p-nis80", "KSN-LGCY-75": "p-lgcy75",
        "INV-VR-15": "p-vr15", "SKF-6205": "p-6205"}
def add_bg(block):
    def rep(m):
        line = m.group(0)
        if "bg:" in line: return line
        sku = re.search(r'sku: "([^"]+)"', line)
        if sku and sku.group(1) in prod:
            return line.replace("{ sku:", '{ bg: "%s", sku:' % bg(prod[sku.group(1)]), 1)
        return line
    return re.sub(r'\{ sku: "[^"]+"[^\n]*', rep, block)
for key in ["catalogProducts = [", "cart: [", "mobileCatalog: ["]:
    i = s.find(key); j = s.find("]", s.find("\n", i) + 1 if False else i + len(key))
    j = s.find("\n    ]", i) if key.startswith("catalog") else s.find("\n      ]", i)
    s = s[:i] + add_bg(s[i:j]) + s[j:]
arts = ["a-compressor", "a-bearing", "a-motor", "a-vfd", "a-valves", "a-air", "a-hex", "a-water", "a-containers"]
i = s.find("articles: ["); j = s.find("\n      ]", i); block = s[i:j]; k = iter(arts)
block = re.sub(r'\{ section: ', lambda m: '{ bg: "%s", section: ' % bg(next(k)), block) if "bg:" not in block else block
s = s[:i] + block + s[j:]
open(F, "w", encoding="utf-8").write(s)
print("плейсхолдеров:", len(ph), "фото в img:", len(glob.glob(os.path.join(OUT, "*.jpg"))))

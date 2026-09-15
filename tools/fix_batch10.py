#!/usr/bin/env python3
"""Пачка 10 (15.09.26): оригинальные логотипы брендов в бегущей строке (project/img/logos/*.svg, источники — SOURCES.md).
Бренды без свободного оригинала остаются текстовыми знаками."""
import os, sys
P = os.path.join(os.path.dirname(__file__), "..", "project", "Промышленный агрегатор.dc.html")
s = open(P, encoding="utf-8").read()
def R(old, new, n=1):
    global s
    c = s.count(old)
    if c != n: sys.exit(f"[{c}≠{n}] {old[:100]!r}")
    s = s.replace(old, new)
R('''<a href="#" onClick="{{ goBrand }}" class="brand-logo" title="{{ n.t }}"><span class="brand-logo-mark"><span class="ico ico-20 {{ n.icon }}"></span></span><span class="brand-logo-name">{{ n.t }}</span></a>''',
  '''<a href="#" onClick="{{ goBrand }}" class="brand-logo {{ n.cls }}" title="{{ n.t }}"><span class="brand-logo-img" role="img" aria-label="{{ n.t }}" style="{{ n.imgStyle }}"></span><span class="brand-logo-mark" style="{{ n.markStyle }}"><span class="ico ico-20 {{ n.icon }}"></span></span><span class="brand-logo-name" style="{{ n.nameStyle }}">{{ n.t }}</span></a>''')
R('''.map(([t, k]) => ({ t, icon: prof[k] }));''',
  '''.map(([t, k]) => {
          // оригинальные логотипы: файл и ширина плашки при высоте 30 px; name — показывать ли название рядом (у знака без текста)
          const L = { "Wilo": ["wilo", 74], "SKF": ["skf", 70], "NSK": ["nsk", 78], "SEW-Eurodrive": ["sew", 76], "NORD": ["nord", 100], "Danfoss": ["danfoss", 96], "Atlas Copco": ["atlascopco", 112], "Festo": ["festo", 92], "Parker": ["parker", 104], "Ebara": ["ebara", 74], "ABB": ["abb", 72], "Siemens": ["siemens", 100], "Schneider": ["schneider", 30, true] }[t];
          return L ? { t, icon: prof[k], cls: "has-logo", imgStyle: "display:block;width:" + L[1] + "px;height:30px;background:url(img/logos/" + L[0] + ".svg) center/contain no-repeat", markStyle: "display:none", nameStyle: L[2] ? "" : "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)" }
                   : { t, icon: prof[k], cls: "", imgStyle: "display:none", markStyle: "", nameStyle: "" };
        });''')
R('''  .brand-logo-mark { width:32px;''', '''  .brand-logo.has-logo { padding:8px 18px; gap:10px; position:relative; }
  .brand-logo-mark { width:32px;''')
open(P, "w", encoding="utf-8").write(s)
print("пачка 10 применена")

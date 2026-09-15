#!/usr/bin/env python3
"""Пачка 8 (14.09.26): бегущая строка брендов — монохромные знаки (иконка профиля + название), ссылки на страницы брендов.
Чужие логотипы не копируются: у каждого бренда единый нейтральный знак с иконкой его профиля."""
import os, sys
P = os.path.join(os.path.dirname(__file__), "..", "project", "Промышленный агрегатор.dc.html")
s = open(P, encoding="utf-8").read()
def R(old, new, n=1):
    global s
    c = s.count(old)
    if c != n: sys.exit(f"[{c}≠{n}] {old[:100]!r}")
    s = s.replace(old, new)

R('''              <span class="mono" style="font-size:14px;color:var(--color-neutral-800);padding:0 22px;border-right:1px solid var(--color-divider);white-space:nowrap">{{ n }}</span>''',
  '''              <a href="#" onClick="{{ goBrand }}" class="brand-logo" title="{{ n.t }}"><span class="brand-logo-mark"><span class="ico ico-20 {{ n.icon }}"></span></span><span class="brand-logo-name">{{ n.t }}</span></a>''')
R('''        const brands = ["GRUNDFOS", "WILO", "CNP", "SKF", "NSK", "SEW-EURODRIVE", "NORD", "INNOVERT", "SCHNEIDER", "ABB", "SIEMENS", "DANFOSS", "KAISHAN", "ATLAS COPCO", "FESTO", "CAMOZZI", "PARKER", "EBARA", "ЛИВГИДРОМАШ", "КАЛУЖСКИЙ НЗ", "ЧЕБОКСАРСКИЙ ЭА", "ВЗЛЁТ", "ЭЛЕКТРОПРИВОД", "РЕДУКТОР-ПТО"];''',
  '''        const prof = { pump: "i-dir-pumps", bearing: "i-dir-bearings", gear: "i-dir-gearboxes", vfd: "i-dir-vfd", el: "i-dir-electrical", air: "i-dir-compressors", pn: "i-dir-pneumatics", kip: "i-dir-kipia" };
        const brands = [["Grundfos", "pump"], ["Wilo", "pump"], ["CNP", "pump"], ["SKF", "bearing"], ["NSK", "bearing"], ["SEW-Eurodrive", "gear"], ["NORD", "gear"], ["INNOVERT", "vfd"], ["Schneider", "el"], ["ABB", "el"], ["Siemens", "el"], ["Danfoss", "vfd"], ["Kaishan", "air"], ["Atlas Copco", "air"], ["Festo", "pn"], ["Camozzi", "pn"], ["Parker", "pn"], ["Ebara", "pump"], ["Ливгидромаш", "pump"], ["Калужский НЗ", "pump"], ["Чебоксарский ЭА", "el"], ["Взлёт", "kip"], ["Электропривод", "vfd"], ["Редуктор-ПТО", "gear"]].map(([t, k]) => ({ t, icon: prof[k] }));''')
R('''  .marquee-wrap:hover .marquee-track { animation-play-state: paused; }''',
  '''  .marquee-wrap:hover .marquee-track { animation-play-state: paused; }
  .marquee-track:hover { animation-play-state: paused; }
  .brand-logo { display:inline-flex; align-items:center; gap:10px; margin:0 10px; padding:8px 16px 8px 8px; border-radius:12px; background:var(--color-surface, #fff); border:1px solid color-mix(in srgb, var(--color-text) 8%, transparent); text-decoration:none; color:var(--color-neutral-700); white-space:nowrap; filter:grayscale(1); opacity:.85; transition:filter .2s, opacity .2s, box-shadow .2s, color .2s; }
  .brand-logo:hover { filter:none; opacity:1; color:var(--color-text); box-shadow:0 6px 18px rgba(22,38,58,.10); }
  .brand-logo-mark { width:32px; height:32px; border-radius:9px; display:grid; place-items:center; background:var(--color-accent); color:#fff; flex:none; }
  .brand-logo-name { font-family:var(--font-heading); font-weight:600; font-size:17px; letter-spacing:.01em; }''')
open(P, "w", encoding="utf-8").write(s)
print("пачка 8 применена")

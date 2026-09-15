#!/usr/bin/env python3
"""Доработка 14.09.26, пачка 3: служебная шапка для кабинетов оператора и поставщика,
имя компании вместо «Войти» в кабинете клиента, отмеченные фильтры, ровные сетки."""
import os, sys
P = os.path.join(os.path.dirname(__file__), "..", "project", "Промышленный агрегатор.dc.html")
s = open(P, encoding="utf-8").read()
def R(old, new, n=1):
    global s
    c = s.count(old)
    if c != n: sys.exit(f"[{c}≠{n}] {old[:100]!r}")
    s = s.replace(old, new)

TOP = '<div style="background:var(--color-neutral-900);color:var(--color-neutral-300);font-size:13px">\n    <div style="max-width:1360px;margin:0 auto;padding:0 28px;min-height:36px;'
R(TOP, '<sc-if value="{{ isStorefront }}" hint-placeholder-val="{{ true }}">\n  ' + TOP)
STAFF = '''  </header>
  </sc-if>

  <sc-if value="{{ isStaff }}" hint-placeholder-val="{{ false }}">
  <header style="background:var(--color-neutral-900);color:var(--color-neutral-300);border-bottom:1px solid #000">
    <div style="max-width:1360px;margin:0 auto;padding:12px 28px;display:flex;align-items:center;gap:18px;flex-wrap:wrap">
      <a href="#" onClick="{{ goHome }}" style="display:flex;align-items:center;gap:10px;text-decoration:none;color:#fff">
        <span style="width:18px;height:18px;background:var(--color-accent);display:block"></span>
        <span style="font-family:var(--font-heading);font-weight:600;font-size:19px">ПРОМКОНТУР</span>
      </a>
      <span class="mono" style="font-size:12px;text-transform:uppercase;color:var(--color-accent-300)">{{ staffTitle }}</span>
      <nav style="display:flex;gap:4px;flex-wrap:wrap;margin-left:12px">
        <sc-for list="{{ staffNav }}" as="n" hint-placeholder-count="6">
          <a href="#" onClick="{{ n.go }}" style="{{ n.style }}">{{ n.t }}</a>
        </sc-for>
      </nav>
      <span style="margin-left:auto;display:flex;align-items:center;gap:10px;font-size:13px">
        <span style="width:28px;height:28px;background:var(--color-accent-700);color:#fff;display:grid;place-items:center;font-size:12px;font-weight:600">{{ staffInitials }}</span>{{ staffUser }}
      </span>
    </div>
  </header>
  </sc-if>'''
R('    </nav>\n  </header>', '    </nav>\n' + STAFF)
R('<a href="#" onClick="{{ goAuth }}" style="color:var(--color-neutral-300)">Войти</a>',
  '<a href="#" onClick="{{ goAuthOrAccount }}" style="color:var(--color-neutral-300)">{{ loginLabel }}</a>')

R('      hasSeo: !!seo[cur],', '''      hasSeo: !!seo[cur],
      ...(() => {
        const ops = ["crm", "voice", "autopilot", "logistics", "unit", "incident", "roles", "admin", "client"];
        const isOps = ops.includes(cur), isVend = cur === "vendor";
        const buyer = ["account", "order", "notify", "cart"].includes(cur);
        const navOps = [["CRM", "crm"], ["Карточка клиента", "client"], ["Автопилот", "autopilot"], ["Голосовой робот", "voice"], ["Логистика", "logistics"], ["Ошибки", "incident"], ["Экономика", "unit"], ["Права", "roles"], ["Админка", "admin"]];
        const navVend = [["Заявки и прайс", "vendor"], ["Условия работы", "terms"], ["Витрина", "homeB"]];
        return {
          isStorefront: !isOps && !isVend, isStaff: isOps || isVend,
          staffTitle: isVend ? "Кабинет поставщика" : "Панель оператора",
          staffUser: isVend ? "ООО «Гидромаш»" : "Петров А. · оператор",
          staffInitials: isVend ? "ГМ" : "ПА",
          staffNav: (isVend ? navVend : navOps).map(([t, id]) => ({ t, go: this.go(id),
            style: "font-size:13px;padding:6px 10px;text-decoration:none;" + (id === cur ? "background:var(--color-accent-700);color:#fff" : "color:var(--color-neutral-300)") })),
          loginLabel: buyer ? "ООО «Метизный завод»" : "Войти",
          goAuthOrAccount: this.go(buyer ? "account" : "auth")
        };
      })(),''')

# ── Каталог: активные чипы = отмеченные галочки в фильтрах
R('''<span style="width:14px;height:14px;border:1.5px solid var(--color-divider);flex:none;display:block"></span>{{ o }}''',
  '''<span style="width:14px;height:14px;border:1.5px solid {{ o.border }};background: {{ o.fill }};flex:none;display:block"></span>{{ o.t }}''')
R('<sc-for list="{{ f.options }}" as="o" hint-placeholder-count="3">', '<sc-for list="{{ f.opts }}" as="o" hint-placeholder-count="3">')
R('      filters: [', '      filters: (x => x)([')
i = s.find('      filters: (x => x)([')
j = s.find('\n      ],', i)
s = s[:j] + '\n      ]).map(f => ({ ...f, opts: f.options.map(t => { const on = ["Grundfos", "20–60", "В наличии"].includes(t); return { t, border: on ? "var(--color-accent)" : "var(--color-divider)", fill: on ? "var(--color-accent)" : "transparent" }; }) })),' + s[j + len('\n      ],'):]

# ── Ровные сетки: 4 сценария в ряд, 8 подкатегорий 4×2
R('''emptyActions }}" as="a"''', '''emptyActions }}" as="a"''')  # проверка, что блок на месте
i = s.find('emptyActions }}" as="a"'); k = s.rfind('grid-template-columns:', 0, i)
seg = s[k:s.find(';', k)]
s = s[:k] + 'grid-template-columns:repeat(4,minmax(0,1fr))' + s[k + len(seg):]
R('''<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px">
          <sc-for list="{{ dirSubcats }}"''', '''<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px">
          <sc-for list="{{ dirSubcats }}"''')
R('[style*="grid-template-columns: repeat(4,"],[style*="grid-template-columns: repeat(5,"]',
  '[style*="grid-template-columns: repeat(4,"],[style*="grid-template-columns: repeat(5,"]')
open(P, "w", encoding="utf-8").write(s)
print("пачка 3 применена; сетка сценариев была:", seg)

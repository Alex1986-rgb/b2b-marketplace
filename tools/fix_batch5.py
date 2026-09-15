#!/usr/bin/env python3
"""Доработка 14.09.26, пачка 5: фото и иконки по docs/visual-plan.json (обоснование — visual-plan.md).
Иконки — маски из project/icons.css (<span class="ico i-<id>">), фото — CSS background из project/img.
Каждая замена проверяет число вхождений; при любом несовпадении файл не записывается."""
import json, os, re, sys

ROOT = os.path.join(os.path.dirname(__file__), "..")
P = os.path.join(ROOT, "project", "Промышленный агрегатор.dc.html")
PS = os.path.join(ROOT, "project", "SeoBlock.dc.html")
PLAN = json.load(open(os.path.join(ROOT, "docs", "visual-plan.json"), encoding="utf-8"))
s = open(P, encoding="utf-8").read()
N = 0


def R(old, new, n=1):
    global s, N
    c = s.count(old)
    if c != n:
        sys.exit(f"[{c}≠{n}] {old[:110]!r}")
    s = s.replace(old, new)
    N += 1


def IC(anchor, val, key="icon", n=1):
    """Добавить поле key в объект массива данных: anchor начинается с «{ »."""
    assert anchor.startswith("{ ")
    v = val if key != "icon" else "i-" + val
    R(anchor, "{ " + key + ': "' + v + '", ' + anchor[2:], n)


def ico(i, size=None, color="var(--color-accent-700)", extra=""):
    cls = "ico" + (f" ico-{size}" if size else "") + f" i-{i}"
    st = f"color:{color}" + (";" + extra if extra else "")
    return f'<span class="{cls}" style="{st}"></span>'


A7, A3 = "var(--color-accent-700)", "var(--color-accent-300)"
PROD = lambda n: f"url(img/{n}.jpg) center/contain no-repeat #bfbfc1"
ATM = lambda n: f"url(img/{n}.jpg) center/cover no-repeat"
NOPH = "var(--color-neutral-200)"
FLEX = "display:inline-flex;align-items:center;gap:8px"

# ══ 0. Подключение набора, служебные правила ══════════════════════════════════
R('<link rel="stylesheet" href="_ds/industry-2cf29483-63c2-42c2-a32d-4823edc25b26/styles.css">\n<script src="_ds',
  '<link rel="stylesheet" href="_ds/industry-2cf29483-63c2-42c2-a32d-4823edc25b26/styles.css">\n<link rel="stylesheet" href="icons.css">\n<script src="_ds')
R("""  .cartrow { display:grid;""", """  /* пачка 5: иконки и фото. Иконка без i-* (пустое поле данных) не рисуется. */
  .ico:not([class*=" i-"]) { display:none !important; }
  .only-m { display:none !important; }
  .thumb { display:block; flex:none; background-color:var(--color-neutral-200); }
  .gal { display:flex; gap:10px; margin:0 0 28px; }
  .gal > span { width:80px; height:80px; display:block; border:1px solid var(--color-divider); }
  .gal > span.on { border:2px solid var(--color-accent); }
  .cartrow { display:grid;""")
R("""    .btn { white-space:normal; }
  }""", """    .btn { white-space:normal; }
    .hero-ph { display:none !important; }
    .only-m { display:inline-block !important; }
    .hide-m { display:none !important; }
    .only-m-block { display:block !important; }
    .ph-side { height:200px !important; }
  }""")

# ══ 1. Знак вместо акцентных квадратов ════════════════════════════════════════
MARK = "background:url(img/mark.svg) center/contain no-repeat"
R('<span style="width:22px;height:22px;background:var(--color-accent);display:block"></span>',
  f'<span style="width:22px;height:22px;{MARK};display:block"></span>')
R('<span style="width:18px;height:18px;background:var(--color-accent);display:block"></span>',
  f'<span style="width:18px;height:18px;{MARK};display:block"></span>', 2)   # служебная шапка + подвал
R('<span style="width:20px;height:20px;background:var(--color-accent);display:block"></span>',
  f'<span style="width:20px;height:20px;{MARK};display:block"></span>')      # мобильная шапка снабженца

# ══ 2. Шапка витрины (все витринные экраны) ══════════════════════════════════
R('<span style="display:flex;align-items:center;gap:6px"><span style="width:7px;height:7px;background:var(--color-accent);display:block"></span>Москва</span>',
  '<span style="display:flex;align-items:center;gap:6px">' + ico("delivery-region", 16, A3, "width:14px;height:14px") + 'Москва</span>')
R('<span>Оплата по счёту · отсрочка до 30 дней</span>',
  '<span style="display:flex;align-items:center;gap:6px">' + ico("pay-deferral", 16, A3, "width:14px;height:14px") + 'Оплата по счёту · отсрочка до 30 дней</span>')
R('<a href="#" onClick="{{ goVendor }}" style="margin-left:auto;color:var(--color-neutral-300)">Кабинет поставщика</a>',
  '<a href="#" onClick="{{ goVendor }}" style="margin-left:auto;color:var(--color-neutral-300);display:flex;align-items:center;gap:6px">' + ico("channel-vendor", 16, A3, "width:14px;height:14px") + 'Кабинет поставщика</a>')
R('<a href="#" onClick="{{ goAuthOrAccount }}" style="color:var(--color-neutral-300)">{{ loginLabel }}</a>',
  '<a href="#" onClick="{{ goAuthOrAccount }}" style="color:var(--color-neutral-300);display:flex;align-items:center;gap:6px">' + ico("ui-account", 16, A3, "width:14px;height:14px") + '{{ loginLabel }}</a>')
R('class="btn btn-secondary" style="padding:10px 16px;font-size:15px">Каталог · 45 направлений</button>',
  'class="btn btn-secondary" style="padding:10px 16px;font-size:15px;gap:8px">' + ico("entry-catalog", 16, "currentColor", "width:18px;height:18px") + 'Каталог · 45 направлений</button>')
R('class="btn btn-secondary" style="min-height:44px;white-space:nowrap;border-right:0">По фото</button>',
  'class="btn btn-secondary" style="min-height:44px;white-space:nowrap;border-right:0;gap:8px">' + ico("entry-photo", 16, "currentColor", "width:18px;height:18px") + 'По фото</button>')
R('<button class="btn btn-primary" style="min-height:44px;padding-inline:24px;font-size:15px">Найти</button>',
  '<button class="btn btn-primary" style="min-height:44px;padding-inline:24px;font-size:15px;gap:8px">' + ico("ui-search", 16, "currentColor", "width:18px;height:18px") + '<span class="hide-m">Найти</span></button>')
BADGE = 'position:absolute;top:-5px;left:calc(50% + 5px);min-width:16px;height:16px;padding:0 4px;background:var(--color-accent);color:#fff;font-size:10px;line-height:16px;letter-spacing:0;text-align:center'
HB = 'position:relative;height:24px;display:flex;align-items:center;justify-content:center'
R('<div class="mono" style="font-size:17px;color:var(--color-accent-700)">MAX</div>Чат</a>',
  f'<div style="{HB};color:var(--color-accent-700)">' + ico("entry-chat", 20, "currentColor") + '</div>Чат</a>')
for go, icon, label in [("goQuote", "ui-quote", "Запросы КП"), ("goCompare", "ui-compare", "Сравнение"), ("goCart", "ui-cart", "Корзина")]:
    num = "4" if go == "goCompare" else "3"
    R(f'<a href="#" onClick="{{{{ {go} }}}}" style="text-decoration:none;color:inherit"><div class="mono" style="font-size:17px;color:var(--color-text)">{num}</div>{label}</a>',
      f'<a href="#" onClick="{{{{ {go} }}}}" style="text-decoration:none;color:inherit"><div style="{HB};color:var(--color-text)">'
      + ico(icon, None, "currentColor", "width:22px;height:22px") + f'<span class="mono" style="{BADGE}">{num}</span></div>{label}</a>')

# ══ 3. Служебная шапка оператора: иконки навигации ════════════════════════════
R('staffNav: (isVend ? navVend : navOps).map(([t, id]) => ({ t, go: this.go(id),\n            style: "font-size:13px;padding:6px 10px;text-decoration:none;"',
  'staffNav: (isVend ? navVend : navOps).map(([t, id]) => ({ t, go: this.go(id),\n            icon: ({ crm: "i-op-crm", client: "i-op-client", autopilot: "i-op-autopilot", voice: "i-op-voice", logistics: "i-op-logistics", incident: "i-op-errors", unit: "i-op-economy", roles: "i-op-roles", admin: "i-op-admin" })[id] || "",\n            style: "display:inline-flex;align-items:center;gap:6px;font-size:13px;padding:6px 10px;text-decoration:none;"')
R('<a href="#" onClick="{{ n.go }}" style="{{ n.style }}">{{ n.t }}</a>',
  '<a href="#" onClick="{{ n.go }}" style="{{ n.style }}"><span class="ico ico-16 {{ n.icon }}" style="color:var(--color-accent-300)"></span>{{ n.t }}</a>')

# ══ 4. Главная ════════════════════════════════════════════════════════════════
R('''    <section style="background:var(--color-accent-900);color:var(--color-neutral-100);border-bottom:1px solid var(--color-divider)">
      <div style="max-width:1360px;margin:0 auto;padding:44px 28px 40px">''',
  '''    <section style="background:var(--color-accent-900);color:var(--color-neutral-100);border-bottom:1px solid var(--color-divider);position:relative;overflow:hidden">
      <div class="duotone hero-ph" style="position:absolute;top:0;right:0;bottom:0;width:40%;background:url(img/hero-pump-hall.jpg) center/cover no-repeat" data-photo="1"></div>
      <div class="hero-ph" style="position:absolute;top:0;right:0;bottom:0;width:40%;background:linear-gradient(90deg, var(--color-accent-900) 0%, rgba(29,45,61,0.72) 38%, rgba(29,45,61,0.08) 100%)"></div>
      <div style="max-width:1360px;margin:0 auto;padding:44px 28px 40px;position:relative">''')
R('class="btn btn-secondary" style="min-height:54px;background:#fff;border-right:0;white-space:nowrap">По фото шильдика</button>',
  'class="btn btn-secondary" style="min-height:54px;background:#fff;border-right:0;white-space:nowrap;gap:8px">' + ico("entry-photo", 16, "currentColor", "width:18px;height:18px") + 'По фото шильдика</button>')
R('<button class="btn btn-primary" style="min-height:54px;padding-inline:30px;font-size:16px;color:#fff">Найти</button>',
  '<button class="btn btn-primary" style="min-height:54px;padding-inline:30px;font-size:16px;color:#fff;gap:8px">' + ico("ui-search", 16, "currentColor", "width:18px;height:18px") + '<span class="hide-m">Найти</span></button>')
# рубрикатор
R('<div class="mono" style="font-size:10px;text-transform:uppercase;color:var(--color-accent-700);padding:10px 16px 4px;border-top:1px solid var(--color-divider)">{{ g.title }}</div>',
  '<div class="mono" style="font-size:10px;text-transform:uppercase;color:var(--color-accent-700);padding:10px 16px 4px;border-top:1px solid var(--color-divider);display:flex;align-items:center;gap:8px"><span class="ico ico-16 {{ g.icon }}"></span>{{ g.title }}</div>')
R('''                <span>{{ c.name }}</span>
                <span class="mono" style="font-size:10px;color:var(--color-neutral-600)">{{ c.count }}</span>''',
  '''                <span style="display:flex;align-items:center;gap:8px"><span class="ico ico-16 {{ c.icon }}" style="color:var(--color-accent-700)"></span>{{ c.name }}</span>
                <span class="mono" style="font-size:10px;color:var(--color-neutral-600);white-space:nowrap">{{ c.count }}</span>''')
# шаги
R('''            <div class="card blueprint" style="padding:18px 20px">
              <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
              <span class="card-kicker">{{ s.n }}</span>''',
  '''            <div class="card blueprint" style="padding:18px 20px">
              <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
              <span class="ico {{ s.icon }}" style="color:var(--color-accent-700)"></span>
              <span class="card-kicker">{{ s.n }}</span>''')
for n, i in [("01", "step-request"), ("02", "step-supplier-pick"), ("03", "step-one-price"), ("04", "step-direct-ship")]:
    IC('{ n: "%s", title:' % n, i)
R('<h3 style="margin:0">Одна цена вместо десятков продавцов</h3>',
  '<h3 style="margin:0;display:flex;align-items:center;gap:10px">' + ico("step-one-price", 28) + 'Одна цена вместо десятков продавцов</h3>')
# «Часто заказывают» — миниатюра 48×48
R('<thead><tr><th>Артикул</th><th>Наименование</th><th>Наличие</th>',
  '<thead><tr><th>Артикул</th><th style="width:48px"></th><th>Наименование</th><th>Наличие</th>')
R('''                    <td class="mono" style="font-size:12px;color:var(--color-neutral-700)">{{ p.sku }}</td>
                    <td style="font-weight:500">{{ p.name }}''',
  '''                    <td class="mono" style="font-size:12px;color:var(--color-neutral-700)">{{ p.sku }}</td>
                    <td><span class="thumb" style="width:48px;height:48px;background: {{ p.bgc }}"></span></td>
                    <td style="font-weight:500">{{ p.name }}''')

# ══ 5. Направления: кластеры и 45 разделов ════════════════════════════════════
CL = [("01", "Привод", "cluster-electric", "a-vfd"), ("02", "Перекачка", "cluster-pumping", "dir-pumps"), ("03", "Воздух", "cluster-air", "a-compressor"),
      ("04", "Механика", "cluster-mechanics", "cl-mechanics"), ("05", "Производство", "cluster-production", "cl-production"), ("06", "Логистика", "cluster-logistics", "cl-logistics")]
for n, w, i, ph in CL:
    R(f'n: "{n}", title: "{w}', f'icon: "i-{i}", photo: "{ATM(ph)}", n: "{n}", title: "{w}')
R('''          <div style="display:flex;align-items:baseline;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:12px">
            <div style="display:flex;align-items:baseline;gap:12px">
              <span class="mono" style="font-size:12px;color:var(--color-accent-700)">{{ g.n }}</span>
              <h2 style="font-size:24px;margin:0">{{ g.title }}</h2>
            </div>
            <span style="font-size:13px;color:var(--color-neutral-700)">{{ g.audience }}</span>
          </div>''',
  '''          <div style="display:grid;grid-template-columns:220px minmax(0,1fr);gap:0;margin-bottom:14px;border:1px solid var(--color-divider)">
            <div class="duotone" style="background: {{ g.photo }};min-height:112px" data-photo="1"></div>
            <div style="padding:14px 18px;display:flex;flex-direction:column;justify-content:center;gap:6px">
              <div style="display:flex;align-items:center;gap:12px">
                <span class="ico ico-28 {{ g.icon }}" style="color:var(--color-accent-700)"></span>
                <span class="mono" style="font-size:12px;color:var(--color-accent-700)">{{ g.n }}</span>
                <h2 style="font-size:24px;margin:0">{{ g.title }}</h2>
              </div>
              <span style="font-size:13px;color:var(--color-neutral-700)">{{ g.audience }}</span>
            </div>
          </div>''')
R('''                <div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline">
                  <span style="font-family:var(--font-heading);font-weight:600;font-size:18px;line-height:1.2">{{ d.name }}</span>''',
  '''                <div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
                  <span style="display:flex;align-items:center;gap:10px"><span class="ico {{ d.icon }}" style="color:var(--color-accent-700)"></span><span style="font-family:var(--font-heading);font-weight:600;font-size:18px;line-height:1.2">{{ d.name }}</span></span>''')
dirs = 0
for ic in PLAN["icons"]:
    if not ic["id"].startswith("dir-"):
        continue
    names = set(m for pl in ic["placements"] if pl["screen"] == "Направления" for m in re.findall(r"name «(.+?)»", pl["where"]))
    for nm in names:
        IC('{ name: "%s", sub:' % nm, ic["id"])
        dirs += 1
if dirs != 45:
    sys.exit(f"разделов с иконкой {dirs}, ждали 45")

# ══ 6. Направление «Насосы» ═══════════════════════════════════════════════════
R('<h1 style="font-size:40px;margin:0 0 10px">Насосы для промышленности и ЖКХ</h1>',
  '<h1 style="font-size:40px;margin:0 0 10px;display:flex;align-items:center;gap:14px">' + ico("dir-pumps", 32) + 'Насосы для промышленности и ЖКХ</h1>')

# ══ 7. Каталог ════════════════════════════════════════════════════════════════
R('<span class="mono" style="position:absolute;top:10px;left:10px;font-size:11px;background:var(--color-bg);padding:4px 8px">{{ p.stock }}</span>',
  '<span class="mono" style="position:absolute;top:10px;left:10px;font-size:11px;background:var(--color-bg);padding:4px 8px;display:flex;align-items:center;gap:5px">' + ico("order-shipped", None, A7, "width:12px;height:12px") + '{{ p.stock }}</span>')
R('<button onClick="{{ p.open }}" class="btn btn-primary" style="white-space:nowrap;padding:10px 14px">{{ p.cta }}</button>',
  '<button onClick="{{ p.open }}" class="btn btn-primary" style="white-space:nowrap;padding:10px 14px;gap:6px"><span class="ico ico-16 i-ui-cart only-m"></span>{{ p.cta }}</button>')

# ══ 8. Товар: фото без тонировки, мини-галерея, строки блока покупки ═══════════
R('''        <figure class="blueprint duotone ph" style="background:url(img/p-cr32.jpg) center/contain no-repeat #c2c2c4;height:380px;display:flex;align-items:flex-end;padding:16px;margin-bottom:28px" data-photo="1">
          <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
        </figure>''',
  f'''        <figure class="blueprint ph" style="background:{PROD('p-cr32')};height:380px;display:flex;align-items:flex-end;padding:16px;margin-bottom:12px" data-photo="1">
          <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
        </figure>
        <div class="gal" role="list" aria-label="Фото товара">
          <span class="on" role="listitem" style="background:{PROD('p-cr32')}"></span>
          <span role="listitem" style="background:{PROD('p-cr32-flange')}"></span>
          <span role="listitem" style="background:{PROD('p-cr32-motor')}"></span>
        </div>''')
R('<span>Гарантия 24 мес. (условия поставщика)</span>',
  '<span style="display:inline-flex;align-items:center;gap:6px">' + ico("warranty-maker", 16, A7, "width:14px;height:14px") + 'Гарантия 24 мес. (условия поставщика)</span>')
for lab, i in [("Наличие", "order-shipped"), ("Отгрузка", "step-direct-ship"), ("Оплата", "pay-card")]:
    R(f'<span class="text-muted">{lab}</span>', f'<span class="text-muted" style="{FLEX}">' + ico(i, 16) + f'{lab}</span>')
R('<span class="card-kicker">Нужен аналог дешевле?</span>',
  '<span class="card-kicker" style="display:flex;align-items:center;gap:8px">' + ico("engineer", 20) + 'Нужен аналог дешевле?</span>')
R('<span class="tag tag-outline" style="font-size:11px">{{ r.verified }}</span>',
  '<span class="tag tag-outline" style="font-size:11px;gap:5px">' + ico("doc-certificates", None, A7, "width:12px;height:12px") + '{{ r.verified }}</span>')

# ══ 9. Запрос КП ══════════════════════════════════════════════════════════════
R('<span class="card-title">{{ q.t }}</span>',
  '<span class="card-title" style="display:flex;align-items:center;gap:10px"><span class="ico {{ q.icon }}" style="color:var(--color-accent-700)"></span>{{ q.t }}</span>')
for t, i in [("Инженерный подбор", "quote-engineering"), ("Расчёт доставки", "step-direct-ship"), ("Монтаж и ПНР", "quote-install"), ("Условия оплаты", "order-paid")]:
    IC('{ t: "%s", d:' % t, i)

# ══ 10. Поиск по фото ═════════════════════════════════════════════════════════
R('<span style="width:46px;height:46px;border:1.5px solid var(--color-accent);display:block"></span>',
  '<span style="width:160px;height:110px;display:block;background:url(img/nameplate.jpg) center/cover no-repeat;border:1px solid var(--color-divider)" role="img" aria-label="Пример снимка шильдика" data-photo="1"></span>')
R('<button class="btn btn-secondary" style="padding:11px 18px">Снять камерой</button>',
  '<button class="btn btn-secondary" style="padding:11px 18px;gap:8px">' + ico("entry-photo", 16, "currentColor", "width:18px;height:18px") + 'Снять камерой</button>')
R('<div class="ph duotone" style="background:url(img/p-cr32.jpg) center/cover no-repeat;border-right:1px solid var(--color-divider)" data-photo="1"></div>',
  f'<div class="ph" style="background:{PROD("p-cr32")};border-right:1px solid var(--color-divider)" data-photo="1"></div>')
R('<div class="mono" style="font-size:11px;text-transform:uppercase;color:var(--color-neutral-600);margin-top:4px">Аналоги</div>',
  '<div class="mono" style="font-size:11px;text-transform:uppercase;color:var(--color-neutral-600);margin-top:4px;display:flex;align-items:center;gap:6px">' + ico("analog", 16) + 'Аналоги</div>')

# ══ 11. Поставщику ════════════════════════════════════════════════════════════
R('''    <section style="background:var(--color-accent-900);color:var(--color-neutral-100)">
      <div class="hero2" style="max-width:1360px;margin:0 auto;padding:52px 28px 46px;''',
  '''    <section style="background:var(--color-accent-900);color:var(--color-neutral-100);position:relative;overflow:hidden">
      <div class="duotone hero-ph" style="position:absolute;inset:0;background:url(img/supplier-dock.jpg) center/cover no-repeat" data-photo="1"></div>
      <div class="hero-ph" style="position:absolute;inset:0;background:linear-gradient(90deg, rgba(29,45,61,0.9) 0%, rgba(29,45,61,0.8) 55%, rgba(29,45,61,0.7) 100%)"></div>
      <div class="hero2" style="position:relative;max-width:1360px;margin:0 auto;padding:52px 28px 46px;''')
for chip, i in [("XML / YML", "tier-sync"), ("REST API", "tier-api"), ("Excel / CSV", "tier-file"), ("Обмен с 1С", "tier-api")]:
    R(f'<span class="mono" style="font-size:13px;padding:7px 12px;border:1px solid var(--color-accent-700)">{chip}</span>',
      '<span class="mono" style="font-size:13px;padding:7px 12px;border:1px solid var(--color-accent-700);display:inline-flex;align-items:center;gap:7px">' + ico(i, None, A3, "width:14px;height:14px") + f'{chip}</span>')
R('''      </div>
    </section>

    <section style="max-width:1360px;margin:0 auto;padding:44px 28px 56px">
      <h2 style="margin-bottom:18px">Как устроена работа</h2>''',
  '''      </div>
    </section>
    <div class="duotone only-m-block" style="display:none;height:160px;background:url(img/warehouse.jpg) center/cover no-repeat" data-photo="1"></div>

    <section style="max-width:1360px;margin:0 auto;padding:44px 28px 56px">
      <h2 style="margin-bottom:18px">Как устроена работа</h2>''')
R('''        <sc-for list="{{ supplierSteps }}" as="s" hint-placeholder-count="4">
          <div class="card blueprint" style="padding:20px">
            <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>''',
  '''        <sc-for list="{{ supplierSteps }}" as="s" hint-placeholder-count="4">
          <div class="card blueprint" style="padding:20px">
            <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
            <span class="ico {{ s.icon }}" style="color:var(--color-accent-700)"></span>''')
for n, t, i in [("01", "Договор и доступ", "step-deal"), ("02", "Выгрузка прайса", "price-upload"), ("03", "Заказы", "orders-inbox"), ("04", "Отгрузка и расчёты", "payout")]:
    IC('{ n: "%s", t: "%s"' % (n, t), i)
R('''            <div class="mono" style="font-size:32px;line-height:1.1">{{ s.v }}</div>''',
  '''            <div class="mono" style="font-size:32px;line-height:1.1;display:flex;align-items:center;gap:10px"><span class="ico ico-28 {{ s.icon }}" style="color:var(--color-accent-700)"></span>{{ s.v }}</div>''')
IC('{ v: "3–7 дней", k: "расчёт после отгрузки" }', "payout")

# ══ 12. Кабинет покупателя ════════════════════════════════════════════════════
R('''        <div style="padding:10px 16px 12px;border-bottom:1px solid var(--color-divider)">
          <div style="font-family:var(--font-heading);font-weight:600;font-size:17px">ООО «Метизный завод»</div>
          <div class="mono" style="font-size:11px;color:var(--color-neutral-600)">ИНН 7105012345</div>''',
  '''        <div style="padding:10px 16px 12px;border-bottom:1px solid var(--color-divider)">
          <div style="font-family:var(--font-heading);font-weight:600;font-size:17px;display:flex;align-items:center;gap:8px">''' + ico("ui-account", 20) + '''ООО «Метизный завод»</div>
          <div class="mono" style="font-size:11px;color:var(--color-neutral-600)">ИНН 7105012345</div>''')
NAVT = '<span>{{ n.t }}</span><span class="mono" style="font-size:11px;color:var(--color-neutral-600)">{{ n.c }}</span>'
R(NAVT, '<span style="display:flex;align-items:center;gap:9px"><span class="ico ico-16 {{ n.icon }}" style="color:var(--color-accent-700)"></span>{{ n.t }}</span><span class="mono" style="font-size:11px;color:var(--color-neutral-600)">{{ n.c }}</span>', 3)
for t, c, i in [("Заказы", "12", "ui-orders"), ("Согласование", "4", "ui-approval"), ("Регулярные закупки", "5", "ui-repeat"), ("Запросы КП", "3", "ui-quote"),
                ("Счета и УПД", "24", "pay-invoice"), ("Спецификации", "6", "ui-specs"), ("Сотрудники", "4", "ui-users"), ("Реквизиты", "", "ui-requisites"),
                ("Заявки", "1", "orders-inbox"), ("Прайс и остатки", "12 480", "vendor-price"), ("Отгрузки", "4", "vendor-shipments"),
                ("Расчёты", "2", "payout"), ("Направления", "4", "vendor-directions"), ("Договор и реквизиты", "", "ui-requisites")]:
    IC('{ t: "%s", c: "%s" }' % (t, c), i)
R('<button class="btn btn-secondary">Выгрузить реестр</button>',
  '<button class="btn btn-secondary" style="gap:8px">' + ico("ui-download", 16, "currentColor", "width:18px;height:18px") + 'Выгрузить реестр</button>')
R('<button onClick="{{ goCart }}" class="btn btn-primary" style="font-size:13px">Повторить</button>',
  '<button onClick="{{ goCart }}" class="btn btn-primary" style="font-size:13px;gap:6px">' + ico("ui-repeat", 16, "currentColor") + 'Повторить</button>')
R('''<h3 style="margin:0">Согласование заявок</h3>''',
  '''<h3 style="margin:0;display:flex;align-items:center;gap:10px">''' + ico("ui-approval", 24) + '''Согласование заявок</h3>''')
TD_THUMB = lambda v: f'''<td style="font-size:14px;font-weight:500"><div style="display:flex;align-items:center;gap:10px"><span class="thumb" style="width:40px;height:40px;background: {{{{ {v}.bg }}}}"></span><div>{{{{ {v}.name }}}}'''
R('<td style="font-size:14px;font-weight:500">{{ r.name }}<div class="mono" style="font-size:11px;color:var(--color-neutral-600);font-weight:400">{{ r.sku }}</div></td>',
  TD_THUMB("r") + '<div class="mono" style="font-size:11px;color:var(--color-neutral-600);font-weight:400">{{ r.sku }}</div></div></div></td>')
R('<td style="font-size:14px;font-weight:500">{{ a.name }}<div class="mono" style="font-size:11px;color:var(--color-neutral-600);font-weight:400">{{ a.sku }} · {{ a.price }}</div></td>',
  TD_THUMB("a") + '<div class="mono" style="font-size:11px;color:var(--color-neutral-600);font-weight:400">{{ a.sku }} · {{ a.price }}</div></div></div></td>')
for anchor, ph in [('{ name: "Подшипник SKF 6205-2RS", sku: "SKF-6205", times: "9", period: "раз в 3–4 недели", last: "9 сентября", price:', "p-6205"),
                   ('{ name: "Манжета 45×65×10 NBR", sku: "MNZ-456510", times: "7", period: "раз в месяц", last: "13 сентября", price:', None),
                   ('{ name: "Grundfos CR 32-4", sku: "96122802", times: "4", period: "раз в квартал", last: "12 сентября", price:', "p-cr32"),
                   ('{ name: "INNOVERT VR 15 кВт", sku: "INV-VR-15", times: "3", period: "раз в 2 месяца", last: "2 сентября", price:', "p-vr15"),
                   ('{ name: "Мотор-редуктор NORD SK 02", sku: "NRD-SK02", times: "2", period: "по ремонту", last: "28 августа", price:', None),
                   ('{ name: "Подшипник SKF 6205-2RS", sku: "SKF-6205", price: "540 ₽"', "p-6205"),
                   ('{ name: "Манжета 45×65×10 NBR", sku: "MNZ-456510", price:', None),
                   ('{ name: "Grundfos CR 32-4", sku: "96122802", price: "104 900 ₽", period:', "p-cr32"),
                   ('{ name: "Фильтр-элемент воздушный 2 мкм"', None),
                   ('{ name: "Комплект прокладок DN65", sku: "PRK-65-SET", price:', None)]:
    IC(anchor, PROD(ph) if ph else NOPH, "bg")

# ══ 13. Корзина ═══════════════════════════════════════════════════════════════
R('<div class="ph duotone" style="background:{{ c.bg }};height:76px" data-photo="1"></div>',
  '<div class="ph" style="background:{{ c.bg }};height:76px" data-photo="1"></div>')
for n in ["p-cr32", "p-6205", "p-vr15"]:
    R('{ bg: "url(img/%s.jpg) center/cover no-repeat", sku:' % n, '{ bg: "%s", sku:' % PROD(n), 2 if n == "p-cr32" else 1)
# ↑ p-cr32 встречается в корзине и в мобильном каталоге
for lab, i in [("Счёт для юрлица", "pay-invoice"), ("Карта", "pay-card"), ("Отсрочка 30 дней", "pay-deferral")]:
    R(f'<span class="dot"></span>{lab}</label>', f'<span class="dot"></span><span style="{FLEX}">' + ico(i, 16) + f'{lab}</span></label>')

# ══ 14. Умный чат ═════════════════════════════════════════════════════════════
R('<button class="btn btn-secondary">Загрузить заявку XLSX</button>',
  '<button class="btn btn-secondary" style="gap:8px">' + ico("entry-list", 16, "currentColor", "width:18px;height:18px") + 'Загрузить заявку XLSX</button>')
R('<button onClick="{{ goPhoto }}" class="btn btn-secondary">Фото шильдика</button>',
  '<button onClick="{{ goPhoto }}" class="btn btn-secondary" style="gap:8px">' + ico("entry-photo", 16, "currentColor", "width:18px;height:18px") + 'Фото шильдика</button>')
R('<button class="btn btn-primary">Чат в MAX</button>',
  '<button class="btn btn-primary" style="gap:8px">' + ico("channel-max", 16, "currentColor", "width:18px;height:18px") + 'Чат в MAX</button>')
R('<button class="btn btn-secondary">Выгрузить в XLSX</button>',
  '<button class="btn btn-secondary" style="gap:8px">' + ico("ui-download", 16, "currentColor", "width:18px;height:18px") + 'Выгрузить в XLSX</button>', 2)  # чат + сравнение
R('<h3 style="margin:0 0 4px">Продолжить в мессенджере MAX</h3>',
  '<h3 style="margin:0 0 4px;display:flex;align-items:center;gap:10px">' + ico("channel-max", 24) + 'Продолжить в мессенджере MAX</h3>')
R('''                        <div style="display:flex;justify-content:space-between;gap:12px;border-top:1px solid var(--color-divider);padding-top:6px;font-size:14px">
                          <span>{{ r.name }}</span>''',
  '''                        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;border-top:1px solid var(--color-divider);padding-top:6px;font-size:14px">
                          <span style="display:flex;align-items:center;gap:10px"><span class="thumb" style="width:44px;height:44px;background: {{ r.bg }}"></span>{{ r.name }}</span>''')
for nm in ["CNP CDLF 42-30 · 40", "Wilo Helix V 4204 · 42", "Grundfos CR 45-3 · 45"]:
    IC('{ name: "%s' % nm, PROD("p-cr32"), "bg")
R('''                <div style="display:flex;gap:10px;align-items:flex-start">
                  <span style="width:7px;height:7px;background:var(--color-accent);display:block;flex:none;margin-top:7px"></span>''',
  '''                <div style="display:flex;gap:10px;align-items:flex-start">
                  <span style="width:7px;height:7px;background:var(--color-accent);flex:none;margin-top:7px;display: {{ s.dot }}"></span>
                  <span class="ico ico-20 {{ s.icon }}" style="color:var(--color-accent-700);margin-top:1px"></span>''')
for t, i in [("Уточняет параметры", None), ("Читает заявку списком", "entry-list"), ("Проверяет остатки в реальном времени", None),
             ("Предлагает аналоги", "analog"), ("Собирает спецификацию и счёт", None), ("Передаёт инженеру", "engineer")]:
    IC('{ t: "%s", d:' % t, "none" if i else "block", "dot")
    if i:
        IC('{ dot: "none", t: "%s", d:' % t, i)

# ══ 15. Логистика, Ошибки, Автопилот, Разбор заявки ═══════════════════════════
R('<td style="font-size:14px;font-weight:500">{{ o.name }}</td>',
  '<td style="font-size:14px;font-weight:500"><span style="display:flex;align-items:center;gap:8px"><span class="ico ico-16 {{ o.icon }}" style="color:var(--color-accent-700)"></span>{{ o.name }}</span></td>')
for nm, i in [("Сборный груз", "log-consolidated"), ("Прямые отгрузки", "log-direct"), ("Срочная доставка", "log-urgent"), ("Самовывоз с терминала", "log-pickup")]:
    IC('{ name: "%s", scheme:' % nm, i)
WARN = ico("state-warning", 16)
R('<td style="font-size:14px;font-weight:500">{{ i.err }}</td>',
  f'<td style="font-size:14px;font-weight:500"><span style="display:flex;align-items:flex-start;gap:8px">{WARN}<span>{{{{ i.err }}}}</span></span></td>')
R('<div style="font-size:12px;color:var(--color-neutral-700)">{{ q.why }}</div>',
  '<div style="font-size:12px;color:var(--color-neutral-700);display:flex;align-items:center;gap:6px">' + ico("state-warning", None, A7, "width:14px;height:14px") + '{{ q.why }}</div>')
R('<div style="font-size:14px;font-weight:500">{{ i.row }}</div>',
  f'<div style="font-size:14px;font-weight:500;display:flex;align-items:center;gap:8px">{WARN}{{{{ i.row }}}}</div>')
R('<button class="btn btn-secondary">Загрузить другой файл</button>',
  '<button class="btn btn-secondary" style="gap:8px">' + ico("entry-list", 16, "currentColor") + 'Загрузить другой файл</button>')

# ══ 16. Условия поставщикам ═══════════════════════════════════════════════════
R('''            <span class="mono" style="font-size:11px;text-transform:uppercase;color:var(--color-accent-700)">{{ t.kicker }}</span>''',
  '''            <span class="ico ico-28 {{ t.icon }}" style="color:var(--color-accent-700)"></span>
            <span class="mono" style="font-size:11px;text-transform:uppercase;color:var(--color-accent-700)">{{ t.kicker }}</span>''')
for k, i in [("Прайс файлом", "tier-file"), ("Автоматический обмен", "tier-sync"), ("Глубокая интеграция", "tier-api")]:
    IC('{ kicker: "%s", name:' % k, i)
R('<h3 style="margin:0 0 4px">Как система выбирает поставщика</h3>',
  '<h3 style="margin:0 0 4px;display:flex;align-items:center;gap:10px">' + ico("step-supplier-pick", 24) + 'Как система выбирает поставщика</h3>')
R('<h3 style="margin:0 0 10px">Что требуется от поставщика</h3>',
  '<h3 style="margin:0 0 10px">Что требуется от поставщика</h3>\n          <div class="duotone" style="height:160px;margin:0 0 14px;background:url(img/supplier-stock-count.jpg) center/cover no-repeat" data-photo="1"></div>')

# ══ 17. Права и роли ══════════════════════════════════════════════════════════
for role in ["Админ", "Оператор", "Инженер", "Контент", "Бухгалтер"]:
    R(f'<th style="text-align:center">{role}</th>',
      f'<th style="text-align:center"><span style="{FLEX};gap:6px">' + ico("ui-users", 16) + f'{role}</span></th>')

# ══ 18. Первый визит ══════════════════════════════════════════════════════════
R('''          <div class="mono" style="font-size:11px;text-transform:uppercase;color:var(--color-neutral-600);margin-bottom:8px">03 · Первое сообщение в чате</div>
          <div class="blueprint" style="padding:16px 18px">
            <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>''',
  '''          <div class="mono" style="font-size:11px;text-transform:uppercase;color:var(--color-neutral-600);margin-bottom:8px;display:flex;align-items:center;gap:8px">''' + ico("entry-chat", 20) + '''03 · Первое сообщение в чате</div>
          <div class="blueprint" style="padding:16px 18px">
            <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
            <div class="duotone" style="height:100px;margin:-16px -18px 12px;background:url(img/nameplate-phone.jpg) center/cover no-repeat" data-photo="1"></div>''')

# ══ 19. Голосовой робот, CRM, Карточка клиента, Админка ═══════════════════════
R('<h1 style="font-size:34px;margin:2px 0 0">Голосовой робот</h1>',
  '<h1 style="font-size:34px;margin:2px 0 0;display:flex;align-items:center;gap:12px">' + ico("channel-phone", 32) + 'Голосовой робот</h1>')
R('<h3 style="margin:0">Расшифровка входящего · 09:12, 1 мин 32 с</h3>',
  '<h3 style="margin:0;display:flex;align-items:center;gap:8px">' + ico("channel-phone", 20) + 'Расшифровка входящего · 09:12, 1 мин 32 с</h3>')
R('<span class="mono" style="font-size:10px;text-transform:uppercase;color:var(--color-accent-700)">{{ d.channel }}</span>',
  '<span class="mono" style="font-size:10px;text-transform:uppercase;color:var(--color-accent-700);display:flex;align-items:center;gap:5px"><span class="ico {{ d.chIcon }}" style="width:12px;height:12px"></span>{{ d.channel }}</span>')
R('<span class="tag {{ d.tagClass }}" style="font-size:11px">{{ d.owner }}</span>',
  '<span class="tag {{ d.tagClass }}" style="font-size:11px;gap:4px"><span class="ico {{ d.botIcon }}" style="width:12px;height:12px"></span>{{ d.owner }}</span>')
R('''        ] }
      ],
      crmTimeline: [''',
  '''        ] }
      ].map(col => ({ ...col, deals: col.deals.map(d => ({ ...d,
        chIcon: ({ "MAX": "i-channel-max", "Почта": "i-channel-mail", "Сайт": "i-channel-web", "Телефон": "i-channel-phone" })[d.channel] || "",
        botIcon: d.owner === "робот" ? "i-op-autopilot" : "" })) })),
      crmTimeline: [''')
R('<button onClick="{{ goAutopilot }}" class="btn btn-secondary">Автопилот</button>',
  '<button onClick="{{ goAutopilot }}" class="btn btn-secondary" style="gap:8px">' + ico("op-autopilot", 16, "currentColor", "width:18px;height:18px") + 'Автопилот</button>', 2)
R('<h1 style="font-size:32px;margin:2px 0 0">ООО «Метизный завод»</h1>',
  '<h1 style="font-size:32px;margin:2px 0 0;display:flex;align-items:center;gap:12px">' + ico("op-client", None) + 'ООО «Метизный завод»</h1>')
R('<td style="font-weight:500;font-size:14px">{{ c.name }}</td>',
  '<td style="font-weight:500;font-size:14px"><span style="display:flex;align-items:center;gap:8px"><span class="ico ico-16 {{ c.icon }}" style="color:var(--color-accent-700)"></span>{{ c.name }}</span></td>')
for nm, i in [("Мессенджер MAX", "channel-max"), ("Чат на сайте", "channel-web"), ("Почта снабжения", "channel-mail"), ("Телефония", "channel-phone"), ("Кабинет поставщика", "channel-vendor")]:
    IC('{ name: "%s", id:' % nm, i)
R('<button onClick="{{ s.go }}" style="{{ s.style }}">{{ s.t }}</button>',
  '<button onClick="{{ s.go }}" style="{{ s.style }}"><span class="ico ico-16 i-op-admin"></span>{{ s.t }}</button>')
R('style: "font-family:var(--font-heading);font-weight:600;font-size:14px;cursor:pointer;padding:7px 14px;border:1px solid " +\n          ((this.state.adminTab',
  'style: "display:inline-flex;align-items:center;gap:8px;font-family:var(--font-heading);font-weight:600;font-size:14px;cursor:pointer;padding:7px 14px;border:1px solid " +\n          ((this.state.adminTab')

# ══ 20. Уведомления, Состояния ════════════════════════════════════════════════
R('<h1 style="font-size:30px;margin:0 0 4px">Уведомления</h1>',
  '<h1 style="font-size:30px;margin:0 0 4px;display:flex;align-items:center;gap:12px">' + ico("ui-notify", 28) + 'Уведомления</h1>')
for col, i in [("MAX", "channel-max"), ("Почта", "channel-mail"), ("SMS", "channel-sms")]:
    R(f'<th style="text-align:center">{col}</th>', f'<th style="text-align:center"><span style="{FLEX};gap:6px">' + ico(i, 16) + f'{col}</span></th>')
R('<span style="width:40px;height:40px;display:block;align-self: {{ s.iconAlign }};background: {{ s.iconColor }};-webkit-mask: {{ s.icon }};mask: {{ s.icon }}"></span>',
  '<span class="ico ico-40 {{ s.icon }}" style="align-self: {{ s.iconAlign }};color: {{ s.iconColor }}"></span>')
old_icons = re.findall(r'icon: "url\(\\"data:image/svg\+xml,[^"]*?\\"\) center/contain no-repeat"', s)
if len(old_icons) != 6:
    sys.exit(f"иконок состояний {len(old_icons)}, ждали 6")
for old, i in zip(old_icons, ["ui-cart", "ui-history", "state-sync-error", "state-deferral-denied", "state-offline", "state-discontinued"]):
    R(old, f'icon: "i-{i}"')

# ══ 21. Гарантия ══════════════════════════════════════════════════════════════
R('''      <h1 style="font-size:36px;margin:0 0 8px">Гарантия, возврат и рекламации</h1>
      <p style="font-size:17px;line-height:1.55;color:var(--color-neutral-800);margin:0 0 24px;max-width:760px">Гарантию даёт производитель''',
  '''      <div style="display:grid;grid-template-columns:minmax(0,1fr) 420px;gap:32px;align-items:start;margin-bottom:24px">
      <div>
      <h1 style="font-size:36px;margin:0 0 8px">Гарантия, возврат и рекламации</h1>
      <p style="font-size:17px;line-height:1.55;color:var(--color-neutral-800);margin:0;max-width:760px">Гарантию даёт производитель''')
R('''документы приходят вместе с грузом и дублируются в кабинете.</p>
''', '''документы приходят вместе с грузом и дублируются в кабинете.</p>
      </div>
      <figure class="blueprint duotone ph ph-side" style="background:url(img/warranty-inspection.jpg) center/cover no-repeat;height:260px;margin:0" data-photo="1">
        <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
      </figure>
      </div>
''')
R('''            <span class="card-kicker">{{ w.kicker }}</span>''',
  '''            <span class="ico ico-28 {{ w.icon }}" style="color:var(--color-accent-700)"></span>
            <span class="card-kicker">{{ w.kicker }}</span>''')
for t, i in [("Гарантия", "warranty-maker"), ("Возврат без причины", "warranty-return"), ("Недостача и бой", "warranty-damage"), ("Что не возвращается", "warranty-excluded")]:
    R('title: "%s", text:' % t, 'icon: "i-%s", title: "%s", text:' % (i, t))
for lab, i, chk in [("Гарантия", "warranty-maker", ' defaultChecked="{{ true }}"'), ("Возврат", "warranty-return", ""), ("Недостача", "warranty-damage", "")]:
    R(f'<input type="radio" name="wty"{chk}>{lab}</label>', f'<input type="radio" name="wty"{chk}><span style="{FLEX};gap:6px">' + ico(i, 16) + f'{lab}</span></label>')
R('<h3 style="margin:0 0 10px">Что не покрывает гарантия</h3>',
  '<h3 style="margin:0 0 10px;display:flex;align-items:center;gap:10px">' + ico("warranty-excluded", 24) + 'Что не покрывает гарантия</h3>')

# ══ 22. Оплата ════════════════════════════════════════════════════════════════
R('''      <h1 style="font-size:36px;margin:0 0 8px">Оплата, доставка и документы</h1>
      <p style="font-size:17px;line-height:1.55;color:var(--color-neutral-800);margin:0 0 24px;max-width:760px">Работаем''',
  '''      <div style="display:grid;grid-template-columns:minmax(0,1fr) 420px;gap:32px;align-items:start;margin-bottom:24px">
      <div>
      <h1 style="font-size:36px;margin:0 0 8px">Оплата, доставка и документы</h1>
      <p style="font-size:17px;line-height:1.55;color:var(--color-neutral-800);margin:0;max-width:760px">Работаем''')
R('''закрывающие документы приходят в личный кабинет и по ЭДО.</p>
''', '''закрывающие документы приходят в личный кабинет и по ЭДО.</p>
      </div>
      <figure class="blueprint duotone ph ph-side" style="background:url(img/payment-dispatch.jpg) center/cover no-repeat;height:260px;margin:0" data-photo="1">
        <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
      </figure>
      </div>
''')
R('''            <span class="card-kicker">{{ p.kicker }}</span>''',
  '''            <span class="ico ico-28 {{ p.icon }}" style="color:var(--color-accent-700)"></span>
            <span class="card-kicker">{{ p.kicker }}</span>''')
for k, i in [("Основной способ", "pay-invoice"), ("Быстрая покупка", "pay-card"), ("Для постоянных клиентов", "pay-deferral"), ("Проектные поставки", "pay-stages")]:
    IC('{ kicker: "%s", title:' % k, i)
R('<h2 style="font-size:26px;margin:28px 0 12px">Доставка и сроки</h2>',
  '<h2 style="font-size:26px;margin:28px 0 12px;display:flex;align-items:center;gap:10px">' + ico("step-direct-ship", 28) + 'Доставка и сроки</h2>')
R('<th>Направление доставки</th>', f'<th><span style="{FLEX};gap:6px">' + ico("delivery-region", None, A7, "width:14px;height:14px") + 'Направление доставки</span></th>')
R('''                <span>{{ d.t }}</span>
                <span class="mono" style="font-size:12px;color:var(--color-neutral-600);white-space:nowrap">{{ d.when }}</span>''',
  '''                <span style="display:flex;align-items:center;gap:8px"><span class="ico ico-16 {{ d.icon }}" style="color:var(--color-accent-700)"></span>{{ d.t }}</span>
                <span class="mono" style="font-size:12px;color:var(--color-neutral-600);white-space:nowrap">{{ d.when }}</span>''')
R('''{{ orderDocs }}" as="d" hint-placeholder-count="4">
              <div style="display:flex;justify-content:space-between;gap:12px;align-items:baseline;border-top:1px solid var(--color-divider);padding:8px 0">
                <span style="font-size:14px">{{ d.t }}</span>''',
  '''{{ orderDocs }}" as="d" hint-placeholder-count="4">
              <div style="display:flex;justify-content:space-between;gap:12px;align-items:baseline;border-top:1px solid var(--color-divider);padding:8px 0">
                <span style="font-size:14px;display:flex;align-items:center;gap:8px"><span class="ico ico-16 {{ d.icon }}" style="color:var(--color-accent-700)"></span>{{ d.t }}</span>''')
for t, w, i in [("Счёт на оплату", "15 минут", "doc-generic"), ("Договор поставки или счёт-договор", "1 день", "doc-generic"), ("УПД или ТОРГ-12 и счёт-фактура", "при отгрузке", "doc-generic"),
                ("Транспортная накладная", "при отгрузке", "doc-generic"), ("Паспорта, сертификаты, гарантийные талоны", "с грузом и в кабинете", "doc-certificates"),
                ("Счёт на оплату", "12 сентября", "doc-generic"), ("Счёт-договор", "12 сентября", "doc-generic"), ("УПД и счёт-фактура", "15 сентября", "doc-generic"),
                ("Транспортная накладная", "15 сентября", "doc-generic"), ("Паспорта и сертификаты", "с грузом", "doc-certificates")]:
    IC('{ t: "%s", when: "%s" }' % (t, w), i)
R('<h3 style="margin:0 0 10px">Отсрочка платежа</h3>',
  '<h3 style="margin:0 0 10px;display:flex;align-items:center;gap:10px">' + ico("pay-deferral", 24) + 'Отсрочка платежа</h3>')

# ══ 23. Статус заказа ═════════════════════════════════════════════════════════
R('<span style="font-family:var(--font-heading);font-weight:600;font-size:17px;color: {{ s.color }}">{{ s.t }}</span>',
  '<span style="font-family:var(--font-heading);font-weight:600;font-size:17px;color: {{ s.color }};display:flex;align-items:center;gap:8px"><span class="ico ico-20 {{ s.icon }}"></span>{{ s.t }}</span>')
for d, t, i in [("12 сент", "Оформлен", "order-created"), ("12 сент", "Счёт принят · отсрочка", "order-paid"), ("13 сент", "Передан поставщикам", "order-handed"),
                ("15 сент", "Отгружен", "order-shipped"), ("18 сент", "Доставка", "order-delivery")]:
    IC('{ date: "%s", t: "%s"' % (d, t), i)
R('{{ orderItems }}" as="i" hint-placeholder-count="3">\n                <tr>\n                  <td style="font-size:14px;font-weight:500">{{ i.name }}<div class="mono" style="font-size:11px;color:var(--color-neutral-600);font-weight:400">{{ i.sku }}</div></td>',
  '{{ orderItems }}" as="i" hint-placeholder-count="3">\n                <tr>\n                  ' + TD_THUMB("i") + '<div class="mono" style="font-size:11px;color:var(--color-neutral-600);font-weight:400">{{ i.sku }}</div></div></div></td>')
IC('{ name: "Grundfos CR 32-4 A-F-A-E-HQQE", sku: "96122802", qty:', PROD("p-cr32"), "bg")
IC('{ name: "Обратный клапан DN65 PN16", sku: "ARM-OK-65", qty: "2", vendor:', NOPH, "bg")
IC('{ name: "Комплект прокладок DN65", sku: "PRK-65-SET", qty: "1", vendor:', NOPH, "bg")
R('<h3 style="margin:0 0 10px">Документы по заказу</h3>',
  '<h3 style="margin:0 0 10px;display:flex;align-items:center;gap:10px">' + ico("doc-generic", 24) + 'Документы по заказу</h3>')

# ══ 24. Проекты ═══════════════════════════════════════════════════════════════
R('''  <div data-screen-label="Проектные закупки">
    <section style="background:var(--color-accent-900);color:var(--color-neutral-100)">
      <div style="max-width:1360px;margin:0 auto;padding:46px 28px 40px;''',
  '''  <div data-screen-label="Проектные закупки">
    <section style="background:var(--color-accent-900);color:var(--color-neutral-100);position:relative;overflow:hidden">
      <div class="duotone" style="position:absolute;inset:0;background:url(img/project-commissioning.jpg) center/cover no-repeat" data-photo="1"></div>
      <div style="position:absolute;inset:0;background:rgba(29,45,61,0.82)"></div>
      <div style="position:relative;max-width:1360px;margin:0 auto;padding:46px 28px 40px;''')
R('''                <div class="mono" style="font-size:26px;line-height:1.1;color:#fff">{{ s.v }}</div>
                <div style="font-size:13px;color:var(--color-accent-200)">{{ s.k }}</div>
              </div>
            </sc-for>
          </div>
        </div>
        <div class="card" style="background:var(--color-bg);border-color:transparent;padding:22px;color:var(--color-text)">''',
  '''                <div class="mono" style="font-size:26px;line-height:1.1;color:#fff;display:flex;align-items:center;gap:8px"><span class="ico ico-20 {{ s.icon }}" style="color:var(--color-accent-300)"></span>{{ s.v }}</div>
                <div style="font-size:13px;color:var(--color-accent-200)">{{ s.k }}</div>
              </div>
            </sc-for>
          </div>
        </div>
        <div class="card" style="background:var(--color-bg);border-color:transparent;padding:22px;color:var(--color-text)">''')
IC('{ v: "до 45%", k: "аванс по графику проекта" }', "pay-stages")
R('''            <div class="card blueprint" style="padding:20px 22px">
              <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
              <span class="card-kicker">{{ k.kicker }}</span>''',
  '''            <div class="card blueprint" style="padding:20px 22px">
              <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
              <div class="duotone" style="aspect-ratio:16/9;margin:-20px -22px 6px;border-bottom:1px solid var(--color-divider);background: {{ k.photo }}" data-photo="1"></div>
              <span class="card-kicker">{{ k.kicker }}</span>''')
for k, ph in [("Водоснабжение", "dir-pumps"), ("Пневмосеть", "a-compressor"), ("Теплоснабжение", "a-hex"), ("Водоподготовка", "a-water")]:
    IC('{ kicker: "%s", title:' % k, ATM(ph), "photo")
R('<td style="font-size:14px;font-weight:500">{{ p.a }}</td>',
  '<td style="font-size:14px;font-weight:500"><span style="display:flex;align-items:center;gap:8px"><span class="ico ico-16 {{ p.icon }}" style="color:var(--color-accent-700)"></span>{{ p.a }}</span></td>')
for a, i in [("01 · Запрос", "step-request"), ("02 · Инженерный подбор", "quote-engineering"), ("05 · Монтаж и ПНР", "quote-install")]:
    IC('{ a: "%s", b:' % a, i)
R('<h3 style="margin:0 0 10px">Документы для тендера</h3>',
  '<h3 style="margin:0 0 10px;display:flex;align-items:center;gap:10px">' + ico("doc-generic", 24) + 'Документы для тендера</h3>')

# ══ 25. Производитель ═════════════════════════════════════════════════════════
R('onClick="{{ goCompare }}" class="btn btn-secondary" style="padding:12px 20px">Сравнить серии</button>',
  'onClick="{{ goCompare }}" class="btn btn-secondary" style="padding:12px 20px;gap:8px">' + ico("ui-compare", 16, "currentColor", "width:18px;height:18px") + 'Сравнить серии</button>')
R('''                <div class="mono" style="font-size:24px;line-height:1.1">{{ s.v }}</div>
                <div style="font-size:13px;color:var(--color-neutral-700)">{{ s.k }}</div>
              </div>
            </sc-for>
          </div>
        </div>
        <figure class="blueprint duotone ph" style="background:url(img/brand.jpg)''',
  '''                <div class="mono" style="font-size:24px;line-height:1.1;display:flex;align-items:center;gap:8px"><span class="ico ico-20 {{ s.icon }}" style="color:var(--color-accent-700)"></span>{{ s.v }}</div>
                <div style="font-size:13px;color:var(--color-neutral-700)">{{ s.k }}</div>
              </div>
            </sc-for>
          </div>
        </div>
        <figure class="blueprint duotone ph" style="background:url(img/brand.jpg)''')
IC('{ v: "24 мес.", k: "гарантия (условия поставщика)" }', "warranty-maker")
R('<h3 style="margin:0 0 10px">Запчасти и сервис</h3>',
  '<h3 style="margin:0 0 10px;display:flex;align-items:center;gap:10px">' + ico("quote-install", 24) + 'Запчасти и сервис</h3>')
R('<h3 style="margin:0 0 10px">Аналоги дешевле</h3>',
  '<h3 style="margin:0 0 10px;display:flex;align-items:center;gap:10px">' + ico("analog", 24) + 'Аналоги дешевле</h3>')

# ══ 26. О сервисе ═════════════════════════════════════════════════════════════
R('''  <div data-screen-label="О сервисе">
    <section style="background:var(--color-accent-900);color:var(--color-neutral-100)">
      <div style="max-width:1360px;margin:0 auto;padding:48px 28px 42px">''',
  '''  <div data-screen-label="О сервисе">
    <section style="background:var(--color-accent-900);color:var(--color-neutral-100);position:relative;overflow:hidden">
      <div class="duotone hero-ph" style="position:absolute;top:0;right:0;bottom:0;width:40%;background:url(img/about-engineer.jpg) center/cover no-repeat" data-photo="1"></div>
      <div class="hero-ph" style="position:absolute;top:0;right:0;bottom:0;width:40%;background:linear-gradient(90deg, var(--color-accent-900) 0%, rgba(29,45,61,0.72) 38%, rgba(29,45,61,0.08) 100%)"></div>
      <div style="max-width:1360px;margin:0 auto;padding:48px 28px 42px;position:relative">''')
R('''            <div class="card blueprint" style="padding:20px">
              <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
              <span class="card-kicker">{{ s.n }}</span>
              <span class="card-title">{{ s.t }}</span>
              <p class="card-body" style="font-size:14px">{{ s.d }}</p>''',
  '''            <div class="card blueprint" style="padding:20px">
              <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
              <span class="ico {{ s.icon }}" style="color:var(--color-accent-700)"></span>
              <span class="card-kicker">{{ s.n }}</span>
              <span class="card-title">{{ s.t }}</span>
              <p class="card-body" style="font-size:14px">{{ s.d }}</p>
              <div style="display:flex;gap:12px;color:var(--color-accent-700)">
                <sc-for list="{{ s.entries }}" as="e" hint-placeholder-count="5">
                  <span class="ico ico-20 {{ e.icon }}" title="{{ e.t }}"></span>
                </sc-for>
              </div>''')
ENTRIES = '[{ icon: "i-entry-catalog", t: "Каталог" }, { icon: "i-entry-chat", t: "Чат" }, { icon: "i-entry-photo", t: "Фото шильдика" }, { icon: "i-entry-list", t: "Заявка списком" }, { icon: "i-channel-mail", t: "Письмо" }]'
for n, t, i in [("01", "Заявка", "step-request"), ("02", "Подбор поставщика", "step-supplier-pick"), ("03", "Одна цена", "step-one-price"), ("04", "Сделка", "step-deal"), ("05", "Прямая отгрузка", "step-direct-ship")]:
    R('{ n: "%s", t: "%s", d:' % (n, t), '{ icon: "i-%s", entries: %s, n: "%s", t: "%s", d:' % (i, ENTRIES if n == "01" else "[]", n, t))
R('<h3 style="margin:0 0 10px">На чём мы зарабатываем</h3>',
  '<h3 style="margin:0 0 10px;display:flex;align-items:center;gap:10px">' + ico("about-earn", 24) + 'На чём мы зарабатываем</h3>')
for lab in ["Снабжение", "Поставщикам"]:
    R(f'<span class="text-muted">{lab}</span>', f'<span class="text-muted" style="{FLEX}">' + ico("channel-mail", 16) + f'{lab}</span>')

# ══ 27. Вход ══════════════════════════════════════════════════════════════════
R('<h3 style="margin:0 0 4px">Вход</h3>', '<h3 style="margin:0 0 4px;display:flex;align-items:center;gap:10px">' + ico("ui-login", 24) + 'Вход</h3>')
R('<button class="btn btn-primary btn-block" style="min-height:46px">Войти</button>',
  '<button class="btn btn-primary btn-block" style="min-height:46px;gap:8px">' + ico("ui-login", 16, "currentColor", "width:18px;height:18px") + 'Войти</button>')
R('<button class="btn btn-secondary btn-block" style="min-height:44px">Войти через MAX</button>',
  '<button class="btn btn-secondary btn-block" style="min-height:44px;gap:8px">' + ico("channel-max", 16, "currentColor", "width:18px;height:18px") + 'Войти через MAX</button>')
R('<h3 style="margin:0 0 4px">Регистрация компании</h3>',
  '<h3 style="margin:0 0 4px;display:flex;align-items:center;gap:10px">' + ico("ui-register", 24) + 'Регистрация компании</h3>')
R('<label>ИНН компании или ИП</label>', f'<label style="{FLEX};gap:6px">' + ico("ui-register", 16) + 'ИНН компании или ИП</label>')
R('<div class="mono" style="font-size:11px;text-transform:uppercase;color:var(--color-neutral-600);margin-bottom:6px">Найдено по ИНН · проверено за 4 секунды</div>',
  '<div class="mono" style="font-size:11px;text-transform:uppercase;color:var(--color-neutral-600);margin-bottom:6px;display:flex;align-items:center;gap:6px">' + ico("ui-kyc", 16) + 'Найдено по ИНН · проверено за 4 секунды</div>')
R('''            <sc-for list="{{ authPerks }}" as="p" hint-placeholder-count="5">
              <div style="display:flex;gap:9px;align-items:flex-start">
                <span style="width:6px;height:6px;background:var(--color-accent);display:block;flex:none;margin-top:7px"></span>
                <span style="font-size:14px;line-height:1.5;color:var(--color-neutral-800)">{{ p }}</span>''',
  '''            <sc-for list="{{ authPerks }}" as="p" hint-placeholder-count="5">
              <div style="display:flex;gap:10px;align-items:flex-start">
                <span class="ico ico-20 {{ p.icon }}" style="color:var(--color-accent-700);margin-top:1px"></span>
                <span style="font-size:14px;line-height:1.5;color:var(--color-neutral-800)">{{ p.t }}</span>''')
for t, i in [("Счёт на юрлицо за 15 минут", "pay-invoice"), ("Отсрочка платежа до 30 дней", "pay-deferral"), ("История закупок", "ui-history"),
             ("Сохранённые спецификации", "ui-specs"), ("Согласование заявок внутри компании", "ui-approval")]:
    R(f'        "{t}', f'        {{ icon: "i-{i}", t: "{t}')
R('"Счёт на юрлицо за 15 минут и закрывающие документы в кабинете и по ЭДО.",', '"Счёт на юрлицо за 15 минут и закрывающие документы в кабинете и по ЭДО." },')
R('"Отсрочка платежа до 30 дней после проверки контрагента.",', '"Отсрочка платежа до 30 дней после проверки контрагента." },')
R('"История закупок с периодичностью и повтором заказа одной кнопкой.",', '"История закупок с периодичностью и повтором заказа одной кнопкой." },')
R('"Сохранённые спецификации и шаблоны заявок для регулярной номенклатуры.",', '"Сохранённые спецификации и шаблоны заявок для регулярной номенклатуры." },')
R('"Согласование заявок внутри компании: цех, бюджет, закупка с ролями и лимитами."\n', '"Согласование заявок внутри компании: цех, бюджет, закупка с ролями и лимитами." }\n')

# ══ 28. Поиск пуст ════════════════════════════════════════════════════════════
R('''          <div class="card blueprint" style="padding:18px 20px">
            <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
            <span class="card-title">{{ a.t }}</span>''',
  '''          <div class="card blueprint" style="padding:18px 20px">
            <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
            <sc-if value="{{ a.hasPh }}" hint-placeholder-val="{{ false }}">
              <div class="duotone" style="height:90px;margin:-18px -20px 4px;background:url(img/nameplate.jpg) center/cover no-repeat" data-photo="1"></div>
            </sc-if>
            <span class="ico ico-28 {{ a.icon }}" style="color:var(--color-accent-700)"></span>
            <span class="card-title">{{ a.t }}</span>''')
for t, i in [("Поиск по фото шильдика", "entry-photo"), ("Подбор в умном чате", "entry-chat"), ("Заявка списком", "entry-list"), ("Запрос инженеру", "engineer")]:
    R('{ t: "%s", d:' % t, '{ icon: "i-%s", hasPh: %s, t: "%s", d:' % (i, "true" if i == "entry-photo" else "false", t))
R('<td style="font-weight:500;font-size:14px">{{ p.name }}</td>',
  '<td style="font-weight:500;font-size:14px"><span style="display:flex;align-items:center;gap:10px"><span class="thumb" style="width:40px;height:40px;background:' + PROD("p-cr32") + '"></span>{{ p.name }}</span></td>')

# ══ 29. Сравнение ═════════════════════════════════════════════════════════════
R('<th style="text-align:left">{{ m.name }}',
  '<th style="text-align:left;vertical-align:bottom"><span class="thumb" style="width:96px;height:96px;margin-bottom:8px;background: {{ m.bg }}"></span>{{ m.name }}')
for nm, ph in [("CNP CDLF 42-30", "p-cr32"), ("Wilo Helix V 4204", "p-cr32"), ("Grundfos CR 45-3", "p-cr32"), ("Ebara 3M 65-160", "p-nis80")]:
    IC('{ name: "%s", sku: "' % nm, PROD(ph), "bg", 1)

# ══ 30. Кабинет поставщика ════════════════════════════════════════════════════
R('<button class="btn btn-primary">Загрузить прайс</button>',
  '<button class="btn btn-primary" style="gap:8px">' + ico("price-upload", 16, "currentColor", "width:18px;height:18px") + 'Загрузить прайс</button>')
R('<span class="mono" style="font-size:12px;color:var(--color-neutral-600)">последний обмен: 14 сентября, 06:00</span>',
  '<span class="mono" style="font-size:12px;color:var(--color-neutral-600);display:flex;align-items:center;gap:6px">' + ico("tier-sync", 16) + 'последний обмен: 14 сентября, 06:00</span>')
R('<h3 style="margin:0">Прайс и остатки</h3>', '<h3 style="margin:0;display:flex;align-items:center;gap:10px">' + ico("vendor-price", 24) + 'Прайс и остатки</h3>')

# ══ 31. Статья ════════════════════════════════════════════════════════════════
R('''                <div>
                  <div style="font-size:14px;font-weight:500">{{ p.name }}</div>
                  <div class="mono" style="font-size:11px;color:var(--color-neutral-600)">{{ p.spec }}</div>
                </div>''',
  '''                <div style="display:flex;gap:10px;align-items:center">
                  <span class="thumb" style="width:48px;height:48px;background: {{ p.bg }}"></span>
                  <div>
                    <div style="font-size:14px;font-weight:500">{{ p.name }}</div>
                    <div class="mono" style="font-size:11px;color:var(--color-neutral-600)">{{ p.spec }}</div>
                  </div>
                </div>''')
for nm, ph in [('{ name: "Grundfos CR 32-4", spec: "32 м³/ч · 46 м · 5,5 кВт", price: "104 900 ₽" }', "p-cr32"),
               ('{ name: "CNP CDLF 42-30", spec: "40 м³/ч', "p-cr32"), ('{ name: "INNOVERT VR 15 кВт", spec: "частотник', "p-vr15")]:
    IC(nm, PROD(ph), "bg")
R('<h4 style="margin:0 0 6px">Спросить у чата</h4>', '<h4 style="margin:0 0 6px;display:flex;align-items:center;gap:8px">' + ico("entry-chat", 20) + 'Спросить у чата</h4>')

# ══ 32. Мобильные экраны ══════════════════════════════════════════════════════
R('''              <span style="margin-left:auto;display:grid;gap:4px">
                <span style="width:20px;height:2px;background:var(--color-text);display:block"></span>
                <span style="width:20px;height:2px;background:var(--color-text);display:block"></span>
                <span style="width:20px;height:2px;background:var(--color-text);display:block"></span>
              </span>''',
  '''              <span style="margin-left:auto;display:grid;place-items:center;width:44px;height:44px;margin-block:-10px;margin-right:-10px" aria-label="Меню">''' + ico("ui-menu", None, "var(--color-text)") + '''</span>''')
R('<input class="input" placeholder="Модель или артикул" style="min-height:48px">',
  '<div style="position:relative;display:flex">' + ico("ui-search", 20, "var(--color-neutral-600)", "position:absolute;left:14px;top:14px;pointer-events:none") + '<input class="input" placeholder="Модель или артикул" style="min-height:48px;padding-left:44px"></div>')
R('''                <button onClick="{{ goChat }}" class="btn btn-secondary" style="min-height:48px;font-size:15px">Чат в MAX</button>
              </div>''',
  '''                <button onClick="{{ goChat }}" class="btn btn-secondary" style="min-height:48px;font-size:15px">Чат в MAX</button>
              </div>
              <a href="#" onClick="{{ goPhoto }}" class="duotone" style="display:block;height:120px;background:url(img/nameplate-phone.jpg) center/cover no-repeat;border:1px solid var(--color-divider)" aria-label="Найти по фото шильдика" data-photo="1">
                <span class="mono" style="position:absolute;left:10px;bottom:10px;z-index:1;font-size:11px;background:var(--color-bg);color:var(--color-text);padding:4px 8px">Найти по фото шильдика</span>
              </a>''')
R('<button onClick="{{ goCart }}" class="btn btn-secondary" style="min-height:44px;font-size:14px;white-space:nowrap">Повторить</button>',
  '<button onClick="{{ goCart }}" class="btn btn-secondary" style="min-height:44px;font-size:14px;white-space:nowrap;gap:6px">' + ico("ui-repeat", 16, "currentColor") + 'Повторить</button>')
R('<span style="width:9px;height:9px;background: {{ t.fill }};border:1.5px solid var(--color-accent);display:block"></span>',
  '<span class="ico ico-20 {{ t.icon }}" style="color: {{ t.iconColor }}"></span>')
for t, i, c in [("Главная", "ui-home", "var(--color-accent-700)"), ("Каталог", "entry-catalog", "var(--color-neutral-600)"), ("Чат", "entry-chat", "var(--color-neutral-600)"), ("Заказы", "ui-orders", "var(--color-neutral-600)")]:
    R('{ t: "%s", fill:' % t, '{ icon: "i-%s", iconColor: "%s", t: "%s", fill:' % (i, c, t))
R('Робот говорит · 01:19</span>', 'Робот говорит · 01:19</span>')  # проверка якоря
R('<span class="mono" style="font-size:10px;text-transform:uppercase;color:var(--color-accent-300)">Робот говорит · 01:19</span>',
  '<span class="mono" style="font-size:10px;text-transform:uppercase;color:var(--color-accent-300);display:flex;align-items:center;gap:6px">' + ico("op-voice", None, A3, "width:14px;height:14px") + 'Робот говорит · 01:19</span>')
R('<div class="ph duotone" style="background:{{ p.bg }};height:84px" data-photo="1"></div>',
  '<div class="ph" style="background:{{ p.bg }};height:84px" data-photo="1"></div>')
for n in ["p-nis80", "p-lgcy75"]:
    R('{ bg: "url(img/%s.jpg) center/cover no-repeat", sku:' % n, '{ bg: "%s", sku:' % PROD(n))
R('<div class="ph duotone" style="background:url(img/p-cr32.jpg) center/contain no-repeat #c2c2c4;height:180px" data-photo="1"></div>',
  f'<div class="ph" style="background:{PROD("p-cr32")};height:180px" data-photo="1"></div>')

# ══ 33. Подвал ════════════════════════════════════════════════════════════════
R('<span style="font-size:13px">zakaz@promkontur.example · пн–пт 08:00–19:00 МСК</span>',
  '<span style="font-size:13px;display:flex;align-items:center;gap:6px">' + ico("channel-mail", None, A3, "width:14px;height:14px") + 'zakaz@promkontur.example · пн–пт 08:00–19:00 МСК</span>')
for chip, i in [("Чат в MAX", "channel-max"), ("Почта снабжения", "channel-mail")]:
    R(f'<span class="mono" style="font-size:12px;border:1px solid var(--color-neutral-700);padding:6px 10px;white-space:nowrap">{chip}</span>',
      '<span class="mono" style="font-size:12px;border:1px solid var(--color-neutral-700);padding:6px 10px;white-space:nowrap;display:inline-flex;align-items:center;gap:6px">' + ico(i, None, A3, "width:14px;height:14px") + f'{chip}</span>')

# ══ 34. SEO-блок «Поиск по фото»: иллюстрация 16:9 ════════════════════════════
R('''      photo: {
        heading: "Поиск оборудования по фото шильдика",''',
  '''      photo: {
        image: "url(img/nameplate-phone.jpg) center/cover no-repeat",
        heading: "Поиск оборудования по фото шильдика",''')

# ══ 35. Фон под товарными снимками — в тон краю кадра (замер по краям 900×900) ═══
BG = {"p-cr32": "#c7c5c5", "p-cr32-flange": "#c6c4c1", "p-cr32-motor": "#bebebe", "p-nb40": "#b3b3b4",
      "p-nis80": "#bdb8b3", "p-lgcy75": "#6a6663", "p-vr15": "#d9d9d9", "p-6205": "#c3c1c2"}
R('const pb = n => ({ bg: "url(img/" + n + ".jpg) center/cover no-repeat", bgc: "url(img/" + n + ".jpg) center/contain no-repeat #bfbfc1" });',
  'const pbg = ' + json.dumps(BG) + ';\n    const pb = n => ({ bg: "url(img/" + n + ".jpg) center/cover no-repeat", bgc: "url(img/" + n + ".jpg) center/contain no-repeat " + (pbg[n] || "#bfbfc1") });')
cnt = len(re.findall(r"url\(img/(p-[a-z0-9-]+)\.jpg\) center/contain no-repeat #(?:c2c2c4|bfbfc1)", s))
s = re.sub(r"url\(img/(p-[a-z0-9-]+)\.jpg\) center/contain no-repeat #(?:c2c2c4|bfbfc1)",
           lambda m: f"url(img/{m.group(1)}.jpg) center/contain no-repeat {BG[m.group(1)]}", s)
print("товарных фонов подогнано:", cnt)

# ══ SeoBlock.dc.html ══════════════════════════════════════════════════════════
main_s, main_n = s, N
s = open(PS, encoding="utf-8").read()
R('<link rel="stylesheet" href="_ds/industry-2cf29483-63c2-42c2-a32d-4823edc25b26/styles.css">\n<style>',
  '<link rel="stylesheet" href="_ds/industry-2cf29483-63c2-42c2-a32d-4823edc25b26/styles.css">\n<link rel="stylesheet" href="icons.css">\n<style>')
R('  details[open] > summary .seo-caret { transform:rotate(180deg); }',
  '  details[open] > summary .seo-caret { transform:rotate(180deg); }\n  .seo-rot { transition:transform .18s; }\n  details[open] > summary .seo-rot { transform:rotate(180deg); }')
R('<span class="seo-caret" style="flex:none;margin-top:6px;color:var(--color-accent)"></span>',
  '<span class="ico ico-20 i-ui-faq-toggle seo-rot" style="margin-top:1px;color:var(--color-accent-700)"></span>')
R('class="btn btn-secondary" style="min-width:44px;min-height:44px;padding:0">←</button>',
  'class="btn btn-secondary" style="min-width:44px;min-height:44px;padding:0"><span class="ico ico-20 i-ui-arrow-left"></span></button>')
R('class="btn btn-secondary" style="min-width:44px;min-height:44px;padding:0">→</button>',
  'class="btn btn-secondary" style="min-width:44px;min-height:44px;padding:0"><span class="ico ico-20 i-ui-arrow-right"></span></button>')
R('''    <div>
      <div class="seo-mono" style="font-size:11px;text-transform:uppercase;color:var(--color-neutral-600);margin-bottom:8px">Информация о разделе</div>''',
  '''    <div style="display:flex;gap:32px;align-items:flex-start;flex-wrap:wrap">
    <div style="flex:1 1 520px;min-width:0">
      <div class="seo-mono" style="font-size:11px;text-transform:uppercase;color:var(--color-neutral-600);margin-bottom:8px">Информация о разделе</div>''')
R('''      </details>
    </div>
''', '''      </details>
    </div>
    <sc-if value="{{ hasImage }}" hint-placeholder-val="{{ false }}">
      <div class="blueprint duotone" style="flex:0 1 420px;aspect-ratio:16/9;background:{{ image }}" data-photo="1">
        <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
      </div>
    </sc-if>
    </div>
''')
R('      heading: d.heading,\n', '      heading: d.heading,\n      image: d.image || "",\n      hasImage: !!d.image,\n')

open(P, "w", encoding="utf-8").write(main_s)
open(PS, "w", encoding="utf-8").write(s)
print(f"ok: {main_n} замен в макете, {N - main_n} в SeoBlock")

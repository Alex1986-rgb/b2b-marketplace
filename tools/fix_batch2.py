#!/usr/bin/env python3
"""Доработка 14.09.26, пачка 2: каталог только из насосов, админка, иконки состояний, QR, таблицы, шкалы."""
import os, sys
P = os.path.join(os.path.dirname(__file__), "..", "project", "Промышленный агрегатор.dc.html")
s = open(P, encoding="utf-8").read()
def R(old, new, n=1):
    global s
    c = s.count(old)
    if c != n: sys.exit(f"[{c}≠{n}] {old[:100]!r}")
    s = s.replace(old, new)

# ── Каталог «Насосы» с фильтрами Grundfos / 20–60 м³/ч / в наличии — показываем только такие
i = s.find("catalogProducts = [")
R('    const seo = {\n', '''    const pb = n => ({ bg: "url(img/" + n + ".jpg) center/cover no-repeat", bgc: "url(img/" + n + ".jpg) center/contain no-repeat #bfbfc1" });
    const pumpProducts = [
      { ...pb("p-cr32"), sku: "96122802", name: "Grundfos CR 32-4", spec: "Подача 32 м³/ч · напор 46 м · 5,5 кВт", price: "104 900 ₽", lead: "Отгрузка 2–4 дня", stock: "8 шт. в наличии", cta: "В корзину" },
      { ...pb("p-nb40"), sku: "98160680", name: "Grundfos NB 40-200/219", spec: "Подача 45 м³/ч · напор 50 м · 7,5 кВт", price: "187 400 ₽", lead: "Отгрузка 3–5 дней", stock: "4 шт. в наличии", cta: "В корзину" },
      { ...pb("p-cr32"), sku: "96122804", name: "Grundfos CR 45-3", spec: "Подача 45 м³/ч · напор 40 м · 7,5 кВт", price: "156 700 ₽", lead: "Отгрузка 2–4 дня", stock: "5 шт. в наличии", cta: "В корзину" },
      { ...pb("p-cr32"), sku: "96511845", name: "Grundfos CR 20-5", spec: "Подача 21 м³/ч · напор 52 м · 4 кВт", price: "86 300 ₽", lead: "Отгрузка 2 дня", stock: "11 шт. в наличии", cta: "В корзину" },
      { ...pb("p-nb40"), sku: "97760170", name: "Grundfos NBG 65-50-160", spec: "Подача 60 м³/ч · напор 32 м · 7,5 кВт", price: "173 900 ₽", lead: "Отгрузка 3–5 дней", stock: "3 шт. в наличии", cta: "В корзину" },
      { ...pb("p-nis80"), sku: "98124543", name: "Grundfos TP 65-230/2", spec: "Подача 38 м³/ч · напор 20 м · 4 кВт", price: "142 600 ₽", lead: "Отгрузка 4–6 дней", stock: "2 шт. в наличии", cta: "В корзину" }
    ].map(p => ({ ...p, open: this.go("product") }));

    const seo = {
''')
R('      products: catalogProducts,', '      products: catalogProducts,\n      pumpProducts,')
R('<sc-for list="{{ products }}" as="p" hint-placeholder-count="6">\n            <div class="card blueprint"',
  '<sc-for list="{{ pumpProducts }}" as="p" hint-placeholder-count="6">\n            <div class="card blueprint"')

# ── Админка: базовое правило — последним (первое подходящее выигрывает); наценка 18 % после правки из журнала
R('''        { cat: "Все категории (базовое)", range: "любая", markup: "+20%", round: "до 100 ₽", status: "Активно", tagClass: "tag-accent" },
''', '')
R('''        { cat: "Частотные преобразователи", range: "любая", markup: "+22%", round: "до 100 ₽", status: "Черновик", tagClass: "tag-neutral" }
      ],''', '''        { cat: "Частотные преобразователи", range: "любая", markup: "+22%", round: "до 100 ₽", status: "Черновик", tagClass: "tag-neutral" },
        { cat: "Все категории (базовое)", range: "любая", markup: "+18%", round: "до 100 ₽", status: "Активно", tagClass: "tag-accent" }
      ],''')
R('{ v: "20%", k: "базовая наценка" }', '{ v: "18%", k: "базовая наценка" }')
R('<label>Базовая наценка, %</label><input class="input mono" onChange="{{ noop }}" value="20">',
  '<label>Базовая наценка, %</label><input class="input mono" onChange="{{ noop }}" value="18">')
R('Базовая наценка применяется ко всем позициям, правила ниже её переопределяют.',
  'Базовая наценка применяется, если не сработало ни одно правило ниже.')

# ── Кабинет: в таблице «В пути» один заказ
R('{ v: "2", k: "заказа в пути" }', '{ v: "1", k: "заказ в пути" }')

# ── Условия поставщикам: шкала весов от 100 %, а не от максимума
R('{ k: "Цена с доставкой", v: "45%", pct: "100%" }', '{ k: "Цена с доставкой", v: "45%", pct: "45%" }')
R('{ k: "Наличие и точность остатка", v: "25%", pct: "56%" }', '{ k: "Наличие и точность остатка", v: "25%", pct: "25%" }')
R('{ k: "Срок отгрузки", v: "20%", pct: "44%" }', '{ k: "Срок отгрузки", v: "20%", pct: "20%" }')
R('{ k: "Рейтинг поставщика", v: "10%", pct: "22%" }', '{ k: "Рейтинг поставщика", v: "10%", pct: "10%" }')

# ── Таблицы в половинной колонке: не прятать последний столбец за прокруткой
R('<table class="table" style="width:100%;min-width:700px">\n              <thead><tr><th>Шаг</th>',
  '<table class="table" style="width:100%">\n              <thead><tr><th>Шаг</th>')
R('<td class="mono" style="font-size:13px">{{ s.rate }}</td>', '<td class="mono" style="font-size:13px;white-space:nowrap">{{ s.rate }}</td>')
R('<table class="table" style="width:100%;min-width:640px">\n              <thead><tr><th>Направление</th><th>Оборот</th>',
  '<table class="table" style="width:100%">\n              <thead><tr><th>Направление</th><th>Оборот</th>')
R('<td class="mono" style="font-size:14px;color: {{ d.color }}">{{ d.total }}</td>',
  '<td class="mono" style="font-size:14px;white-space:nowrap;color: {{ d.color }}">{{ d.total }}</td>')

# ── QR-код бота вместо штриховки
R('''<div class="ph" style="height:104px;border:1px solid var(--color-divider);display:grid;place-items:center">
                <span class="mono" style="font-size:10px;color:var(--color-neutral-600);background:var(--color-bg);padding:3px 6px">QR</span>
              </div>''', '''<div style="height:104px;border:1px solid var(--color-divider);background:#fff url(img/qr-max.svg) center/92px no-repeat" role="img" aria-label="QR-код бота в MAX"></div>''')

# ── Состояния: настоящие иконки вместо пустых квадратов
R('<span style="width:34px;height:34px;border:1.5px solid {{ s.iconColor }};display:block;align-self: {{ s.iconAlign }}"></span>',
  '<span style="width:40px;height:40px;display:block;align-self: {{ s.iconAlign }};background: {{ s.iconColor }};-webkit-mask: {{ s.icon }};mask: {{ s.icon }}"></span>')
icons = {
 "Корзина": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="1.6"><path d="M3 4h2l2.4 11h10.2L20 7H6.2"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/></svg>',
 "Новый кабинет": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="1.6"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/></svg>',
 "Ошибка синхронизации": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="1.6"><path d="M4.5 12a7.5 7.5 0 0 1 13-5.1L20 9M20 4v5h-5M19.5 12a7.5 7.5 0 0 1-13 5.1L4 15m0 5v-5h5"/></svg>',
 "Отсрочка отклонена": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="1.6"><rect x="5" y="10.5" width="14" height="10"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3M12 14.5v2.5"/></svg>',
 "Нет связи": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="1.6"><path d="M2.5 8.5a14 14 0 0 1 19 0M5.5 12a9.5 9.5 0 0 1 13 0M8.8 15.4a5 5 0 0 1 6.4 0"/><circle cx="12" cy="19" r="1"/><path d="M3 3l18 18"/></svg>',
 "Позиция снята": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="1.6"><rect x="3.5" y="4" width="17" height="5"/><path d="M5 9v11h14V9M10 15l4-4m0 4-4-4"/></svg>',
}
import urllib.parse
for label, svg in icons.items():
    uri = "url(\\\"data:image/svg+xml," + urllib.parse.quote(svg, safe=":/=\" ") .replace('"', "'") + "\\\") center/contain no-repeat"
    R('{ label: "%s", title:' % label, '{ label: "%s", icon: "%s", title:' % (label, uri))
open(P, "w", encoding="utf-8").write(s)
print("пачка 2 применена")

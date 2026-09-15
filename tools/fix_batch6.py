#!/usr/bin/env python3
"""Доработка 14.09.26, пачка 6: убираем «макетность» из разметки (отчёт docs/reports/2026-09-14-audit-maketnost.md).
Фото на белом, пузыри чата, степпер заказа, рубрикатор-аккордеон, панель поиска, звёзды рейтинга, зона загрузки,
баннеры направлений, иконки «всё или ничего», человеческие подписи вместо меток, подвал.
Каждая замена проверяет число вхождений — если макет уже поправлен, падает с понятной ошибкой."""
import os, re, sys
ROOT = os.path.join(os.path.dirname(__file__), "..", "project")
P = os.path.join(ROOT, "Промышленный агрегатор.dc.html")
PS = os.path.join(ROOT, "SeoBlock.dc.html")
s = open(P, encoding="utf-8").read()
def R(old, new, n=1):
    global s
    c = s.count(old)
    if c != n:
        sys.exit(f"[{c}≠{n}] {old[:110]!r}")
    s = s.replace(old, new)
def RX(pat, new, n):
    global s
    s, c = re.subn(pat, new, s)
    if c != n:
        sys.exit(f"[regex {c}≠{n}] {pat[:110]!r}")

# ── 1. Packshot на белом: подложка contain → #ffffff, правильные фото брендов ─────────────
RX(r'(url\(img/p-[\w-]+\.jpg\) center/contain no-repeat) #[0-9a-fA-F]{6}', r'\1 #ffffff', 35)
R('const pbg = {"p-cr32": "#c7c5c5", "p-cr32-flange": "#c6c4c1", "p-cr32-motor": "#bebebe", "p-nb40": "#b3b3b4", "p-nis80": "#bdb8b3", "p-lgcy75": "#6a6663", "p-vr15": "#d9d9d9", "p-6205": "#c3c1c2"};',
  'const pbg = {};')
R('(pbg[n] || "#bfbfc1")', '(pbg[n] || "#ffffff")')
W = ' center/contain no-repeat #ffffff'
# Сравнение
R('{ bg: "url(img/p-cr32.jpg)' + W + '", name: "CNP CDLF 42-30", sku:', '{ bg: "url(img/p-cnp-cdlf.jpg)' + W + '", name: "CNP CDLF 42-30", sku:')
R('{ bg: "url(img/p-cr32.jpg)' + W + '", name: "Wilo Helix V 4204", sku:', '{ bg: "url(img/p-wilo-helix.jpg)' + W + '", name: "Wilo Helix V 4204", sku:')
R('{ bg: "url(img/p-nis80.jpg)' + W + '", name: "Ebara 3M 65-160", sku:', '{ bg: "url(img/p-ebara-3m.jpg)' + W + '", name: "Ebara 3M 65-160", sku:')
# Умный чат
R('{ bg: "url(img/p-cr32.jpg)' + W + '", name: "CNP CDLF 42-30 · 40', '{ bg: "url(img/p-cnp-cdlf.jpg)' + W + '", name: "CNP CDLF 42-30 · 40')
R('{ bg: "url(img/p-cr32.jpg)' + W + '", name: "Wilo Helix V 4204 · 42', '{ bg: "url(img/p-wilo-helix.jpg)' + W + '", name: "Wilo Helix V 4204 · 42')
# Статья: товары по теме
R('{ bg: "url(img/p-cr32.jpg)' + W + '", name: "CNP CDLF 42-30", spec:', '{ bg: "url(img/p-cnp-cdlf.jpg)' + W + '", name: "CNP CDLF 42-30", spec:')
# Поиск по фото: аналоги с миниатюрами
R('{ name: "Wilo Helix V 3604", spec: "Подача 36', '{ bg: "url(img/p-wilo-helix.jpg)' + W + '", name: "Wilo Helix V 3604", spec: "Подача 36')
R('{ name: "CNP CDLF 32-40", spec: "Подача 32', '{ bg: "url(img/p-cnp-cdlf.jpg)' + W + '", name: "CNP CDLF 32-40", spec: "Подача 32')
R('{ name: "Ebara 3M 65-160", spec: "Подача 33', '{ bg: "url(img/p-ebara-3m.jpg)' + W + '", name: "Ebara 3M 65-160", spec: "Подача 33')
R('''              <div>
                <div style="font-weight:500">{{ a.name }}</div>''', '''              <div style="display:flex;align-items:center;gap:12px;min-width:0">
                <span class="thumb" style="width:48px;height:48px;border-radius:8px;background: {{ a.bg }}"></span>
                <div>
                <div style="font-weight:500">{{ a.name }}</div>''')
R('''                <div style="font-size:13px;color:var(--color-neutral-700)">{{ a.spec }}</div>
              </div>''', '''                <div style="font-size:13px;color:var(--color-neutral-700)">{{ a.spec }}</div>
                </div>
              </div>''')
# Поиск пуст: у каждой строки своё фото
R('{ name: "Grundfos CR 32-4", spec: "32 м³/ч · 46 м · 5,5 кВт", stock:', '{ bg: "url(img/p-cr32.jpg)' + W + '", name: "Grundfos CR 32-4", spec: "32 м³/ч · 46 м · 5,5 кВт", stock:')
R('{ name: "Grundfos CR 32-2", spec:', '{ bg: "url(img/p-cr32.jpg)' + W + '", name: "Grundfos CR 32-2", spec:')
R('{ name: "CNP CDLF 32-40", spec: "32 м³/ч', '{ bg: "url(img/p-cnp-cdlf.jpg)' + W + '", name: "CNP CDLF 32-40", spec: "32 м³/ч')
R('{ name: "Wilo Helix V 3604", spec: "36 м³/ч', '{ bg: "url(img/p-wilo-helix.jpg)' + W + '", name: "Wilo Helix V 3604", spec: "36 м³/ч')
R('<span class="thumb" style="width:40px;height:40px;background:url(img/p-cr32.jpg)' + W + '"></span>{{ p.name }}',
  '<span class="thumb" style="width:40px;height:40px;background: {{ p.bg }}"></span>{{ p.name }}')

# ── 2. Чат: пузыри, аватар, время, единая строка ввода, иконки навыков ─────────────────────
BOT = '{ bot: true, bg: "#fff", color: "var(--color-text)", radius: "16px 16px 16px 4px", shadow: "0 1px 3px rgba(22,38,58,.08)", avatar: "block" }'
USR = '{ bot: false, bg: "var(--color-accent)", color: "#fff", radius: "16px 16px 4px 16px", shadow: "none", avatar: "none" }'
R('''      ],
      maxFeatures: [''', '''      ].map((m, i) => ({ ...m, ...(m.who === "Чат" ? ''' + BOT + ' : ' + USR + '''), time: ["10:02", "10:02", "10:03", "10:03", "10:05", "10:05"][i] })),
      maxFeatures: [''')
R('''      ],
      goUpload: this.go("upload"), goOrder: this.go("order"), goClient: this.go("client"),''', '''      ].map((m, i) => ({ ...m, ...(m.align === "flex-start" ? ''' + BOT + ' : ' + USR + '''), time: ["09:41", "09:41", "09:42", "09:42"][i] })),
      goUpload: this.go("upload"), goOrder: this.go("order"), goClient: this.go("client"),''')
AV = '<span style="width:28px;height:28px;border-radius:50%;flex:none;background:url(img/mark.svg) center/cover;display: {{ m.avatar }};margin-bottom:20px" aria-hidden="true"></span>'
R('''              <div style="display:flex;justify-content: {{ m.align }}">
                <div style="max-width:88%;border:1px solid {{ m.border }};background: {{ m.bg }};color: {{ m.color }};padding:12px 14px;display:flex;flex-direction:column;gap:6px">
                  <span class="mono" style="font-size:10px;text-transform:uppercase;opacity:0.65">{{ m.who }}</span>
                  <span style="font-size:15px;line-height:1.5">{{ m.text }}</span>''', '''              <div style="display:flex;gap:8px;align-items:flex-end;justify-content: {{ m.align }}">
                ''' + AV + '''
                <div style="max-width:88%;display:flex;flex-direction:column;gap:4px;align-items: {{ m.align }}">
                <div style="background: {{ m.bg }};color: {{ m.color }};border-radius: {{ m.radius }};box-shadow: {{ m.shadow }};padding:12px 14px;display:flex;flex-direction:column;gap:6px">
                  <span style="font-size:15px;line-height:1.5">{{ m.text }}</span>''')
R('''                      <button class="btn btn-secondary" style="font-size:14px">Показать аналоги</button>
                    </div>
                  </sc-if>
                </div>
              </div>''', '''                      <button class="btn btn-secondary" style="font-size:14px">Показать аналоги</button>
                    </div>
                  </sc-if>
                </div>
                <span style="font-size:11px;color:var(--color-neutral-600);padding:0 4px">{{ m.time }}</span>
                </div>
              </div>''')
R('<div style="flex:1;display:flex;flex-direction:column;gap:14px;padding:16px">\n            <sc-for list="{{ chat }}"',
  '<div style="flex:1;display:flex;flex-direction:column;gap:14px;padding:16px;background:var(--color-bg)">\n            <sc-for list="{{ chat }}"')
R('<span style="width:9px;height:9px;background:var(--color-accent);display:block"></span>\n            <span style="font-family:var(--font-heading);font-weight:600;font-size:17px">Подбор',
  '<span style="width:9px;height:9px;border-radius:50%;background:var(--color-accent);display:block"></span>\n            <span style="font-family:var(--font-heading);font-weight:600;font-size:17px">Подбор')
R('''            <div style="display:flex">
              <input class="input" placeholder="Например: насос 40 м³/ч, напор 35 м, вода +60 °C, нужен аналог Grundfos" style="min-height:46px;border-right:0">
              <button class="btn btn-secondary" style="min-height:46px;border-right:0">Файл</button>
              <button class="btn btn-primary" style="min-height:46px;padding-inline:22px">Отправить</button>
            </div>''', '''            <div class="chat-input" style="display:flex;align-items:center;gap:4px;border:1px solid var(--color-divider);border-radius:12px;background:#fff;padding:4px">
              <button class="btn btn-secondary" aria-label="Прикрепить файл" title="Прикрепить файл" style="min-height:42px;min-width:42px;padding:0;border:0;background:transparent;color:var(--color-neutral-700)"><span class="ico ico-20 i-entry-upload"></span></button>
              <input class="input" placeholder="Например: насос 40 м³/ч, напор 35 м, вода +60 °C, нужен аналог Grundfos" style="min-height:42px;border:0;background:transparent;box-shadow:none;flex:1;min-width:0;padding-left:4px">
              <button class="btn btn-primary" style="min-height:42px;padding-inline:20px;border-radius:8px">Отправить</button>
            </div>''')
# мобильный чат
R('''                <div style="display:flex;justify-content: {{ m.align }}">
                  <div style="max-width:86%;border:1px solid {{ m.border }};background: {{ m.bg }};color: {{ m.color }};padding:10px 12px;font-size:14px;line-height:1.45">{{ m.text }}</div>
                </div>''', '''                <div style="display:flex;gap:6px;align-items:flex-end;justify-content: {{ m.align }}">
                  ''' + AV.replace('margin-bottom:20px', 'margin-bottom:18px') + '''
                  <div style="max-width:86%;display:flex;flex-direction:column;gap:3px;align-items: {{ m.align }}">
                    <div style="background: {{ m.bg }};color: {{ m.color }};border-radius: {{ m.radius }};box-shadow: {{ m.shadow }};padding:10px 12px;font-size:14px;line-height:1.45">{{ m.text }}</div>
                    <span style="font-size:11px;color:var(--color-neutral-600);padding:0 4px">{{ m.time }}</span>
                  </div>
                </div>''')
R('<div style="padding:14px;display:flex;flex-direction:column;gap:10px;min-height:300px">\n              <sc-for list="{{ mobileChat }}"',
  '<div style="padding:14px;display:flex;flex-direction:column;gap:10px;min-height:300px;background:var(--color-bg)">\n              <sc-for list="{{ mobileChat }}"')
R('''            <div style="border-top:1px solid var(--color-divider);padding:10px 14px;display:flex;gap:8px">
              <input class="input" placeholder="Сообщение" style="min-height:46px">
              <button class="btn btn-primary" style="min-height:46px;padding-inline:18px">→</button>
            </div>''', '''            <div style="border-top:1px solid var(--color-divider);padding:10px 14px">
              <div class="chat-input" style="display:flex;align-items:center;gap:4px;border:1px solid var(--color-divider);border-radius:12px;background:#fff;padding:4px">
                <button class="btn btn-secondary" aria-label="Прикрепить файл" style="min-height:44px;min-width:44px;padding:0;border:0;background:transparent;color:var(--color-neutral-700)"><span class="ico ico-20 i-entry-upload"></span></button>
                <input class="input" placeholder="Сообщение" style="min-height:44px;border:0;background:transparent;box-shadow:none;flex:1;min-width:0;padding-left:4px">
                <button class="btn btn-primary" aria-label="Отправить" style="min-height:44px;min-width:44px;padding:0;border-radius:8px"><span class="ico ico-20 i-ui-arrow-right"></span></button>
              </div>
            </div>''')
R('<span style="width:9px;height:9px;background:var(--color-accent);display:block"></span>\n              <span style="font-family:var(--font-heading);font-weight:600;font-size:17px">@promkontur_bot</span>',
  '<span style="width:9px;height:9px;border-radius:50%;background:var(--color-accent);display:block"></span>\n              <span style="font-family:var(--font-heading);font-weight:600;font-size:17px">@promkontur_bot</span>')
# «Что чат делает без человека»: иконки у всех шести, без точек
R('{ dot: "block", t: "Уточняет параметры"', '{ icon: "i-ui-specs", t: "Уточняет параметры"')
R('{ icon: "i-entry-list", dot: "none", t: "Читает', '{ icon: "i-entry-list", t: "Читает')
R('{ dot: "block", t: "Проверяет остатки', '{ icon: "i-ui-search", t: "Проверяет остатки')
R('{ icon: "i-analog", dot: "none", t: "Предлагает', '{ icon: "i-analog", t: "Предлагает')
R('{ dot: "block", t: "Собирает спецификацию', '{ icon: "i-ui-quote", t: "Собирает спецификацию')
R('{ icon: "i-engineer", dot: "none", t: "Передаёт', '{ icon: "i-engineer", t: "Передаёт')
R('                  <span style="width:7px;height:7px;background:var(--color-accent);flex:none;margin-top:7px;display: {{ s.dot }}"></span>\n', '')

# ── 3. Статус заказа: горизонтальный степпер (на телефоне вертикальный) ───────────────────
R('{ icon: "i-order-created", date: "12 сент", t: "Оформлен", d: "счёт выставлен, 15 минут", color: "var(--color-text)", bar: "var(--color-accent)" },',
  '{ icon: "i-order-created", date: "12 сентября", t: "Оформлен", d: "счёт выставлен за 15 минут", st: "done" },')
R('{ icon: "i-order-paid", date: "12 сент", t: "Счёт принят · отсрочка", d: "оплата до 15 октября", color: "var(--color-text)", bar: "var(--color-accent)" },',
  '{ icon: "i-order-paid", date: "12 сентября", t: "Счёт принят", d: "отсрочка, оплата до 15 октября", st: "done" },')
R('{ icon: "i-order-handed", date: "13 сент", t: "Передан поставщикам", d: "Гидромаш и ПромАрматура, подтверждено", color: "var(--color-text)", bar: "var(--color-accent)" },',
  '{ icon: "i-order-handed", date: "13 сентября", t: "Передан поставщикам", d: "Гидромаш и ПромАрматура", st: "done" },')
R('{ icon: "i-order-shipped", date: "15 сент", t: "Отгружен", d: "сборный груз, 2 отгрузки · трек 4512 8890 3341", color: "var(--color-accent-700)", bar: "var(--color-accent)" },',
  '{ icon: "i-order-shipped", date: "15 сентября", t: "Отгружен", d: "сборный груз, 2 отгрузки", st: "done" },')
R('''{ icon: "i-order-delivery", date: "18 сент", t: "Доставка", d: "терминал Тула, ожидается", color: "var(--color-neutral-700)", bar: "var(--color-neutral-300)" }
      ],''', '''{ icon: "i-order-delivery", date: "в пути", t: "Доставка", d: "терминал Тула, 18 сентября", st: "cur" },
        { icon: "i-ui-approval", date: "ожидается", t: "Получен", d: "приёмка и подпись УПД", st: "fut" }
      ].map((s, i, a) => {
        const on = x => x && x.st !== "fut";
        const A = "var(--color-accent)", L = "var(--color-divider)";
        return { ...s,
          dotBg: s.st === "done" ? A : "#fff",
          dotColor: s.st === "done" ? "#fff" : s.st === "cur" ? A : "var(--color-neutral-500)",
          dotRing: s.st === "done" ? "none" : s.st === "cur" ? "0 0 0 2px " + A : "inset 0 0 0 2px var(--color-neutral-300)",
          tColor: s.st === "fut" ? "var(--color-neutral-700)" : "var(--color-text)",
          lineL: i === 0 ? "transparent" : (on(s) ? A : L),
          lineR: i === a.length - 1 ? "transparent" : (on(a[i + 1]) ? A : L) };
      }),''')
R('''        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1px;background:var(--color-divider)">
          <sc-for list="{{ orderSteps }}" as="s" hint-placeholder-count="5">
            <div style="background:var(--color-bg);padding:14px 16px;display:flex;flex-direction:column;gap:6px;border-top:3px solid {{ s.bar }}">
              <span class="mono" style="font-size:11px;color:var(--color-neutral-600)">{{ s.date }}</span>
              <span style="font-family:var(--font-heading);font-weight:600;font-size:17px;color: {{ s.color }};display:flex;align-items:center;gap:8px"><span class="ico ico-20 {{ s.icon }}"></span>{{ s.t }}</span>
              <span style="font-size:13px;color:var(--color-neutral-700)">{{ s.d }}</span>
            </div>
          </sc-for>
        </div>''', '''        <ol class="pk-stepper" aria-label="Этапы заказа" style="list-style:none;margin:0;padding:4px 0 0;display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr)">
          <sc-for list="{{ orderSteps }}" as="s" hint-placeholder-count="6">
            <li class="pk-step" style="position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;padding:0 6px">
              <span class="pk-step-l" style="position:absolute;top:15px;left:0;right:50%;height:2px;background: {{ s.lineL }}"></span>
              <span class="pk-step-r" style="position:absolute;top:15px;left:50%;right:0;height:2px;background: {{ s.lineR }}"></span>
              <span class="pk-step-dot" style="position:relative;z-index:1;width:32px;height:32px;flex:none;border-radius:50%;display:grid;place-items:center;background: {{ s.dotBg }};color: {{ s.dotColor }};box-shadow: {{ s.dotRing }}"><span class="ico ico-16 {{ s.icon }}"></span></span>
              <span style="display:flex;flex-direction:column;gap:2px">
                <span style="font-family:var(--font-heading);font-weight:600;font-size:14px;line-height:1.3;color: {{ s.tColor }}">{{ s.t }}</span>
                <span style="font-size:12px;color:var(--color-neutral-600)">{{ s.date }}</span>
                <span style="font-size:12px;color:var(--color-neutral-600);line-height:1.4">{{ s.d }}</span>
              </span>
            </li>
          </sc-for>
        </ol>''')

# ── 4. Главная: рубрикатор-аккордеон, «Одна цена», панель поиска, чипы-пилюли ────────────
R('''        <sc-for list="{{ directionGroups }}" as="g" hint-placeholder-count="6">
          <div>
            <div class="mono" style="font-size:10px;text-transform:uppercase;color:var(--color-accent-700);padding:10px 16px 4px;border-top:1px solid var(--color-divider);display:flex;align-items:center;gap:8px"><span class="ico ico-16 {{ g.icon }}"></span>{{ g.title }}</div>''',
'''        <sc-for list="{{ directionGroups }}" as="g" hint-placeholder-count="6">
          <details class="rubric" open="{{ g.open }}" style="border-top:1px solid var(--color-divider)">
            <summary style="display:flex;align-items:center;gap:8px;padding:10px 16px;cursor:pointer;list-style:none;font-family:var(--font-heading);font-weight:600;font-size:14px;line-height:1.25">
              <span class="ico ico-16 {{ g.icon }}" style="color:var(--color-accent-700)"></span>
              <span style="flex:1;min-width:0">{{ g.title }}</span>
              <span style="font-family:var(--font-body);font-weight:400;font-size:12px;color:var(--color-neutral-600)">{{ g.cnt }}</span>
              <span class="ico ico-16 i-ui-faq-toggle rubric-rot" style="color:var(--color-neutral-600)"></span>
            </summary>
            <div style="padding-bottom:6px">''')
R('''                <span class="mono" style="font-size:10px;color:var(--color-neutral-600);white-space:nowrap">{{ c.count }}</span>
              </a>
            </sc-for>
          </div>
        </sc-for>''', '''                <span style="font-size:12px;color:var(--color-neutral-600);white-space:nowrap">{{ c.count }}</span>
              </a>
            </sc-for>
            </div>
          </details>
        </sc-for>''')
R('<nav class="blueprint" style="padding:6px 0">\n        <i class="corner tl">', '<nav class="blueprint" style="padding:6px 0;position:sticky;top:124px">\n        <i class="corner tl">')
R('''          <span class="mono" style="font-size:11px;text-transform:uppercase;color:var(--color-neutral-600)">Каталог</span>
          <a href="#" onClick="{{ goDirections }}" style="font-size:12px">все 45</a>''', '''          <span style="font-family:var(--font-heading);font-weight:600;font-size:16px">Каталог</span>
          <a href="#" onClick="{{ goDirections }}" style="font-size:13px">все 45 разделов</a>''')
R('''        }
      ],
      chat: [''', '''        }
      ].map((g, i) => ({ ...g, cnt: g.items.length, open: i === 0 })),
      chat: [''')
R('''            <div style="border:1px solid var(--color-divider);padding:14px 16px;margin-top:4px">
              <div class="mono" style="font-size:11px;text-transform:uppercase;color:var(--color-neutral-600);margin-bottom:8px">Внутренний подбор · Grundfos CR 32-4</div>
              <sc-for list="{{ suppliersLight }}" as="s" hint-placeholder-count="3">
                <div style="display:flex;justify-content:space-between;font-size:14px;padding:4px 0;color:{{ s.color }}">
                  <span>{{ s.name }}</span><span class="mono" style="font-size:15px">{{ s.price }}</span>
                </div>
              </sc-for>
              <div style="display:flex;justify-content:space-between;align-items:baseline;border-top:1px solid var(--color-divider);margin-top:8px;padding-top:10px">''',
'''            <div style="background:var(--color-bg);border-radius:10px;padding:14px 16px;margin-top:4px">
              <div style="font-size:13px;color:var(--color-neutral-700);margin-bottom:8px">Внутренний подбор · Grundfos CR 32-4</div>
              <sc-for list="{{ suppliersLight }}" as="s" hint-placeholder-count="3">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:14px;padding:7px 10px;border-radius:8px;background: {{ s.bg }};color: {{ s.color }};font-weight: {{ s.weight }}">
                  <span style="display:flex;align-items:center;gap:8px"><span style="width:18px;height:18px;border-radius:50%;flex:none;display:grid;place-items:center;font-size:11px;line-height:1;background: {{ s.dotBg }};color:#fff;box-shadow: {{ s.dotRing }}">{{ s.mark }}</span>{{ s.name }}</span><span class="mono" style="font-size:15px">{{ s.price }}</span>
                </div>
              </sc-for>
              <div style="display:flex;justify-content:space-between;align-items:baseline;border-top:1px solid var(--color-divider);margin-top:8px;padding-top:10px">''')
R('''        { name: "Поставщик А", price: "91 000 ₽", color: "var(--color-neutral-700)" },
        { name: "Поставщик Б", price: "88 500 ₽", color: "var(--color-neutral-700)" },
        { name: "Поставщик В · выбран", price: "86 000 ₽", color: "var(--color-text)" }
      ],''', '''        { name: "Склад в Москве", price: "91 000 ₽", on: false },
        { name: "Склад в Туле", price: "88 500 ₽", on: false },
        { name: "Склад в Казани · выбран", price: "86 000 ₽", on: true }
      ].map(x => ({ ...x, color: x.on ? "var(--color-text)" : "var(--color-neutral-700)", weight: x.on ? "600" : "400",
        bg: x.on ? "color-mix(in srgb, var(--color-accent) 8%, transparent)" : "transparent",
        dotBg: x.on ? "var(--color-accent)" : "transparent", dotRing: x.on ? "none" : "inset 0 0 0 1.5px var(--color-neutral-300)", mark: x.on ? "✓" : "" })),''')
R('''        <div style="display:flex;margin-top:22px;max-width:900px">
          <input class="input" placeholder="Введите модель, артикул или название оборудования" style="min-height:54px;font-size:16px;background:#fff;border-right:0">
          <button onClick="{{ goPhoto }}" class="btn btn-secondary" style="min-height:54px;background:#fff;border-right:0;white-space:nowrap;gap:8px"><span class="ico ico-16 i-entry-photo" style="color:currentColor;width:18px;height:18px"></span>По фото шильдика</button>
          <button class="btn btn-primary" style="min-height:54px;padding-inline:30px;font-size:16px;color:#fff;gap:8px"><span class="ico ico-16 i-ui-search" style="color:currentColor;width:18px;height:18px"></span><span class="hide-m">Найти</span></button>
        </div>''', '''        <div style="display:flex;margin-top:22px;max-width:900px;align-items:center;gap:4px;padding:5px;background:#fff;border-radius:12px;box-shadow:0 10px 30px rgba(8,16,26,.28)">
          <input class="input" placeholder="Введите модель, артикул или название оборудования" style="min-height:48px;font-size:16px;background:transparent;border:0;box-shadow:none;flex:1;min-width:0;padding-left:12px">
          <button onClick="{{ goPhoto }}" class="btn btn-secondary" style="min-height:48px;background:transparent;border:0;border-radius:8px;color:var(--color-accent-700);white-space:nowrap;gap:8px"><span class="ico ico-16 i-entry-photo" style="color:currentColor;width:18px;height:18px"></span>По фото шильдика</button>
          <button class="btn btn-primary" style="min-height:48px;padding-inline:28px;font-size:16px;color:#fff;gap:8px;border-radius:8px"><span class="ico ico-16 i-ui-search" style="color:currentColor;width:18px;height:18px"></span><span class="hide-m">Найти</span></button>
        </div>''')
PILL = 'border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18)'
R('<span class="mono" style="font-size:12px;padding:5px 10px;border:1px solid var(--color-accent-700);color:var(--color-accent-200)">{{ e }}</span>',
  '<span class="pill-dark" style="font-size:13px;padding:5px 12px;' + PILL + ';color:var(--color-accent-200)">{{ e }}</span>')
R('<span class="mono" style="font-size:13px;padding:7px 12px;border:1px solid var(--color-accent-700);display:inline-flex',
  '<span class="pill-dark" style="font-size:13px;padding:6px 12px;' + PILL + ';display:inline-flex', 4)

# ── 5. Карточка товара: звёзды, миниатюры, характеристики в карточке с зеброй ─────────────
STARS = ('<span class="stars" role="img" aria-label="Рейтинг {v} из 5" style="position:relative;display:inline-block;font-size:{fs}px;line-height:1;letter-spacing:2px;white-space:nowrap">'
         '<span style="color:var(--color-neutral-300)">★★★★★</span>'
         '<span style="position:absolute;left:0;top:0;width:{pct};overflow:hidden;color:#e0a526">★★★★★</span></span>')
R('''            <div class="mono" style="font-size:36px;line-height:1">4,7</div>
            <div style="font-size:13px;color:var(--color-neutral-700)">на основе 34 отзывов</div>''', '''            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
              <span class="mono" style="font-size:36px;line-height:1">4,7</span>
              ''' + STARS.format(v='4,7', fs=20, pct='94%') + '''
            </div>
            <div style="font-size:13px;color:var(--color-neutral-700);margin-top:4px">на основе 34 отзывов</div>''')
R('<span class="mono" style="font-size:16px">{{ r.score }}</span>',
  '<span style="display:inline-flex;align-items:center;gap:6px"><span style="color:#e0a526;font-size:15px;line-height:1" aria-hidden="true">★</span><span class="mono" style="font-size:16px">{{ r.score }}</span></span>')
R('''        <h3>Характеристики</h3>
        <table class="table">''', '''        <h3>Характеристики</h3>
        <div class="blueprint" style="padding:6px 8px">
        <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
        <table class="table spec-zebra" style="width:100%">''')
R('''              <tr><td style="width:280px;color:var(--color-neutral-700)">{{ s.k }}</td><td style="font-weight:500">{{ s.v }}</td></tr>
            </sc-for>
          </tbody>
        </table>''', '''              <tr><td style="width:280px;color:var(--color-neutral-700)">{{ s.k }}</td><td style="font-weight:500">{{ s.v }}</td></tr>
            </sc-for>
          </tbody>
        </table>
        </div>''')

# ── 6. Поиск по фото: зона загрузки и загруженный файл в «Распознано» ─────────────────────
R('''        <div class="blueprint" style="padding:36px;display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center;min-height:320px;justify-content:center">
          <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
          <span style="width:160px;height:110px;display:block;background:url(img/nameplate.jpg) center/cover no-repeat;border:1px solid var(--color-divider)" role="img" aria-label="Пример снимка шильдика" data-photo="1"></span>''',
'''        <div class="dropzone" style="padding:36px;display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center;min-height:320px;justify-content:center;border:2px dashed color-mix(in srgb, var(--color-accent) 35%, transparent);background:color-mix(in srgb, var(--color-accent) 4%, #fff);border-radius:14px">
          <span class="ico ico-40 i-entry-upload" style="color:var(--color-accent-700)"></span>''')
R('''          <div class="mono" style="font-size:11px;text-transform:uppercase;color:var(--color-neutral-600)">Распознано · 0,8 с</div>''',
'''          <div style="display:flex;align-items:center;gap:12px">
            <span style="width:64px;height:64px;flex:none;border-radius:8px;background:url(img/nameplate.jpg) center/cover no-repeat" role="img" aria-label="Загруженное фото шильдика" data-photo="1"></span>
            <div>
              <div style="font-family:var(--font-heading);font-weight:600;font-size:16px;display:flex;align-items:center;gap:8px"><span class="ico ico-16 i-ui-approval" style="color:var(--color-accent-700)"></span>Распознано за 0,8 с</div>
              <div style="font-size:13px;color:var(--color-neutral-700)">shildik-nasos.jpg · 2,4 МБ</div>
            </div>
          </div>''')

# ── 7. Направления: баннер кластера — белая карточка со скруглением и тенью ──────────────
R('''          <div style="display:grid;grid-template-columns:220px minmax(0,1fr);gap:0;margin-bottom:14px;border:1px solid var(--color-divider)">
            <div class="duotone" style="background: {{ g.photo }};min-height:112px" data-photo="1"></div>''',
'''          <div class="dir-banner" style="display:grid;grid-template-columns:220px minmax(0,1fr);gap:0;margin-bottom:14px;border-radius:14px;overflow:hidden;background:#fff;box-shadow:0 1px 3px rgba(22,38,58,.08), 0 6px 20px rgba(22,38,58,.06)">
            <div class="duotone dir-banner-ph" style="background: {{ g.photo }};min-height:112px;border-radius:14px 0 0 14px" data-photo="1"></div>''')

# ── 9. Иконки «всё или ничего» ───────────────────────────────────────────────────────────
# О сервисе: ряд входов с подписями
R('''              <div style="display:flex;gap:12px;color:var(--color-accent-700)">
                <sc-for list="{{ s.entries }}" as="e" hint-placeholder-count="5">
                  <span class="ico ico-20 {{ e.icon }}" title="{{ e.t }}"></span>
                </sc-for>
              </div>''', '''              <div style="display:flex;gap:8px 14px;flex-wrap:wrap">
                <sc-for list="{{ s.entries }}" as="e" hint-placeholder-count="5">
                  <span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--color-neutral-700)"><span class="ico ico-16 {{ e.icon }}" style="color:var(--color-accent-700)"></span>{{ e.t }}</span>
                </sc-for>
              </div>''')
# О сервисе: контакты — иконка у каждой строки
MI = lambda ic: '<span class="text-muted" style="display:inline-flex;align-items:center;gap:8px"><span class="ico ico-16 ' + ic + '" style="color:var(--color-accent-700)"></span>'
R('<span class="text-muted">Мессенджер</span><a href="#" onClick="{{ goChat }}" class="mono">Чат в MAX</a>',
  MI('i-channel-max') + 'Мессенджер</span><a href="#" onClick="{{ goChat }}">Чат в MAX</a>')
R('<span class="text-muted">Часы работы</span><span>пн–пт 08:00–19:00 МСК</span>', MI('i-ui-history') + 'Часы работы</span><span>пн–пт 08:00–19:00 МСК</span>')
R('<span class="text-muted">Юрлицо</span><span>ООО «Промконтур», ИНН 7701234567</span>', MI('i-ui-requisites') + 'Юрлицо</span><span>ООО «Промконтур», ИНН 7701234567</span>')
# Поставщикам: три цифры
R('{ v: "0 ₽", k: "стоимость размещения прайса" },', '{ icon: "i-vendor-price", v: "0 ₽", k: "стоимость размещения прайса" },')
R('{ v: "1–5 дней", k: "срок подключения выгрузки" },', '{ icon: "i-tier-sync", v: "1–5 дней", k: "срок подключения выгрузки" },')
# Проекты: показатели hero и этапы
R('{ v: "2 часа", k: "предварительный расчёт" },', '{ icon: "i-ui-history", v: "2 часа", k: "предварительный расчёт" },')
R('{ v: "до 6 дней", k: "полное КП с монтажом" },', '{ icon: "i-quote-install", v: "до 6 дней", k: "полное КП с монтажом" },')
R('{ v: "14 дней", k: "срок действия цены" },', '{ icon: "i-step-one-price", v: "14 дней", k: "срок действия цены" },')
R('{ a: "03 · КП и согласование"', '{ icon: "i-ui-quote", a: "03 · КП и согласование"')
R('{ a: "04 · Поставка"', '{ icon: "i-step-direct-ship", a: "04 · Поставка"')
# Админка: разные иконки табов по смыслу
R('<button onClick="{{ s.go }}" style="{{ s.style }}"><span class="ico ico-16 i-op-admin"></span>{{ s.t }}</button>',
  '<button onClick="{{ s.go }}" style="{{ s.style }}"><span class="ico ico-16 {{ s.icon }}"></span>{{ s.t }}</button>')
R('''adminSections: [{ t: "Всё", id: "all" },
        { t: "Обзор", id: "overview" }, { t: "Цены и наценка", id: "prices" },
        { t: "Источники", id: "sources" }, { t: "Автоматизация", id: "auto" },
        { t: "Каналы и MAX", id: "channels" }, { t: "Контент и SEO", id: "content" }
      ].map(s => ({
        t: s.t,''', '''adminSections: [{ t: "Всё", id: "all", icon: "i-op-admin" },
        { t: "Обзор", id: "overview", icon: "i-op-economy" }, { t: "Цены и наценка", id: "prices", icon: "i-price-upload" },
        { t: "Источники", id: "sources", icon: "i-tier-sync" }, { t: "Автоматизация", id: "auto", icon: "i-op-autopilot" },
        { t: "Каналы и MAX", id: "channels", icon: "i-channel-max" }, { t: "Контент и SEO", id: "content", icon: "i-doc-generic" }
      ].map(s => ({
        t: s.t, icon: s.icon,''')

# ── 10. Человеческие подписи вместо служебных меток ──────────────────────────────────────
R('<div class="mono" style="font-size:11px;text-transform:uppercase;color:var(--color-neutral-600)">Заявка · zayavka_cex4_sentyabr.xlsx</div>',
  '<div style="display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--color-neutral-800);background:#fff;border:1px solid var(--color-divider);border-radius:999px;padding:4px 12px 4px 8px;margin-bottom:6px"><span class="ico ico-16 i-doc-generic" style="color:var(--color-accent-700)"></span>Заявка цех 4, сентябрь.xlsx · 20 строк</div>')
R('carrier: "Перевозчик 1"', 'carrier: "Деловые Линии"', 2)
R('carrier: "Перевозчики 3 и 2"', 'carrier: "СДЭК-Грузы и ПЭК"')
R('{ name: "Перевозчик 1", zone:', '{ name: "Деловые Линии", zone:')
R('{ name: "Перевозчик 2", zone:', '{ name: "ПЭК", zone:')
R('{ name: "Перевозчик 3", zone:', '{ name: "СДЭК-Грузы", zone:')
R('{ name: "Перевозчик 4", zone:', '{ name: "Байкал-Сервис", zone:')
R('{ name: "Перевозчик 5 · своя машина", zone:', '{ name: "Своя машина", zone:')
R('d: "с примером битой строки"', 'd: "Файл с ошибкой: строка 14, нет цены"')

# ── 11. Подвал: без дубля «Чат в MAX», колонки в одну сетку ──────────────────────────────
R('''          <a href="#" onClick="{{ goChat }}" class="mono" style="color:#fff;font-size:19px;white-space:nowrap">Чат в MAX</a>
''', '')
FB = 'font-size:13px;border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:7px 12px;white-space:nowrap;display:inline-flex;align-items:center;gap:6px'
R('<span class="mono" style="font-size:12px;border:1px solid var(--color-neutral-700);padding:6px 10px;white-space:nowrap;display:inline-flex;align-items:center;gap:6px"><span class="ico i-channel-max"',
  '<a href="#" onClick="{{ goChat }}" style="' + FB + ';color:#fff;text-decoration:none"><span class="ico i-channel-max"')
R('width:14px;height:14px"></span>Чат в MAX</span>', 'width:14px;height:14px"></span>Чат в MAX</a>')
R('<span class="mono" style="font-size:12px;border:1px solid var(--color-neutral-700);padding:6px 10px;white-space:nowrap;display:inline-flex;align-items:center;gap:6px"><span class="ico i-channel-mail"',
  '<a href="mailto:zakaz@promkontur.example" style="' + FB + ';color:#fff;text-decoration:none"><span class="ico i-channel-mail"')
R('width:14px;height:14px"></span>Почта снабжения</span>', 'width:14px;height:14px"></span>Почта снабжения</a>')
R('<div style="max-width:1360px;margin:0 auto;padding:36px 28px 28px;display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:28px">',
  '<div class="footer-grid" style="max-width:1360px;margin:0 auto;padding:36px 28px 28px;display:grid;grid-template-columns:minmax(0,1.6fr) repeat(5,minmax(0,1fr));gap:28px">')
R('<div class="mono" style="font-size:11px;text-transform:uppercase;color:var(--color-neutral-500);margin-bottom:10px">{{ f.title }}</div>',
  '<div style="font-family:var(--font-heading);font-weight:600;font-size:14px;color:#fff;margin-bottom:10px">{{ f.title }}</div>')

# ── CSS макета: структурные классы этой пачки ────────────────────────────────────────────
R('''  .gal > span { width:80px; height:80px; display:block; border:1px solid var(--color-divider); }''',
  '''  .gal > span { width:80px; height:80px; display:block; border:1px solid var(--color-divider); border-radius:8px; background-color:#fff; }
  /* пачка 6 */
  .spec-zebra tbody tr:nth-child(odd) td { background:var(--color-bg); }
  .spec-zebra td { border-top:0 !important; }
  details.rubric > summary::-webkit-details-marker { display:none; }
  details.rubric[open] > summary .rubric-rot { transform:rotate(180deg); }
  .rubric-rot { transition:transform .15s ease; }
  .pill-dark { transition:background .15s ease; }
  .pill-dark:hover { background:rgba(255,255,255,.16) !important; }
  @media (min-width:761px) and (max-width:1180px) {
    .footer-grid { grid-template-columns:repeat(3,minmax(0,1fr)) !important; }
  }''')
R('''    .ph-side { height:200px !important; }
  }''', '''    .ph-side { height:200px !important; }
    .pk-stepper { grid-auto-flow:row !important; }
    .pk-step { flex-direction:row !important; align-items:flex-start !important; text-align:left !important; gap:12px !important; padding:0 0 18px !important; }
    .pk-step:last-child { padding-bottom:0 !important; }
    .pk-step-l { top:0 !important; left:15px !important; right:auto !important; width:2px !important; height:16px !important; }
    .pk-step-r { top:16px !important; bottom:0; left:15px !important; right:auto !important; width:2px !important; height:auto !important; }
    .dir-banner-ph { min-height:160px !important; border-radius:14px 14px 0 0 !important; }
    .footer-grid { grid-template-columns:repeat(2,minmax(0,1fr)) !important; }
    .footer-grid > :first-child { grid-column:1 / -1; }
  }''')

open(P, "w", encoding="utf-8").write(s)

# ── SeoBlock: моно-капс надписи над H2 удаляются ─────────────────────────────────────────
t = open(PS, encoding="utf-8").read()
for lab, mb in (("Информация о разделе", 8), ("Частые вопросы", 8), ("База знаний", 6)):
    old = f'<div class="seo-mono" style="font-size:11px;text-transform:uppercase;color:var(--color-neutral-600);margin-bottom:{mb}px">{lab}</div>'
    c = t.count(old)
    if c != 1: sys.exit(f"[SeoBlock {c}≠1] {lab}")
    t = re.sub(r'\n[ \t]*' + re.escape(old), '', t)
open(PS, "w", encoding="utf-8").write(t)
print("пачка 6 применена")

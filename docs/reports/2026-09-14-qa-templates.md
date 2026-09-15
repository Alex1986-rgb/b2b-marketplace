# QA шаблонов gen_pages.js против эталонов макета — 14.09.2026

Проверено puppeteer-core + Chrome на 1440 и 390, скриншоты фрагментами, смотрено глазами.

- **Товары:** `katalog/podshipniki/skf-6205-2rs`, `katalog/nasosy/grundfos-cr-20-5`, `grundfos-cr-32-2`, `katalog/zapchasti/manzheta-45x65x10-nbr`, `katalog/armatura/klapan-obratnyj-dn65-pn16`. Эталон: `grundfos-cr-32-4`.
- **Бренды:** `skf`, `wilo`, `nord`. Эталон: `grundfos`.
- **Направления:** 44 шт., смотрел `kompressory`, `podshipniki-i-komplektuyushchie`, `vodopodgotovka`. Эталон: `nasosy`.
- **Статьи:** 15 шт., смотрел `kavitaciya-…`, `postavka-oborudovaniya-iz-kitaya`. Эталон: `kak-podobrat-nasos-po-rabochej-tochke`.

Скриншоты лежат в `docs/reports/img-templates/`, номера 1–8 указаны в таблицах.

Горизонтального переполнения страницы нет ни на одной странице (scrollWidth = ширина окна). Все фото загружаются. H1 и H2 на телефоне приводит к единому размеру общее правило из `app.css`.

## Главная причина половины мобильных дефектов

Мобильные правила в `app.css` и `skin.css` ищут inline-стили в том виде, в каком их пишет браузер: с пробелами и `0px`. Например, `[style*="max-width: 1360px"]` или `[style*="grid-template-columns: minmax(0px, 1"]`.

Страницы из `gen_pages.js` вставляются как raw-HTML без такой нормализации: `max-width:1360px`, `minmax(0,1.2fr)`. Поэтому на них не срабатывают:
- поле 16px на телефоне (сейчас 28px);
- схлопывание двухколоночного hero направления в одну колонку.

Правило для `minmax(300px` срабатывает случайно: внутри этой строки пробела нет.

Надёжнее всего не подгонять строки под селекторы, а дать шаблонам свои классы. Все правки ниже так и сделаны.

**Общий CSS (добавить в конец `tools/site/skin.css`) — нужен для правок P1:**

```css
/* ══ Шаблоны gen_pages.js ══ */
.pk-main { max-width: 1360px; margin: 0 auto; padding: 22px 28px 56px; }
.pk-hero { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, .8fr); gap: 28px; align-items: stretch; margin-bottom: 28px; }
.pk-lonegrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 280px)); gap: 16px; }
.pk-prose-col > p, .pk-prose-col > ul, .pk-prose-col > h2 { max-width: 760px; }
.pk-faq2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; align-items: start; }
@media (max-width: 760px) {
  .pk-main { padding: 16px 16px 40px !important; }
  .pk-hero { grid-template-columns: minmax(0, 1fr) !important; gap: 16px; }
  .pk-hero > .ph { min-height: 200px !important; order: 2; }
  .pk-faq2, .pk-lonegrid { grid-template-columns: minmax(0, 1fr) !important; }
  .pk-hero .pk-kpi { display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px !important; }
}
```

**Общая правка обёртки (строки ~41–43 `gen_pages.js`):**

```js
const wrap = inner => `<main class="pk-main">${inner}</main>`;
// faqBlock: сетка 2 колонки, как у эталона, и шеврон дизайн-системы вместо треугольника
const faqBlock = faq => !faq || !faq.length ? '' : `<h2 style="font-size:24px;margin:36px 0 14px">Вопросы и ответы</h2>
<div class="pk-faq2">${faq.map(f => `<details class="blueprint faq-item" style="padding:14px 16px"><summary style="font-family:var(--font-heading);font-weight:600;font-size:17px;line-height:1.3"><span>${esc(f.q)}</span><span class="ico ico-20 i-ui-faq-toggle seo-rot" style="margin-top:1px;color:var(--color-accent-700)"></span></summary><p style="font-size:14px;line-height:1.6;color:var(--color-neutral-800);margin:10px 0 0">${esc(f.a)}</p></details>`).join('')}</div>`;
```

---

## 1. Товары (`katalog/*/<slug>/`)

Скриншоты: 1, 2, 3.

| P | Проблема | Где | Готовая правка |
|---|---|---|---|
| **P1** | **На телефоне цена и «В корзину» уходят в самый низ, после описания, характеристик и FAQ (y≈2970 px из 5700).** Так происходит у всех товаров с одним фото, а это 22 из 24. Правило из `skin.css` `.split > :first-child > .gal ~ * {order:2}` срабатывает только при наличии `.gal`, а с одним фото шаблон выводит `<div style="height:12px">`. У `grundfos-cr-32-2` (2 фото) цена стоит на месте (y≈1019). | 390, скрин 1 | В шаблоне галерею выводить всегда: `${photos.length > 1 ? `<div class="gal" …>…</div>` : '<div class="gal" style="margin:0 0 12px"></div>'}`. Пустой `.gal` включит порядок: фото → карточка цены → остальное. |
| **P1** | Поле на телефоне 28px, у эталона 16px. Текст и таблица уже, крошки переносятся. | 390, все типы | `wrap` → `class="pk-main"` (см. общий блок). |
| P2 | Нет блока отзывов и рейтинга. У эталона есть «Отзывы инженеров»: 4,7, шкалы, 4 отзыва, `aggregateRating` в JSON-LD. Шаблон заметно беднее. | 1440, скрин 2 | Выдумывать отзывы нельзя. Если в `products.json` появится `p.reviews {avg,count,items[]}`, после таблицы характеристик вставить `${p.reviews ? `<h2 style="font-size:24px;margin:26px 0 4px">Отзывы инженеров</h2><div class="blueprint" style="padding:18px 20px;display:flex;gap:16px;align-items:center"><span class="mono" style="font-size:34px">${String(p.reviews.avg).replace('.', ',')}</span><span style="color:#E0A526;font-size:20px">★★★★★</span><span style="font-size:13px;color:var(--color-neutral-700)">на основе ${p.reviews.count} отзывов</span></div>` : ''}`, а в `ld` добавить `aggregateRating`. Пока данных нет — оставить как есть. |
| P2 | FAQ сжат в левую колонку 2×2 рядом с пустым местом под липкой карточкой. У эталона FAQ на всю ширину, после split. Шеврон — треугольник `seo-caret`, у эталона иконка `i-ui-faq-toggle`. | 1440, скрин 3 | Вынести `${faqBlock(p.faq)}` из `<div>` левой колонки: после `</aside>\n</div>` и перед `related`. Шеврон — в общей правке `faqBlock`. |
| P2 | В карточке цены нет счётчика количества. «В корзину» и «Быстрый счёт» стоят в одну строку. У эталона: счётчик + «В корзину» строкой, «Быстрый счёт» на всю ширину ниже. Цена 34px против 38px. | 1440, скрин 2 | Заменить блок кнопок при `p.price != null`: `<div style="display:flex;gap:10px"><div class="seg" style="align-items:stretch"><span class="seg-opt">−</span><span class="seg-opt mono" style="min-width:44px;justify-content:center">1</span><span class="seg-opt">+</span></div><button class="btn btn-primary" data-demo="1" style="flex:1;min-height:44px">В корзину</button></div><button class="btn btn-secondary btn-block" data-demo="1" style="min-height:40px;margin-top:10px">Быстрый счёт</button>`. Цене задать `font-size:38px;line-height:1`. |
| P2 | Нет SEO-блока «<модель>: характеристики и применение» с «Читать полностью» и нет карусели «Статьи по теме». У эталона оба есть. | 1440 | Карусель: после `related` вставить `${arts.length ? `<h2 style="font-size:24px;margin:40px 0 14px">Статьи по теме</h2><div class="pk-lonegrid">${arts.map(x => articleCard(BASE, x)).join('')}</div>` : ''}`, где `const arts = articles.filter(a => (a.relatedProducts||[]).includes(p.slug)).slice(0,4);`. |
| P2 | Одно и то же фото у разных моделей: `p-cr32` у 5 насосов CR, `p-nis80` у CNP NIS и Grundfos TP, `p-check-valve` у клапана и задвижки, `p-gasket-kit` у прокладок и виброопоры. В «С этим товаром смотрят» стоят две одинаковые картинки подряд. | данные `products.json` | Шаблон тут ни при чём — нужны отдельные фото. Минимум поправить явную ошибку: `vibroopora-m12` ≠ комплект прокладок. |
| P2 | Нет `BreadcrumbList` в JSON-LD. У эталона есть. | SEO | Добавить функцию `const bcLd = (BASE, items) => ({ '@type':'BreadcrumbList', itemListElement: items.map((it,i) => ({ '@type':'ListItem', position:i+1, name:it.name, ...(it.href ? { item: it.href } : {}) })) });` и в `out.push` передавать её результат рядом с `ld`. Абсолютный адрес (`item`) подставлять так же, как сборка подставляет `IMGABS`. Как сборка принимает второй объект разметки, проверить по `build_site.js`. |
| P3 | Последняя крошка — полное имя («Подшипник SKF 6205-2RS»), на 390 уходит на вторую строку. У эталона коротко: «CR 32-4». | 390 | `{ name: p.short || p.name.replace(new RegExp('^.*?' + (p.brand||'') + '\\s*'), '') }`. |
| P3 | Второй блок сайдбара «Нужен аналог дешевле?» — жирный заголовок. У эталона мелкий капс-лейбл акцентом. | 1440 | `<div style="display:flex;gap:10px;align-items:center;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--color-accent-700);font-weight:500">`. |
| P3 | Карточки «С этим товаром смотрят»: фото `contain` 150px в карточке ~420px — пакшот мелкий. На телефоне каждая карточка на всю ширину, 3 шт. ≈ 900px прокрутки. | 1440 / 390 | Сетку `related` → `class="pk-lonegrid"`. Для телефона в `skin.css`: `@media (max-width:760px){ .pk-lonegrid{ grid-auto-flow:column; grid-auto-columns:78%; grid-template-columns:none!important; overflow-x:auto; scroll-snap-type:x mandatory } .pk-lonegrid>*{ scroll-snap-align:start } }`. |

## 2. Производители (`proizvoditeli/<slug>/`)

Скриншоты: 4, 5.

| P | Проблема | Где | Готовая правка |
|---|---|---|---|
| **P1** | Hero беднее эталона и справа пустота ~400px: нет фото, CTA-кнопок и KPI-строки. У эталона: H1 + лид + 3 кнопки + 4 цифры + фото справа. | 1440, скрин 4 | Заменить блок от `<h1>` до `positioning` на: `<section class="pk-hero"><div style="display:flex;flex-direction:column;gap:12px;justify-content:center"><h1 style="font-size:40px;margin:0">${esc(b.h1||b.name)}</h1><p style="font-size:17px;line-height:1.6;margin:0">${esc(b.intro)}</p><div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn btn-primary" href="#series" style="text-decoration:none">Серии ${esc(b.name)}</a><a class="btn btn-secondary" href="${BASE}chat/" style="text-decoration:none">Подобрать аналог</a><a class="btn btn-secondary" href="${BASE}poisk-po-foto/" style="text-decoration:none">Найти по шильдику</a></div><div class="pk-kpi" style="display:flex;gap:28px;flex-wrap:wrap;border-top:1px solid var(--color-divider);padding-top:14px">${b.country?`<div><div class="mono" style="font-size:24px">${esc(b.country)}</div><div style="font-size:13px;color:var(--color-neutral-700)">страна</div></div>`:''}${b.founded?`<div><div class="mono" style="font-size:24px">${b.founded}</div><div style="font-size:13px;color:var(--color-neutral-700)">год основания</div></div>`:''}<div><div class="mono" style="font-size:24px">${(b.series||[]).reduce((s,x)=>s+(+x.count||0),0)}</div><div style="font-size:13px;color:var(--color-neutral-700)">позиций в сериях</div></div></div></div><div class="duotone ph" data-photo="1" style="min-height:260px;border-radius:14px;background:url(IMGBASE${b.cover||'warehouse'}.jpg) center/cover no-repeat"></div></section><p style="font-size:15px;line-height:1.7;color:var(--color-neutral-800);max-width:920px;margin:0 0 24px">${esc(b.positioning)}</p>`. У `<h2>` «Серии» добавить `id="series"`. |
| **P1** | Поле на телефоне 28px вместо 16px. | 390, скрин 5 | `pk-main` (общий блок). |
| P2 | В таблице серий нет колонки «Открыть» с кнопкой, как у эталона. Заголовок «Цена», у эталона «Цена от». | 1440 | Добавить `<th></th>` и в строку `<td style="text-align:right"><a class="btn btn-secondary" href="${BASE}chat/?q=${encodeURIComponent(b.name+' '+s.name)}" style="text-decoration:none;min-height:32px;padding:4px 12px;font-size:13px">Подобрать</a></td>`. Заголовок → «Цена от». |
| P2 | Крошка «Производители» ведёт на `proizvoditeli/grundfos/`. Хаба производителей нет — ссылка обманывает. | все бренды | До появления хаба выводить без ссылки: `{ name: 'Производители' }`. |
| P2 | «Модели в каталоге» с 1–2 товарами: карточка 230px и пустая полоса справа (после перехода на `auto-fill` карточка больше не растягивается — это уже исправлено). | 1440 | `class="pk-lonegrid"`. Если моделей меньше 3, дописать карточку-заглушку: `<a class="blueprint" href="${BASE}chat/" style="padding:18px;display:flex;flex-direction:column;justify-content:center;gap:8px;text-decoration:none;color:inherit"><span style="font-weight:600">Нужна другая модель ${esc(b.name)}?</span><span style="font-size:14px;color:var(--color-neutral-700)">Найдём по артикулу или фото шильдика</span></a>`. |
| P2 | FAQ в 3 колонки (`auto-fit 300px` на 1304px). Вопросы в две строки обрезаются по-разному. У эталона 2 колонки. | 1440 | Общая правка `faqBlock` (`pk-faq2`). |
| P3 | Нет SEO-блока «<Бренд>: серии, цены и подбор аналогов» и «Статьи по теме». | 1440 | Как для товара: `articles.filter(a => (a.body||[]).some(x => (x.p||'').includes(b.name))).slice(0,4)` → `pk-lonegrid`. |
| P3 | На телефоне таблица серий `min-width:720px` скроллится без подсказки. У эталона та же схема, но шире колонка «Серия». | 390 | `table` → `min-width:640px`, первой колонке `white-space:nowrap`. |

## 3. Направления (`napravleniya/<slug>/`)

Скриншоты: 6, 7.

| P | Проблема | Где | Готовая правка |
|---|---|---|---|
| **P1** | **Hero на телефоне остаётся в 2 колонки:** текст шириной ~200px (лид на 12 строк), справа узкая полоса фото 120×800. Причина — `minmax(0,1.2fr)` без пробелов, мобильное правило не срабатывает. | 390, скрин 6 | `<section style="display:grid;…">` → `<section class="pk-hero">`. Блоку цифр добавить `class="pk-kpi"` (станет 2×2, как у эталона). |
| **P1** | Поле 28px на телефоне. | 390 | `pk-main`. |
| P2 | Чипы производителей без рамки: `tag-accent` и `tag-neutral` выглядят как простой текст в строку, «Kaishan» подсвечен голубым пятном. У эталона контурные пилюли `tag tag-outline`. | 1440, скрин 7 | `b ? `<a class="tag tag-outline" href="…" style="text-decoration:none;font-size:13px;padding:6px 12px">${esc(n)}</a>` : `<span class="tag tag-outline" style="font-size:13px;padding:6px 12px;opacity:.7">${esc(n)}</span>``. |
| P2 | «Типовые задачи»: 3 карточки в сетке `auto-fill 280px` → 4 колонки, одна пустая справа. Цена внизу с большим отступом. У эталона — список-карточка «задача / параметры / от N ₽» рядом с блоком «Производители». | 1440, скрин 7 | Сделать как у эталона: `<div class="pk-faq2" style="margin-top:32px"><div class="blueprint" style="padding:20px"><h2 style="font-size:24px;margin:0 0 8px">Типовые задачи</h2>${d.tasks.map(t => `<div style="display:flex;justify-content:space-between;gap:12px;padding:11px 0;border-top:1px solid var(--color-divider)"><div><div style="font-weight:600">${esc(t.t)}</div><div style="font-size:12px;color:var(--color-neutral-600)">${esc(t.d||'')}</div></div><span class="mono" style="white-space:nowrap;font-size:14px">${esc(t.from||'')}</span></div>`).join('')}</div><div class="blueprint" style="padding:20px"><h2 style="font-size:24px;margin:0 0 12px">Производители</h2><div style="display:flex;gap:8px;flex-wrap:wrap">…чипы…</div></div></div>`. Отдельный блок «Производители» ниже убрать. |
| P2 | У всех подкатегорий одна иконка направления, и все ведут на `chat/`. Выглядит как заглушка, для SEO — 7–8 одинаковых ссылок. | 1440 | Ссылку сделать осмысленной: `href="${BASE}chat/?q=${encodeURIComponent(s.name)}"`. Иконку убрать (у эталона её нет): удалить `<span class="ico ico-20 …">`. Счётчик — `class="mono" style="font-size:12px"`. |
| P2 | «Популярные позиции»: у большинства направлений 0–1 товар. Одна карточка 250px, дальше пустая строка. | 1440 | `pk-lonegrid` + карточка-заглушка, как у бренда («Нужна другая позиция? Разберём заявку списком» → `zayavka-spiskom/`). |
| P2 | Hero: 2 кнопки против 3 у эталона, нет «Открыть каталог». Цифра «2 ч ответ на запрос КП» стоит вместо «производителей». | 1440 | Третья цифра: `${(d.brands||[]).length}` / «производителей». Кнопки: добавить `<a class="btn btn-secondary" href="${BASE}zayavka-spiskom/">Запросить КП</a>`, а «Подобрать в чате» сделать primary с `padding:12px 20px` как у эталона. |
| P3 | Тег кластера над H1 не совпадает по смыслу («Водоподготовка» → «Перекачка, трубопровод, вода»). У эталона вместо тега иконка направления слева от H1. | 1440 | `<h1 style="font-size:40px;margin:0;display:flex;gap:12px;align-items:center">${d.icon ? `<span class="ico ico-32 i-${esc(d.icon)}" style="color:var(--color-accent-700)"></span>` : ''}${esc(d.h1||d.name)}</h1>`, тег убрать. |
| P3 | «Статьи по направлению»: у эталона компактные карточки без фото. У шаблона — с фото 140px, и две статьи с одной обложкой (`a-air`) стоят рядом. | 1440 | Оставить фото, но исключать повтор обложки: `dirArticles.filter((a,i,arr)=>arr.findIndex(x=>x.cover===a.cover)===i)`. |
| P3 | SEO-абзацы без заголовка висят между «Что указать в заявке» и статьями. | 1440 | Перед ними `<h2 style="font-size:24px;margin:32px 0 10px">${esc(d.name)}: цены, наличие и подбор</h2>`. |

## 4. Статьи (`blog/<slug>/`)

Скриншот: 8.

| P | Проблема | Где | Готовая правка |
|---|---|---|---|
| **P1** | Поле 28px на телефоне. | 390 | `pk-main`. |
| P2 | Строка текста ~940px при 17px (≈110 знаков). У эталона колонка ~820px. Читается тяжело. | 1440 | `<article class="pk-prose-col">` (в CSS `max-width:760px` для p, ul, h2), таблица и фото остаются на всю ширину. |
| P2 | FAQ внутри статьи в 3 колонки шириной ~300px: вопросы в 3 строки, карточки разной высоты «лесенкой». | 1440, скрин 8 | Общая правка `faqBlock` (2 колонки). |
| P2 | «Позиции из статьи» без миниатюр и параметров, нет кнопки. У эталона фото 40px, строка параметров, «Открыть в каталоге». | 1440 | В строку: `<a …><span style="width:40px;height:40px;flex:none;background:url(IMGBASE${(p.photos||['p-cr32'])[0]}.jpg) center/contain no-repeat #fff;border-radius:6px"></span><span style="flex:1;min-width:0"><span style="display:block;font-weight:600">${esc(p.name)}</span><span style="font-size:11px;color:var(--color-neutral-600)">${esc((p.specs||[]).slice(1,3).map(s=>s[1]).join(' · '))}</span></span><span class="mono">${rub(p.price)}</span></a>`, после списка — `<a class="btn btn-primary btn-block" href="${BASE + P.product(rp[0])}" style="text-decoration:none;margin-top:10px">Открыть в каталоге</a>`. |
| P2 | «Читайте также»: 3 карточки в сетке `auto-fill 280px` → пустая 4-я колонка справа. | 1440 | `class="pk-lonegrid"` или брать 4 статьи: `.slice(0, 4)`. |
| P2 | На телефоне сайдбар («Позиции из статьи», «Спросить у чата») уходит в конец, после FAQ. Товарный блок в статье не виден. | 390 | Порядок через CSS не переставить: aside идёт после article. В шаблоне после `${body}` вывести копию блока позиций для телефона: `<div class="only-m-block" style="display:none;margin:18px 0">…тот же rp-блок…</div>` (класс `only-m-block` уже есть в app.css), а первому блоку aside дать `class="hide-m"`. |
| P3 | В крошках нет раздела статьи. У эталона: Главная / Блог / Насосы / короткое название. У шаблона полное название на 2 строки на 390. | 390 | `[home, {name:'Блог',href:BASE+'blog/'}, {name:(a.section.split('·')[1]||'').trim()}, {name: a.short || cut(a.title, 40)}]`. |
| P3 | Мета «Проверено инженером сервиса» на 390 переносится отдельной строкой с большим зазором (gap 16px в flex-wrap). | 390 | `gap:4px 16px`. |

---

## Сводка по приоритетам

- **P1 (5 правок, всё безопасно):**
  1. Пустой `.gal` в товаре — чинит порядок «фото → цена» на телефоне у 22 товаров.
  2. Класс `pk-main` — поле 16px.
  3. Класс `pk-hero` в направлениях — одна колонка на телефоне.
  4. Hero бренда с фото, кнопками и KPI.
  5. CSS-блок в `skin.css`.
- **P2:** FAQ на всю ширину и в 2 колонки, счётчик количества, контурные чипы, «Типовые задачи» списком, длина строки статьи, миниатюры в «Позициях из статьи», крошка «Производители», BreadcrumbList.
- **P3:** крошки короче, иконка у H1 направления, дубли обложек, карусель на телефоне.

## Замечания

- Во время проверки `gen_pages.js` правили параллельно: `auto-fit` → `auto-fill` для карточек. Одинокая карточка больше не растягивается на всю ширину. Скриншоты 4 и 7 сняты после пересборки.
- Отзывы и рейтинг в шаблон товара без реальных данных не добавлять.
- Фото-дубли (пункт P2 в товарах) — вопрос данных и генерации фото, не вёрстки.

## Файлы

- Отчёт: `docs/reports/2026-09-14-qa-templates.md`
- Скриншоты: `docs/reports/img-templates/`
  - `1-tovar-390-cena-posle-faq.jpg`
  - `2-tovar-1440-etalon-vs-shablon.jpg`
  - `3-tovar-1440-faq-v-kolonke.jpg`
  - `4-brend-1440-etalon-vs-shablon.jpg`
  - `5-brend-390-etalon-vs-shablon.jpg`
  - `6-napravlenie-390-hero-2-kolonki.jpg`
  - `7-napravlenie-1440-chipy-pustaya-kolonka.jpg`
  - `8-statya-1440-faq-3-kolonki.jpg`
- Правок в `tools/` и `site/` не делал.

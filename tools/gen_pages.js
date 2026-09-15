// Генерация страниц из данных: товары, статьи, направления, производители.
// Данные — tools/data/{products,articles,directions,brands}.json. Вёрстка — на классах дизайн-системы
// (blueprint, table, btn, tag, ico) и слоя skin.css, внутри общего каркаса витрины (шапка/подвал из сборки).
const fs = require('fs');
const path = require('path');
const DATA = path.join(__dirname, 'data');

const load = f => { const p = path.join(DATA, f); try { return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : []; } catch (e) { console.warn('! данные не читаются: ' + f); return []; } };
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rub = n => n == null ? 'по запросу' : String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽';
const cut = (s, n) => { s = String(s || ''); return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…'; };

function paths() {
  return {
    product: p => p.quote ? `katalog/${p.category || 'kompressory'}/${p.slug}/` : `katalog/${p.category}/${p.slug}/`,
    article: a => `blog/${a.slug}/`,
    direction: d => `napravleniya/${d.slug}/`,
    brand: b => `proizvoditeli/${b.slug}/`,
  };
}

// Сопоставление карточек витрины с их страницами (передаётся в браузер при сборке)
function linkIndex(BASE) {
  const P = paths();
  const products = load('products.json'), articles = load('articles.json'), directions = load('directions.json'), brands = load('brands.json');
  return {
    products: products.map(p => ({ names: [p.name, ...(p.aliases || [])].filter(Boolean), href: BASE + P.product(p) })),
    articles: articles.map(a => ({ names: [a.title, ...(a.aliases || [])].filter(Boolean), href: BASE + P.article(a) })),
    directions: directions.map(d => ({ names: [d.name], href: BASE + (d.existing ? 'napravleniya/nasosy/' : P.direction(d)) })),
    brands: brands.map(b => ({ names: [b.name, ...(b.aliases || [])].filter(Boolean), href: BASE + P.brand(b) })),
  };
}

function crumbs(BASE, items) {
  return `<nav aria-label="Хлебные крошки" style="font-size:13px;color:var(--color-neutral-600);display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">` +
    items.map((it, i) => (i ? '<span>/</span>' : '') + (it.href ? `<a href="${it.href}" style="color:inherit;text-decoration:none">${esc(it.name)}</a>` : `<span style="color:var(--color-text)">${esc(it.name)}</span>`)).join('') + '</nav>';
}
const wrap = inner => `<main id="main" class="pk-main">${inner}</main>`;
const faqBlock = faq => !faq || !faq.length ? '' : `<h2 style="font-size:26px;margin:36px 0 14px">Вопросы и ответы</h2>
<div class="pk-faq2">${faq.map(f => `<details class="blueprint faq-item" style="padding:14px 16px"><summary style="font-family:var(--font-heading);font-weight:600;font-size:17px;line-height:1.3"><span>${esc(f.q)}</span><span class="seo-caret" style="margin-top:6px;color:var(--color-accent)"></span></summary><p style="font-size:14px;line-height:1.6;color:var(--color-neutral-800);margin:10px 0 0">${esc(f.a)}</p></details>`).join('')}</div>`;
const img = (id, h, fit = 'cover', extra = '', alt = '') => `<div class="ph${fit === 'cover' ? ' duotone' : ''}" data-photo="1" ${alt ? `role="img" aria-label="${esc(alt)}"` : 'aria-hidden="true"'} style="height:${h}px;background:url(IMGBASE${id}.jpg) center/${fit} no-repeat ${fit === 'contain' ? '#fff' : ''};${extra}"></div>`;


// SEO-блок как в макете: заголовок, вводный абзац, «Читать полностью» (абзацы, таблица, заключение),
// ниже — 8 вопросов двумя колонками по 4.
const seoSection = (seo, faq, heading) => {
  seo = seo || {};
  const items = (faq || []).slice(0, 8);
  const cols = items.length ? [items.slice(0, Math.ceil(items.length / 2)), items.slice(Math.ceil(items.length / 2))] : [];
  const t = seo.table;
  const more = (seo.paras || []).length || t || (seo.tail || []).length;
  return `<section class="pk-seo" style="border-top:1px solid var(--color-divider);margin-top:40px;padding-top:32px;display:flex;flex-direction:column;gap:32px">
  ${seo.heading || seo.intro ? `<div>
    <h2 style="font-size:28px;margin:0 0 12px">${esc(seo.heading || heading || '')}</h2>
    ${seo.intro ? `<p class="seo-p">${esc(seo.intro)}</p>` : ''}
    ${more ? `<details class="seo-more"><summary class="btn btn-secondary"><span class="seo-more-open">Читать полностью</span><span class="seo-more-close">Свернуть текст</span><span class="seo-caret"></span></summary><div>
      ${(seo.paras || []).map(x => `<p class="seo-p">${esc(x)}</p>`).join('')}
      ${t ? `<h3 style="font-size:20px;margin:22px 0 10px">${esc(t.title || '')}</h3><div class="blueprint" style="padding:6px 14px 10px;overflow-x:auto;max-width:920px"><table class="table" style="width:100%"><thead><tr>${(t.head || []).map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${(t.rows || []).map(r => `<tr>${r.map(c => `<td style="font-size:14px">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : ''}
      ${(seo.tail || []).map(x => `<p class="seo-p" style="margin-top:14px">${esc(x)}</p>`).join('')}
    </div></details>` : ''}
  </div>` : ''}
  ${cols.length ? `<div><h2 style="font-size:24px;margin:0 0 16px">Вопросы и ответы</h2>
  <div class="pk-faq-cols">${cols.map(col => `<div style="display:flex;flex-direction:column;gap:10px">${col.map(f => `<details class="blueprint faq-item" style="padding:14px 16px"><summary style="display:grid;grid-template-columns:1fr 16px;gap:12px;align-items:flex-start;font-family:var(--font-heading);font-weight:600;font-size:17px;line-height:1.3;color:var(--color-text)"><span>${esc(f.q)}</span><span class="seo-caret" style="margin-top:6px;color:var(--color-accent)"></span></summary><p style="font-size:14px;line-height:1.6;color:var(--color-neutral-800);margin:10px 0 0">${esc(f.a)}</p></details>`).join('')}</div>`).join('')}</div></div>` : ''}
</section>`;
};

function productCard(BASE, p) {
  const P = paths();
  return `<a href="${BASE + P.product(p)}" class="card blueprint" style="padding:0;gap:0;text-decoration:none;color:inherit">
  ${img((p.photos || ['p-cr32'])[0], 150, 'contain', 'border-bottom:1px solid var(--color-divider)')}
  <div style="padding:12px 14px 14px;display:flex;flex-direction:column;gap:4px">
    <span style="font-size:11px;color:var(--color-neutral-600)">${esc(p.sku)}</span>
    <h3 style="font-family:var(--font-heading);font-weight:600;font-size:17px;line-height:1.3;margin:0">${esc(p.name)}</h3>
    <span style="font-size:13px;color:var(--color-neutral-700)">${esc(p.stock || '')}</span>
    <span class="mono" style="font-size:19px;margin-top:4px">${rub(p.price)}</span>
  </div></a>`;
}
function articleCard(BASE, a) {
  return `<a href="${BASE}blog/${a.slug}/" class="blueprint" style="display:flex;flex-direction:column;text-decoration:none;color:inherit">
  ${img(a.cover || 'blog-boiler', 140, 'cover')}
  <div style="padding:14px 16px;display:flex;flex-direction:column;gap:6px">
    <span style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--color-accent-700)">${esc(a.section)}</span>
    <h3 style="font-family:var(--font-heading);font-weight:600;font-size:18px;line-height:1.25;margin:0">${esc(a.title)}</h3>
    <span style="font-size:13px;color:var(--color-neutral-700)">${esc(cut(a.lead, 140))}</span>
  </div></a>`;
}

const CAT2DIR = { nasosy: 'Насосы', armatura: 'Промышленная арматура', privod: 'Редукторы и мотор-редукторы', podshipniki: 'Подшипники и комплектующие', kompressory: 'Компрессоры', elektrika: 'Частотники и автоматика', pnevmatika: 'Пневматика', zapchasti: 'Запчасти для производства' };
const dirName = p => CAT2DIR[p.category] || p.categoryName;
// «подбор <чего>» по категории товара — для анкоров с ключом
const CAT2PL = { nasosy: 'насосов', privod: 'мотор-редукторов', podshipniki: 'подшипников', kompressory: 'компрессоров', elektrika: 'частотных преобразователей' };
const CAT2GEN = { nasosy: 'насоса', armatura: 'арматуры', privod: 'мотор-редуктора', podshipniki: 'подшипника', kompressory: 'компрессора', elektrika: 'частотного преобразователя', pnevmatika: 'пневмооборудования', zapchasti: 'запчастей' };

// ── общие данные и хелперы перелинковки ──
const H2 = (t, extra = '') => `<h2 style="font-size:26px;margin:40px 0 14px${extra}">${t}</h2>`;
const H3 = 'font-family:var(--font-heading);font-weight:600;margin:0;';
const dirHref = (BASE, d) => BASE + (d.existing ? 'napravleniya/nasosy/' : `napravleniya/${d.slug}/`);
const brandProfile = b => /подшип/i.test(b.h1 || '') ? ['Подшипники', 'dir-bearings'] : /частот|преобраз/i.test(b.h1 || '') ? ['Частотные преобразователи', 'dir-vfd'] : /компресс/i.test(b.h1 || '') ? ['Компрессоры', 'dir-compressors'] : /редукт|привод/i.test(b.h1 || '') ? ['Мотор-редукторы', 'dir-gearboxes'] : ['Насосы', 'dir-pumps'];
const nf = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
// плитка-ссылка: иконка + анкор + подпись
const tile = (href, text, sub, ico) => `<a href="${href}" class="blueprint" style="padding:12px 14px;display:flex;gap:10px;align-items:center;text-decoration:none;color:inherit">${ico ? `<span class="ico ico-20 i-${esc(ico)}" style="color:var(--color-accent-700);flex:none"></span>` : ''}<span style="display:flex;flex-direction:column;gap:2px;min-width:0"><span style="font-weight:600;font-size:15px;line-height:1.3">${esc(text)}</span>${sub ? `<span style="font-size:12px;color:var(--color-neutral-600)">${esc(sub)}</span>` : ''}</span></a>`;
const tiles = items => `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px">${items.join('')}</div>`;
const tags = items => `<div style="display:flex;gap:8px;flex-wrap:wrap">${items.join('')}</div>`;
const tagLink = (href, text) => `<a class="tag tag-outline" href="${href}" style="text-decoration:none;font-size:13px;padding:6px 12px">${esc(text)}</a>`;
// статья из макета (экран «article»), которой нет в articles.json
const ROUTE_ARTICLE = { slug: 'kak-podobrat-nasos-po-rabochej-tochke', title: 'Как подобрать насос по рабочей точке и не переплатить за напор', section: 'Подбор · Насосы', cover: 'art-hero', lead: 'Расчёт рабочей точки по факту, кавитация и NPSH, частотное регулирование, материалы и чек-лист из 7 пунктов.', relatedDirections: ['nasosy', 'chastotniki-i-avtomatika'], body: [] };
const topic = a => ((a.section || '').split('·')[1] || a.section || '').trim();
const brandNames = b => [b.name, ...(b.aliases || [])].filter(Boolean);
const mentions = (text, names) => names.some(n => new RegExp(`(^|[^A-Za-zА-Яа-яЁё0-9])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^A-Za-zА-Яа-яЁё0-9])`, n.length <= 4 ? '' : 'i').test(text));
const articleText = a => [a.title, a.lead, ...(a.body || []).map(b => b.h2 || b.p || b.note || (b.ul || []).join(' ') || (b.table ? [...b.table.head, ...b.table.rows.flat()].join(' ') : '')), ...(a.checklist || [])].join(' ');
// направления бренда: где бренд указан в списке brands направления + категории его товаров
function brandDirections(b, directions, products) {
  const names = brandNames(b);
  const fromProducts = products.filter(p => p.brandSlug === b.slug || p.brand === b.name).map(p => directions.find(d => d.name === dirName(p))).filter(Boolean);
  const fromList = directions.filter(d => (d.brands || []).some(n => names.includes(n)));
  const fromProfile = directions.filter(d => d.icon === brandProfile(b)[1]);
  return [...new Set([...fromProfile, ...fromProducts, ...fromList])];
}

module.exports = function genPages(BASE) {
  const P = paths();
  const products = load('products.json'), articles = load('articles.json'), directions = load('directions.json'), brands = load('brands.json');
  const allArticles = articles.some(a => a.slug === ROUTE_ARTICLE.slug) ? articles : [...articles, ROUTE_ARTICLE];
  const bySlug = (arr, s) => arr.find(x => x.slug === s);
  const out = [];
  const home = { name: 'Главная', href: BASE };

  // ── товары ──
  for (const p of products) {
    if (p.existing || p.slug === 'grundfos-cr-32-4' || p.quote) continue;
    const dir = directions.find(d => d.name === dirName(p)) || null;
    const brand = brands.find(b => b.slug === p.brandSlug);
    const photos = (p.photos && p.photos.length ? p.photos : ['p-cr32']);
    const related = (p.related || []).map(s => bySlug(products, s)).filter(Boolean).slice(0, 4);
    const html = wrap(`${crumbs(BASE, [home, { name: dir ? dir.name : (p.categoryName || 'Каталог'), href: dir ? BASE + (dir.existing ? 'napravleniya/nasosy/' : P.direction(dir)) : BASE + 'napravleniya/' }, ...(brand ? [{ name: p.brand, href: BASE + P.brand(brand) }] : []), { name: p.name }])}
<h1 style="font-size:36px;margin:0 0 8px">${esc(p.fullName || p.name)}</h1>
<div style="display:flex;gap:16px;flex-wrap:wrap;font-size:13px;color:var(--color-neutral-700);margin-bottom:22px">
  <span>Артикул ${esc(p.sku)}</span>${p.brand ? `<span>${brand ? `<a href="${BASE + P.brand(brand)}" style="color:inherit">${esc(p.brand)}</a>` : esc(p.brand)}${p.country ? ' · ' + esc(p.country) : ''}</span>` : ''}
  ${p.warranty ? `<span style="display:inline-flex;gap:6px;align-items:center"><span class="ico ico-16 i-warranty-maker" style="color:var(--color-accent-700)"></span>Гарантия ${esc(p.warranty)}</span>` : ''}
</div>
<div class="split">
  <div>
    ${img(photos[0], 380, 'contain', 'border-radius:14px;border:1px solid var(--line);margin-bottom:12px', (p.fullName || p.name) + ' — фото')}
    ${photos.length > 1 ? `<div class="gal" style="display:flex;gap:10px;margin:0 0 24px">${photos.map((ph, i) => `<span style="width:80px;height:80px;display:block;border-radius:8px;border:${i ? '1px solid var(--line)' : '2px solid var(--color-accent)'};background:url(IMGBASE${ph}.jpg) center/contain no-repeat #fff"></span>`).join('')}</div>` : '<div class="gal" style="margin:0 0 12px"></div>'}
    <h2 style="font-size:24px;margin:10px 0 10px">Описание</h2>
    ${p.lead_text ? `<p style="font-size:17px;line-height:1.6;margin:0 0 12px">${esc(p.lead_text)}</p>` : ''}
    ${(p.description || []).map(t => `<p style="font-size:15px;line-height:1.65;color:var(--color-neutral-800);margin:0 0 12px">${esc(t)}</p>`).join('')}
    <h2 style="font-size:24px;margin:26px 0 10px">Характеристики</h2>
    <div class="blueprint" style="padding:4px 16px"><table class="table" style="width:100%"><tbody>${(p.specs || []).map(([k, v]) => `<tr><td style="color:var(--color-neutral-700);width:45%">${esc(k)}</td><td style="font-weight:500">${esc(v)}</td></tr>`).join('')}</tbody></table></div>
    ${p.useCases && p.useCases.length ? `<h2 style="font-size:24px;margin:26px 0 10px">Где применяется</h2><ul style="margin:0;padding-left:20px;font-size:15px;line-height:1.8">${p.useCases.map(u => `<li>${esc(u)}</li>`).join('')}</ul>` : ''}
  </div>
  <aside>
    <div class="blueprint" style="padding:22px">
      <div class="mono" style="font-size:38px;line-height:1">${rub(p.price)}</div>
      <div style="font-size:13px;color:var(--color-neutral-700);margin:6px 0 16px">${p.price == null ? 'Цена рассчитывается под задачу' : 'Цена с НДС, доставка по РФ включена (кроме Дальнего Востока и грузов > 500 кг)'}</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        ${p.price == null ? `<a class="btn btn-primary" href="${BASE}katalog/kompressory/kaishan-lgcy-75/" style="flex:1;min-height:44px;text-decoration:none">Запросить КП</a>` : `<div style="display:flex;gap:10px;width:100%"><div class="seg" style="align-items:stretch"><button type="button" class="seg-opt" data-demo="1" aria-label="Меньше">−</button><span class="seg-opt mono pk-qty" style="min-width:44px;justify-content:center">1</span><button type="button" class="seg-opt" data-demo="1" aria-label="Больше">+</button></div><button class="btn btn-primary" data-demo="1" style="flex:1;min-height:44px">В корзину</button></div><button class="btn btn-secondary btn-block" data-demo="1" style="min-height:42px;margin-top:10px;width:100%">Быстрый счёт</button>`}
      </div>
      <div style="border-top:1px solid var(--color-divider);margin-top:18px;padding-top:12px;display:flex;flex-direction:column;gap:10px;font-size:14px">
        <div style="display:flex;justify-content:space-between;gap:10px"><span style="display:flex;gap:8px;align-items:center;color:var(--color-neutral-700)"><span class="ico ico-16 i-order-shipped"></span>Наличие</span><span>${esc(p.stock || '—')}</span></div>
        <div style="display:flex;justify-content:space-between;gap:10px"><span style="display:flex;gap:8px;align-items:center;color:var(--color-neutral-700)"><span class="ico ico-16 i-log-direct"></span>Отгрузка</span><span>${esc((p.lead || '—').replace(/^Отгрузка\s+/i, '').replace(/^Срок\s+/i, ''))}</span></div>
        <div style="display:flex;justify-content:space-between;gap:10px"><span style="display:flex;gap:8px;align-items:center;color:var(--color-neutral-700)"><span class="ico ico-16 i-pay-card"></span>Оплата</span><span>Счёт, карта, отсрочка</span></div>
      </div>
    </div>
    <div class="blueprint" style="padding:18px 20px;margin-top:16px">
      <div style="display:flex;gap:10px;align-items:center;font-weight:600"><span class="ico i-analog" style="color:var(--color-accent-700)"></span>Нужен аналог дешевле?</div>
      <p style="font-size:14px;color:var(--color-neutral-700);margin:8px 0 12px">Инженер подберёт замену по характеристикам и присоединительным размерам и пришлёт сравнение за 2 часа.</p>
      <a class="btn btn-secondary" href="${BASE}chat/" style="text-decoration:none">Подобрать в чате</a>
    </div>
  </aside>
</div>
${seoSection(p.seo || { heading: (p.name) + ': характеристики и применение', intro: p.lead_text, paras: p.description }, p.faq)}
${related.length ? `<h2 style="font-size:26px;margin:40px 0 14px">С этим товаром смотрят</h2><div class="pk-lonegrid">${related.map(r => productCard(BASE, r)).join('')}</div>` : ''}
${(() => { const arts = articles.filter(a => (a.relatedProducts || []).includes(p.slug)).slice(0, 4); return arts.length ? `<h2 style="font-size:26px;margin:40px 0 14px">Статьи по теме</h2><div class="pk-lonegrid">${arts.map(x => articleCard(BASE, x)).join('')}</div>` : ''; })()}
${(() => { // ещё в разделе: та же категория, иначе тот же бренд; без позиций из «С этим товаром смотрят»
      const skip = new Set([p.slug, ...related.map(r => r.slug)]);
      let more = products.filter(x => x.category === p.category && !skip.has(x.slug)).slice(0, 6), head = `Ещё в разделе «${esc(dir ? dir.name : dirName(p))}»`;
      if (!more.length && brand) { more = products.filter(x => x.brandSlug === brand.slug && !skip.has(x.slug)).slice(0, 6); head = `Ещё ${esc(brand.name)} в каталоге`; }
      return more.length ? H2(head) + `<div class="pk-lonegrid">${more.map(x => productCard(BASE, x)).join('')}</div>` : ''; })()}
${(() => { // смотрите также: направление, бренд, хаб производителей, подбор
      const gen = CAT2GEN[p.category] || 'оборудования';
      const items = [];
      if (dir) items.push(tile(dirHref(BASE, dir), dir.name, `${nf(dir.count)} позиций в каталоге`, dir.icon));
      if (brand) items.push(tile(BASE + P.brand(brand), `${brand.name}: ${brandProfile(brand)[0].toLowerCase()} — серии и цены`, 'Производитель: модели и аналоги', brandProfile(brand)[1]));
      if (p.category === 'nasosy') items.push(tile(BASE + 'katalog/nasosy/', 'Каталог насосов с фильтрами', 'Тип, подача, напор, наличие', 'entry-catalog'));
      items.push(tile(BASE + 'proizvoditeli/', `Производители ${CAT2PL[p.category] || 'оборудования'}`, `${brands.length} производителей в каталоге`, 'entry-list'));
      items.push(tile(BASE + 'chat/', `Подбор ${gen} в чате`, 'Аналог по характеристикам за 2 часа', 'entry-chat'));
      items.push(tile(BASE + 'poisk-po-foto/', `Подбор ${gen} по фото шильдика`, 'Модель и артикул по фото', 'entry-photo'));
      return H2('Смотрите также') + tiles(items.slice(0, 6)); })()}`);
    out.push({ path: P.product(p), index: true, h1: p.fullName || p.name, raw: true, html,
      title: cut(`${p.name}${p.sku ? ' (' + p.sku + ')' : ''}: ${p.price == null ? 'цена по запросу' : 'цена ' + rub(p.price).replace(/ /g, ' ').replace(/ /g, ' ')} — ПРОМКОНТУР`, 70),
      desc: cut(`${p.fullName || p.name}. ${p.lead_text || ''} ${p.stock ? p.stock + '.' : ''} ${p.lead || ''}`.replace(/\s+/g, ' '), 158),
      ld: { '@type': 'Product', name: p.fullName || p.name, sku: p.sku, brand: p.brand ? { '@type': 'Brand', name: p.brand } : undefined, image: photos.map(ph => 'IMGABS' + ph + '.jpg'),
        offers: p.price == null ? undefined : { '@type': 'Offer', price: String(p.price), priceCurrency: 'RUB', availability: /налич|\d\s*шт/.test(p.stock || '') ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder', itemCondition: 'https://schema.org/NewCondition' } },
      faq: p.faq, og: photos[0] });
  }

  // ── статьи ──
  for (const a of articles) {
    const body = (a.body || []).map(b => b.h2 ? `<h2 style="font-size:26px;margin:30px 0 10px">${esc(b.h2)}</h2>`
      : b.p ? `<p style="font-size:17px;line-height:1.7;color:var(--color-neutral-800);margin:0 0 14px">${esc(b.p)}</p>`
      : b.ul ? `<ul style="font-size:16px;line-height:1.7;margin:0 0 14px;padding-left:22px">${b.ul.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`
      : b.table ? `<div class="blueprint" style="padding:4px 14px;margin:6px 0 18px;overflow-x:auto"><table class="table" style="width:100%"><thead><tr>${b.table.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${b.table.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
      : b.note ? `<div style="display:flex;gap:12px;background:color-mix(in srgb,var(--color-accent) 9%,transparent);border-radius:12px;padding:14px 16px;margin:8px 0 18px"><span class="ico i-engineer" style="color:var(--color-accent-700)"></span><p style="margin:0;font-size:16px;line-height:1.6">${esc(b.note)}</p></div>` : '').join('\n');
    const rp = (a.relatedProducts || []).map(s => bySlug(products, s)).filter(Boolean).slice(0, 4);
    // дальше по теме: тот же раздел, затем общие направления, затем прочие (порядок данных сохраняется)
    const score = x => (topic(x) === topic(a) ? 4 : 0) + (x.relatedDirections || []).filter(s => (a.relatedDirections || []).includes(s)).length;
    const ra = allArticles.filter(x => x.slug !== a.slug).map((x, i) => [x, score(x), i]).sort((x, y) => y[1] - x[1] || x[2] - y[2]).map(x => x[0]).slice(0, 6);
    const rd = (a.relatedDirections || []).map(s => bySlug(directions, s)).filter(Boolean);
    const date = new Date(a.date + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    const html = wrap(`${crumbs(BASE, [home, { name: 'Блог', href: BASE + 'blog/' }, { name: cut(a.title, 42) }])}
<div style="display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:40px;align-items:start" class="pk-article">
<article class="pk-prose-col">
  <span class="tag tag-accent">${esc(a.section)}</span>
  <h1 style="font-size:40px;margin:12px 0 10px;text-wrap:pretty">${esc(a.title)}</h1>
  <div style="font-size:13px;color:var(--color-neutral-700);display:flex;gap:4px 16px;flex-wrap:wrap;margin-bottom:18px"><span>${date}</span><span>${a.readMin || 6} мин чтения</span><span>Проверено инженером сервиса</span></div>
  <p style="font-size:19px;line-height:1.6;margin:0 0 20px">${esc(a.lead)}</p>
  <div class="duotone ph" data-photo="1" style="height:340px;border-radius:14px;background:url(IMGBASE${a.cover || 'blog-boiler'}.jpg) center/cover no-repeat;margin:0 0 22px"></div>
  ${body}
  ${a.checklist && a.checklist.length ? `<div class="blueprint" style="padding:18px 22px;margin:24px 0"><h2 style="font-size:22px;margin:0 0 10px">Чек-лист</h2><ul style="list-style:none;padding:0;margin:0">${a.checklist.map(c => `<li style="display:flex;gap:10px;padding:7px 0;font-size:16px"><span class="ico ico-20 i-ui-approval" style="color:var(--color-accent-700);margin-top:2px"></span>${esc(c)}</li>`).join('')}</ul></div>` : ''}
</article>
<aside style="position:sticky;top:132px;display:flex;flex-direction:column;gap:16px">
  ${rp.length ? `<div class="blueprint" style="padding:16px 18px"><div style="font-weight:600;margin-bottom:8px">Позиции из статьи</div>${rp.map(p => `<a href="${BASE + P.product(p)}" style="display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid var(--color-divider);text-decoration:none;color:inherit;font-size:14px"><span>${esc(p.name)}</span><span class="mono">${rub(p.price)}</span></a>`).join('')}</div>` : ''}
  ${rd.length ? `<div class="blueprint" style="padding:16px 18px"><div style="font-weight:600;margin-bottom:8px">Разделы каталога</div>${rd.map(d => `<a href="${BASE + (d.existing ? 'napravleniya/nasosy/' : P.direction(d))}" style="display:flex;gap:8px;align-items:center;padding:7px 0;text-decoration:none;color:inherit;font-size:14px"><span class="ico ico-20 ${esc(d.icon ? 'i-' + d.icon : '')}" style="color:var(--color-accent-700)"></span>${esc(d.name)}</a>`).join('')}</div>` : ''}
  <div class="blueprint" style="padding:16px 18px"><div style="font-weight:600">Спросить у чата</div><p style="font-size:14px;color:var(--color-neutral-700);margin:6px 0 10px">Чат знает эту статью и подберёт позиции под вашу задачу.</p><a class="btn btn-primary" href="${BASE}chat/" style="text-decoration:none">Открыть чат</a></div>
</aside>
</div>
${seoSection(a.seoBlock, a.faq, a.title)}
${ra.length ? H2(`Что почитать дальше по теме «${esc(topic(a))}»`) + `<div class="pk-lonegrid">${ra.map(x => articleCard(BASE, x)).join('')}</div>` : ''}
${H2('Подобрать оборудование') + tiles([
  ...rd.slice(0, 3).map(d => tile(dirHref(BASE, d), `${d.name}: цены и наличие`, `${nf(d.count)} позиций · ${d.cluster}`, d.icon)),
  tile(BASE + 'chat/', 'Подбор оборудования в чате', `${topic(a)}: опишите задачу — чат подберёт позиции`, 'entry-chat'),
  tile(BASE + 'poisk-po-foto/', 'Поиск оборудования по фото шильдика', 'Модель и аналог по фото', 'entry-photo'),
  tile(BASE + 'zayavka-spiskom/', 'Заявка на оборудование списком', 'Excel → спецификация с ценами', 'entry-upload'),
])}`);
    out.push({ path: P.article(a), index: true, h1: a.title, raw: true, html, type: 'article',
      title: cut(`${a.title} — ПРОМКОНТУР`, 72), desc: cut(a.lead, 158), faq: a.faq, og: a.cover,
      ld: { '@type': 'Article', headline: a.title, description: cut(a.lead, 200), datePublished: a.date, inLanguage: 'ru', image: 'IMGABS' + (a.cover || 'blog-boiler') + '.jpg', author: { '@type': 'Organization', name: 'ПРОМКОНТУР' } } });
  }

  // ── направления ──
  for (const d of directions) {
    if (d.existing) continue;
    const dirProducts = products.filter(p => dirName(p) === d.name).slice(0, 8);
    const dirArticles = articles.filter(a => (a.relatedDirections || []).includes(d.slug)).slice(0, 3);
    const dirBrands = (d.brands || []).map(n => ({ n, b: brands.find(b => b.name === n || (b.aliases || []).includes(n)) }));
    const html = wrap(`${crumbs(BASE, [home, { name: 'Направления', href: BASE + 'napravleniya/' }, { name: d.name }])}
<section class="pk-hero">
  <div style="display:flex;flex-direction:column;gap:12px;justify-content:center">
    <span class="tag tag-accent" style="align-self:flex-start;display:inline-flex;gap:6px;align-items:center">${d.clusterIcon ? `<span class="ico ico-16 i-${esc(d.clusterIcon)}"></span>` : ''}${esc(d.cluster)}</span>
    <h1 style="font-size:40px;margin:0">${esc(d.h1 || d.name)}</h1>
    <p style="font-size:17px;line-height:1.6;color:var(--color-neutral-800);margin:0">${esc(d.intro)}</p>
    <div class="pk-kpi" style="display:flex;gap:28px;flex-wrap:wrap;margin-top:6px">
      <div><div class="mono" style="font-size:28px">${String(d.count).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}</div><div style="font-size:13px;color:var(--color-neutral-700)">позиций в каталоге</div></div>
      <div><div class="mono" style="font-size:28px">${(d.subcats || []).length}</div><div style="font-size:13px;color:var(--color-neutral-700)">подкатегорий</div></div>
      <div><div class="mono" style="font-size:28px">${(d.brands || []).length}</div><div style="font-size:13px;color:var(--color-neutral-700)">производителей</div></div><div><div class="mono" style="font-size:28px">2 ч</div><div style="font-size:13px;color:var(--color-neutral-700)">ответ на запрос КП</div></div>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px"><a class="btn btn-primary" href="${BASE}chat/" style="text-decoration:none">Подобрать в чате</a><a class="btn btn-secondary" href="${BASE}zayavka-spiskom/" style="text-decoration:none">Загрузить заявку списком</a></div>
  </div>
  <div class="duotone ph" data-photo="1" style="min-height:300px;border-radius:14px;background:url(IMGBASE${d.cover || 'warehouse'}.jpg) center/cover no-repeat"></div>
</section>
<h2 style="font-size:26px;margin:0 0 12px">Подкатегории</h2>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px">${(d.subcats || []).map(s => `<a href="${BASE}chat/?q=${encodeURIComponent(s.name)}" class="blueprint" style="padding:14px 16px;display:flex;justify-content:space-between;gap:10px;align-items:center;text-decoration:none;color:inherit"><span style="font-weight:600">${esc(s.name)}</span><span style="font-size:13px;color:var(--color-neutral-600);white-space:nowrap">${String(s.count).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}</span></a>`).join('')}</div>
${(d.tasks || []).length ? `<h2 style="font-size:26px;margin:32px 0 12px">Типовые задачи</h2><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px">${d.tasks.map(t => `<div class="blueprint" style="padding:18px 20px;display:flex;flex-direction:column;gap:8px"><span style="font-family:var(--font-heading);font-weight:600;font-size:18px">${esc(t.t)}</span><span style="font-size:14px;color:var(--color-neutral-700)">${esc(t.d || '')}</span><span class="mono" style="font-size:18px;margin-top:auto">${esc(t.from || '')}</span></div>`).join('')}</div>` : ''}
${dirProducts.length ? `<h2 style="font-size:26px;margin:32px 0 12px">Популярные позиции</h2><div class="pk-lonegrid">${dirProducts.map(p => productCard(BASE, p)).join('')}</div>` : ''}
${dirBrands.length ? `<h2 style="font-size:26px;margin:32px 0 12px">Производители в разделе «${esc(d.name)}»</h2><div style="display:flex;gap:8px;flex-wrap:wrap">${dirBrands.map(({ n, b }) => b ? `<a class="tag tag-outline" href="${BASE}proizvoditeli/${b.slug}/" style="text-decoration:none;font-size:13px;padding:6px 12px">${esc(n)}</a>` : `<span class="tag tag-outline" style="font-size:13px;padding:6px 12px;opacity:.7">${esc(n)}</span>`).join('')}</div>` : ''}
${(d.howto || []).length ? `<h2 style="font-size:26px;margin:32px 0 12px">Что указать в заявке</h2><ol style="font-size:16px;line-height:1.8;padding-left:22px;margin:0">${d.howto.map(h => `<li>${esc(h)}</li>`).join('')}</ol>` : ''}
${dirArticles.length ? `<h2 style="font-size:26px;margin:32px 0 12px">Статьи по направлению</h2><div class="pk-lonegrid">${dirArticles.map(x => articleCard(BASE, x)).join('')}</div>` : ''}
${(() => { // смежные направления кластера и другие кластеры
      const same = directions.filter(x => x.cluster === d.cluster && x.slug !== d.slug);
      const clusters = [...new Set(directions.map(x => x.cluster))].filter(c => c !== d.cluster);
      const other = clusters.slice(0, 5).map(c => { const first = directions.find(x => x.cluster === c); return tile(dirHref(BASE, first), first.name, c, first.clusterIcon); });
      other.push(tile(BASE + 'napravleniya/', `Все ${directions.length} направлений каталога`, 'Каталог промышленного оборудования', 'entry-catalog'));
      return (same.length ? `<h2 style="font-size:26px;margin:32px 0 12px">Смежные направления кластера «${esc(d.cluster)}»</h2>` + tiles(same.slice(0, 12).map(x => tile(dirHref(BASE, x), x.name, `${nf(x.count)} позиций`, x.icon))) : '')
        + `<h2 style="font-size:26px;margin:32px 0 12px">Другие кластеры каталога</h2>` + tiles(other); })()}
${seoSection(d.seoBlock || { heading: d.name + ': цены, наличие и подбор', intro: (d.seo || [])[0], paras: (d.seo || []).slice(1) }, d.faq)}`);
    out.push({ path: P.direction(d), index: true, h1: d.h1 || d.name, raw: true, html, faq: d.faq, og: d.cover,
      title: cut(`${d.h1 || d.name}: купить с доставкой, ${d.count} позиций — ПРОМКОНТУР`, 72), desc: cut(d.intro, 158) });
  }

  // ── производители ──
  for (const b of brands) {
    if (b.existing || b.slug === 'grundfos') continue;
    const bp = products.filter(p => p.brandSlug === b.slug || p.brand === b.name).slice(0, 8);
    const html = wrap(`${crumbs(BASE, [home, { name: 'Производители', href: BASE + 'proizvoditeli/' }, { name: b.name }])}
<section class="pk-hero"><div style="display:flex;flex-direction:column;gap:12px;justify-content:center"><h1 style="font-size:40px;margin:0">${esc(b.h1 || b.name)}</h1><p style="font-size:17px;line-height:1.6;margin:0">${esc(b.intro)}</p><div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn btn-primary" href="#series" style="text-decoration:none">Серии ${esc(b.name)}</a><a class="btn btn-secondary" href="${BASE}chat/" style="text-decoration:none">Подобрать аналог</a><a class="btn btn-secondary" href="${BASE}poisk-po-foto/" style="text-decoration:none">Найти по шильдику</a></div><div class="pk-kpi" style="display:flex;gap:28px;flex-wrap:wrap;border-top:1px solid var(--color-divider);padding-top:14px">${b.country ? `<div><div class="mono" style="font-size:24px">${esc(b.country)}</div><div style="font-size:13px;color:var(--color-neutral-700)">страна</div></div>` : ''}${b.founded ? `<div><div class="mono" style="font-size:24px">${b.founded}</div><div style="font-size:13px;color:var(--color-neutral-700)">год основания</div></div>` : ''}<div><div class="mono" style="font-size:24px">${(b.series || []).reduce((t, x) => t + (+x.count || 0), 0)}</div><div style="font-size:13px;color:var(--color-neutral-700)">позиций в сериях</div></div></div></div><div class="duotone ph" data-photo="1" style="min-height:260px;border-radius:14px;background:url(IMGBASE${bp[0] && bp[0].photos ? bp[0].photos[0] : 'brand'}.jpg) center/contain no-repeat #fff"></div></section>
<p style="font-size:15px;line-height:1.7;color:var(--color-neutral-800);max-width:920px;margin:0 0 24px">${esc(b.positioning)}</p>
<h2 id="series" style="font-size:26px;margin:0 0 12px">Серии</h2>
<div class="blueprint" style="padding:4px 16px;overflow-x:auto"><table class="table" style="width:100%;min-width:720px"><thead><tr><th>Серия</th><th>Тип</th><th>Рабочий диапазон</th><th>Применение</th><th>Позиций</th><th style="text-align:right">Цена от</th></tr></thead><tbody>${(b.series || []).map(s => `<tr><td style="font-weight:600">${esc(s.name)}</td><td>${esc(s.type)}</td><td>${esc(s.range)}</td><td>${esc(s.use)}</td><td>${esc(s.count)}</td><td style="text-align:right;white-space:nowrap">${esc(s.from)}</td></tr>`).join('')}</tbody></table></div>
${bp.length ? `<h2 style="font-size:26px;margin:32px 0 12px">Модели в каталоге</h2><div class="pk-lonegrid">${bp.map(p => productCard(BASE, p)).join('')}</div>` : ''}
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;margin-top:32px">
  <div class="blueprint" style="padding:18px 20px"><div style="display:flex;gap:10px;align-items:center;font-weight:600;margin-bottom:8px"><span class="ico i-dir-spares" style="color:var(--color-accent-700)"></span>Запчасти</div><ul style="margin:0;padding-left:20px;font-size:15px;line-height:1.7">${(b.spares || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
  <div class="blueprint" style="padding:18px 20px"><div style="display:flex;gap:10px;align-items:center;font-weight:600;margin-bottom:8px"><span class="ico i-analog" style="color:var(--color-accent-700)"></span>Аналоги и поставки</div><p style="font-size:15px;line-height:1.6;margin:0 0 8px">${esc(b.analogs)}</p><p style="font-size:14px;color:var(--color-neutral-700);margin:0">${esc(b.availability)}</p></div>
</div>
${(() => { // направления бренда, производители того же профиля, статьи с упоминанием
      const bd = brandDirections(b, directions, products).slice(0, 9);
      const [prof] = brandProfile(b);
      let peers = brands.filter(x => x.slug !== b.slug && brandProfile(x)[0] === prof), peersHead = `Другие производители: ${prof.toLowerCase()}`;
      if (!peers.length) { peers = brands.filter(x => x.slug !== b.slug && brandProfile(x)[0] !== prof).filter((x, i, arr) => arr.findIndex(y => brandProfile(y)[0] === brandProfile(x)[0]) === i); peersHead = 'Производители других направлений'; }
      const names = brandNames(b);
      // статьи: прямое упоминание бренда в тексте → статьи о его позициях → статьи по его направлениям
      const bSlugs = products.filter(p => p.brandSlug === b.slug).map(p => p.slug), bdSlugs = bd.map(x => x.slug);
      let arts = allArticles.filter(a => a.body.length && mentions(articleText(a), names)), artsHead = `Статьи, где упоминается ${esc(b.name)}`;
      if (!arts.length) { arts = articles.filter(a => (a.relatedProducts || []).some(s => bSlugs.includes(s))); artsHead = `Статьи о продукции ${esc(b.name)}`; }
      if (!arts.length) { arts = allArticles.filter(a => (a.relatedDirections || [])[0] && bdSlugs.includes(a.relatedDirections[0])); artsHead = `Статьи по теме «${esc(bd[0] ? bd[0].name : prof)}»`; }
      arts = arts.slice(0, 4);
      return (bd.length ? `<h2 style="font-size:26px;margin:36px 0 12px">Направления с продукцией ${esc(b.name)}</h2>` + tiles(bd.map(x => tile(dirHref(BASE, x), x.name, `${nf(x.count)} позиций · ${x.cluster}`, x.icon))) : '')
        + (peers.length ? `<h2 style="font-size:26px;margin:36px 0 12px">${esc(peersHead)}</h2>` + tags([...peers.slice(0, 11).map(x => tagLink(BASE + P.brand(x), x.h1 || x.name)), tagLink(BASE + 'proizvoditeli/', `Все ${brands.length} производителей`)]) : '')
        + (arts.length ? `<h2 style="font-size:26px;margin:36px 0 12px">${artsHead}</h2><div class="pk-lonegrid">${arts.map(x => articleCard(BASE, x)).join('')}</div>` : ''); })()}
${seoSection(b.seo || { heading: (b.h1 || b.name) + ': серии, цены и аналоги', intro: b.positioning }, b.faq)}`);
    out.push({ path: P.brand(b), index: true, h1: b.h1 || b.name, raw: true, html, faq: b.faq,
      title: cut(`${b.h1 || b.name}: серии, цены и аналоги — ПРОМКОНТУР`, 70), desc: cut(b.intro, 158) });
  }
  // ── хаб производителей ──
  {
    const groups = {};
    for (const b of brands) { const [g, ic] = brandProfile(b); (groups[g] = groups[g] || { ic, items: [] }).items.push(b); }
    const html = wrap(`${crumbs(BASE, [home, { name: 'Производители' }])}
<h1 style="font-size:40px;margin:0 0 10px">Производители оборудования</h1>
<p style="font-size:17px;line-height:1.6;color:var(--color-neutral-800);max-width:820px;margin:0 0 26px">${brands.length} производителей в каталоге: серии, рабочие диапазоны, запчасти и аналоги. Поставки через независимых поставщиков в РФ, цена с НДС и доставкой.</p>
${Object.entries(groups).map(([g, { ic, items }]) => `<h2 style="font-size:24px;margin:28px 0 12px;display:flex;gap:10px;align-items:center"><span class="ico ico-28 i-${ic}" style="color:var(--color-accent-700)"></span>${esc(g)} <span style="font-size:15px;color:var(--color-neutral-600);font-weight:400">${items.length}</span></h2>
<div class="pk-lonegrid" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr))">${items.map(b => { const bd = brandDirections(b, directions, products).slice(0, 3); return `<div class="blueprint" style="padding:18px 20px;display:flex;flex-direction:column;gap:10px">
  <a href="${BASE}proizvoditeli/${b.slug}/" style="display:flex;flex-direction:column;gap:8px;text-decoration:none;color:inherit;flex:1">
  <span style="display:flex;gap:12px;align-items:center"><span style="width:40px;height:40px;border-radius:10px;background:var(--color-accent);color:#fff;display:grid;place-items:center;flex:none"><span class="ico ico-20 i-${ic}"></span></span><h3 style="${H3}font-size:21px;line-height:1.2">${esc(b.name)}</h3></span>
  <span style="font-size:13px;color:var(--color-neutral-700)">${esc([b.country, b.founded ? 'с ' + b.founded + ' г.' : ''].filter(Boolean).join(' · '))}</span>
  <span style="font-size:14px;line-height:1.5;color:var(--color-neutral-800)">${esc(cut(b.intro, 130))}</span>
  <span style="font-size:13px;color:var(--color-accent-700);margin-top:auto">${(b.series || []).length} серий · ${(b.series || []).reduce((t, x) => t + (+x.count || 0), 0)} позиций</span>
  </a>
  ${bd.length ? `<span style="font-size:12px;line-height:1.5;color:var(--color-neutral-600);border-top:1px solid var(--color-divider);padding-top:8px">Направления: ${bd.map(x => `<a href="${dirHref(BASE, x)}" style="color:var(--color-neutral-700)">${esc(x.name)}</a>`).join(', ')}</span>` : ''}
</div>`; }).join('')}</div>`).join('\n')}`);
    out.push({ path: 'proizvoditeli/', index: true, h1: 'Производители оборудования', raw: true, html, og: 'brand',
      title: 'Производители промышленного оборудования: насосы, подшипники, приводы — ПРОМКОНТУР', desc: cut(`${brands.length} производителей в каталоге ПРОМКОНТУР: Grundfos, Wilo, CNP, Ebara, SKF, NORD, INNOVERT, Kaishan и отечественные заводы. Серии, цены и аналоги.`, 158) });
  }
  return out;
};
module.exports.linkIndex = linkIndex;
// карточки статей, которых нет на экране блога из макета
module.exports.blogExtra = (BASE, pageHtml) => {
  const norm = t => String(t).replace(/[\s\u00A0\u202F]+/g, ' ').toLowerCase();
  const page = norm(pageHtml);
  // уже есть на экране блога — по ссылке или по заголовку (&nbsp; в разметке макета → пробел)
  const rest = load('articles.json').filter(a => !pageHtml.includes(`blog/${a.slug}/"`) && !page.replace(/&nbsp;|&#160;/g, ' ').includes(norm(a.title)));
  if (!rest.length) return '';
  // группы по разделу (вторая часть section): h2 — раздел, h3 — заголовки карточек
  const groups = new Map();
  for (const a of rest) { const t = topic(a) || 'Статьи'; if (!groups.has(t)) groups.set(t, []); groups.get(t).push(a); }
  return `<section style="max-width:1360px;margin:0 auto;padding:8px 28px 40px"><p style="font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:var(--color-neutral-600);margin:0 0 4px">Ещё статьи по разделам</p>${[...groups].map(([t, list], i) => `<h2 style="font-size:24px;margin:${i ? 28 : 0}px 0 14px">${esc(t)} <span style="font-size:15px;color:var(--color-neutral-600);font-weight:400">${list.length}</span></h2><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px">${list.map(a => articleCard(BASE, a)).join('')}</div>`).join('')}</section>`;
};

module.exports.helpers = { esc, rub, cut, crumbs, img, faqBlock, seoSection, productCard, articleCard };
module.exports.load = load;

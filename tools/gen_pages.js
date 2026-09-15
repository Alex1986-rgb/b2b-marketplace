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
const wrap = inner => `<main style="max-width:1360px;margin:0 auto;padding:22px 28px 56px">${inner}</main>`;
const faqBlock = faq => !faq || !faq.length ? '' : `<h2 style="font-size:26px;margin:36px 0 14px">Вопросы и ответы</h2>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px;align-items:start">${faq.map(f => `<details class="blueprint faq-item" style="padding:14px 16px"><summary style="font-family:var(--font-heading);font-weight:600;font-size:17px;line-height:1.3"><span>${esc(f.q)}</span><span class="seo-caret" style="margin-top:6px;color:var(--color-accent)"></span></summary><p style="font-size:14px;line-height:1.6;color:var(--color-neutral-800);margin:10px 0 0">${esc(f.a)}</p></details>`).join('')}</div>`;
const img = (id, h, fit = 'cover', extra = '') => `<div class="ph${fit === 'cover' ? ' duotone' : ''}" data-photo="1" style="height:${h}px;background:url(IMGBASE${id}.jpg) center/${fit} no-repeat ${fit === 'contain' ? '#fff' : ''};${extra}"></div>`;

function productCard(BASE, p) {
  const P = paths();
  return `<a href="${BASE + P.product(p)}" class="card blueprint" style="padding:0;gap:0;text-decoration:none;color:inherit">
  ${img((p.photos || ['p-cr32'])[0], 150, 'contain', 'border-bottom:1px solid var(--color-divider)')}
  <div style="padding:12px 14px 14px;display:flex;flex-direction:column;gap:4px">
    <span style="font-size:11px;color:var(--color-neutral-600)">${esc(p.sku)}</span>
    <span style="font-family:var(--font-heading);font-weight:600;font-size:17px">${esc(p.name)}</span>
    <span style="font-size:13px;color:var(--color-neutral-700)">${esc(p.stock || '')}</span>
    <span class="mono" style="font-size:19px;margin-top:4px">${rub(p.price)}</span>
  </div></a>`;
}
function articleCard(BASE, a) {
  return `<a href="${BASE}blog/${a.slug}/" class="blueprint" style="display:flex;flex-direction:column;text-decoration:none;color:inherit">
  ${img(a.cover || 'blog-boiler', 140, 'cover')}
  <div style="padding:14px 16px;display:flex;flex-direction:column;gap:6px">
    <span style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--color-accent-700)">${esc(a.section)}</span>
    <span style="font-family:var(--font-heading);font-weight:600;font-size:18px;line-height:1.25">${esc(a.title)}</span>
    <span style="font-size:13px;color:var(--color-neutral-700)">${esc(cut(a.lead, 140))}</span>
  </div></a>`;
}

const CAT2DIR = { nasosy: 'Насосы', armatura: 'Промышленная арматура', privod: 'Редукторы и мотор-редукторы', podshipniki: 'Подшипники и комплектующие', kompressory: 'Компрессоры', elektrika: 'Частотники и автоматика', pnevmatika: 'Пневматика', zapchasti: 'Запчасти для производства' };
const dirName = p => CAT2DIR[p.category] || p.categoryName;
module.exports = function genPages(BASE) {
  const P = paths();
  const products = load('products.json'), articles = load('articles.json'), directions = load('directions.json'), brands = load('brands.json');
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
    ${img(photos[0], 380, 'contain', 'border-radius:14px;border:1px solid var(--line);margin-bottom:12px')}
    ${photos.length > 1 ? `<div class="gal" style="display:flex;gap:10px;margin:0 0 24px">${photos.map((ph, i) => `<span style="width:80px;height:80px;display:block;border-radius:8px;border:${i ? '1px solid var(--line)' : '2px solid var(--color-accent)'};background:url(IMGBASE${ph}.jpg) center/contain no-repeat #fff"></span>`).join('')}</div>` : '<div style="height:12px"></div>'}
    <h2 style="font-size:24px;margin:10px 0 10px">Описание</h2>
    ${p.lead_text ? `<p style="font-size:17px;line-height:1.6;margin:0 0 12px">${esc(p.lead_text)}</p>` : ''}
    ${(p.description || []).map(t => `<p style="font-size:15px;line-height:1.65;color:var(--color-neutral-800);margin:0 0 12px">${esc(t)}</p>`).join('')}
    <h2 style="font-size:24px;margin:26px 0 10px">Характеристики</h2>
    <div class="blueprint" style="padding:4px 16px"><table class="table" style="width:100%"><tbody>${(p.specs || []).map(([k, v]) => `<tr><td style="color:var(--color-neutral-700);width:45%">${esc(k)}</td><td style="font-weight:500">${esc(v)}</td></tr>`).join('')}</tbody></table></div>
    ${p.useCases && p.useCases.length ? `<h2 style="font-size:24px;margin:26px 0 10px">Где применяется</h2><ul style="margin:0;padding-left:20px;font-size:15px;line-height:1.8">${p.useCases.map(u => `<li>${esc(u)}</li>`).join('')}</ul>` : ''}
    ${faqBlock(p.faq)}
  </div>
  <aside>
    <div class="blueprint" style="padding:22px">
      <div class="mono" style="font-size:34px;line-height:1.1">${rub(p.price)}</div>
      <div style="font-size:13px;color:var(--color-neutral-700);margin:6px 0 16px">${p.price == null ? 'Цена рассчитывается под задачу' : 'Цена с НДС, доставка по РФ включена (кроме Дальнего Востока и грузов > 500 кг)'}</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        ${p.price == null ? `<a class="btn btn-primary" href="${BASE}katalog/kompressory/kaishan-lgcy-75/" style="flex:1;min-height:44px;text-decoration:none">Запросить КП</a>` : `<button class="btn btn-primary" data-demo="1" style="flex:1;min-height:44px">В корзину</button><button class="btn btn-secondary" data-demo="1" style="min-height:44px">Быстрый счёт</button>`}
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
${related.length ? `<h2 style="font-size:26px;margin:40px 0 14px">С этим товаром смотрят</h2><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px">${related.map(r => productCard(BASE, r)).join('')}</div>` : ''}`);
    out.push({ path: P.product(p), index: true, h1: p.fullName || p.name, raw: true, html,
      title: cut(`${p.name}${p.sku ? ' (' + p.sku + ')' : ''}: ${p.price == null ? 'цена по запросу' : 'цена ' + rub(p.price).replace(/ /g, ' ').replace(/ /g, ' ')} — ПРОМКОНТУР`, 70),
      desc: cut(`${p.fullName || p.name}. ${p.lead_text || ''} ${p.stock ? p.stock + '.' : ''} ${p.lead || ''}`.replace(/\s+/g, ' '), 158),
      ld: { '@type': 'Product', name: p.fullName || p.name, sku: p.sku, brand: p.brand ? { '@type': 'Brand', name: p.brand } : undefined, image: photos.map(ph => 'IMGABS' + ph + '.jpg'),
        offers: p.price == null ? undefined : { '@type': 'Offer', price: String(p.price), priceCurrency: 'RUB', availability: /налич/.test(p.stock || '') ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder', itemCondition: 'https://schema.org/NewCondition' } },
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
    const ra = articles.filter(x => x.slug !== a.slug).sort((x, y) => (y.section.split('·')[1] === a.section.split('·')[1]) - (x.section.split('·')[1] === a.section.split('·')[1])).slice(0, 3);
    const rd = (a.relatedDirections || []).map(s => bySlug(directions, s)).filter(Boolean);
    const date = new Date(a.date + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    const html = wrap(`${crumbs(BASE, [home, { name: 'Блог', href: BASE + 'blog/' }, { name: a.title }])}
<div style="display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:40px;align-items:start" class="pk-article">
<article>
  <span class="tag tag-accent">${esc(a.section)}</span>
  <h1 style="font-size:40px;margin:12px 0 10px;text-wrap:pretty">${esc(a.title)}</h1>
  <div style="font-size:13px;color:var(--color-neutral-700);display:flex;gap:16px;flex-wrap:wrap;margin-bottom:18px"><span>${date}</span><span>${a.readMin || 6} мин чтения</span><span>Проверено инженером сервиса</span></div>
  <p style="font-size:19px;line-height:1.6;margin:0 0 20px">${esc(a.lead)}</p>
  <div class="duotone ph" data-photo="1" style="height:340px;border-radius:14px;background:url(IMGBASE${a.cover || 'blog-boiler'}.jpg) center/cover no-repeat;margin:0 0 22px"></div>
  ${body}
  ${a.checklist && a.checklist.length ? `<div class="blueprint" style="padding:18px 22px;margin:24px 0"><h2 style="font-size:22px;margin:0 0 10px">Чек-лист</h2><ul style="list-style:none;padding:0;margin:0">${a.checklist.map(c => `<li style="display:flex;gap:10px;padding:7px 0;font-size:16px"><span class="ico ico-20 i-ui-approval" style="color:var(--color-accent-700);margin-top:2px"></span>${esc(c)}</li>`).join('')}</ul></div>` : ''}
  ${faqBlock(a.faq)}
</article>
<aside style="position:sticky;top:132px;display:flex;flex-direction:column;gap:16px">
  ${rp.length ? `<div class="blueprint" style="padding:16px 18px"><div style="font-weight:600;margin-bottom:8px">Позиции из статьи</div>${rp.map(p => `<a href="${BASE + P.product(p)}" style="display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid var(--color-divider);text-decoration:none;color:inherit;font-size:14px"><span>${esc(p.name)}</span><span class="mono">${rub(p.price)}</span></a>`).join('')}</div>` : ''}
  ${rd.length ? `<div class="blueprint" style="padding:16px 18px"><div style="font-weight:600;margin-bottom:8px">Разделы каталога</div>${rd.map(d => `<a href="${BASE + (d.existing ? 'napravleniya/nasosy/' : P.direction(d))}" style="display:flex;gap:8px;align-items:center;padding:7px 0;text-decoration:none;color:inherit;font-size:14px"><span class="ico ico-20 ${esc(d.icon ? 'i-' + d.icon : '')}" style="color:var(--color-accent-700)"></span>${esc(d.name)}</a>`).join('')}</div>` : ''}
  <div class="blueprint" style="padding:16px 18px"><div style="font-weight:600">Спросить у чата</div><p style="font-size:14px;color:var(--color-neutral-700);margin:6px 0 10px">Чат знает эту статью и подберёт позиции под вашу задачу.</p><a class="btn btn-primary" href="${BASE}chat/" style="text-decoration:none">Открыть чат</a></div>
</aside>
</div>
${ra.length ? `<h2 style="font-size:26px;margin:40px 0 14px">Читайте также</h2><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px">${ra.map(x => articleCard(BASE, x)).join('')}</div>` : ''}`);
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
<section style="display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,.8fr);gap:28px;align-items:stretch;margin-bottom:28px">
  <div style="display:flex;flex-direction:column;gap:12px;justify-content:center">
    <span class="tag tag-accent" style="align-self:flex-start;display:inline-flex;gap:6px;align-items:center">${d.clusterIcon ? `<span class="ico ico-16 i-${esc(d.clusterIcon)}"></span>` : ''}${esc(d.cluster)}</span>
    <h1 style="font-size:40px;margin:0">${esc(d.h1 || d.name)}</h1>
    <p style="font-size:17px;line-height:1.6;color:var(--color-neutral-800);margin:0">${esc(d.intro)}</p>
    <div style="display:flex;gap:28px;flex-wrap:wrap;margin-top:6px">
      <div><div class="mono" style="font-size:28px">${String(d.count).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}</div><div style="font-size:13px;color:var(--color-neutral-700)">позиций в каталоге</div></div>
      <div><div class="mono" style="font-size:28px">${(d.subcats || []).length}</div><div style="font-size:13px;color:var(--color-neutral-700)">подкатегорий</div></div>
      <div><div class="mono" style="font-size:28px">2 ч</div><div style="font-size:13px;color:var(--color-neutral-700)">ответ на запрос КП</div></div>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px"><a class="btn btn-primary" href="${BASE}chat/" style="text-decoration:none">Подобрать в чате</a><a class="btn btn-secondary" href="${BASE}zayavka-spiskom/" style="text-decoration:none">Загрузить заявку списком</a></div>
  </div>
  <div class="duotone ph" data-photo="1" style="min-height:300px;border-radius:14px;background:url(IMGBASE${d.cover || 'warehouse'}.jpg) center/cover no-repeat"></div>
</section>
<h2 style="font-size:26px;margin:0 0 12px">Подкатегории</h2>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px">${(d.subcats || []).map(s => `<a href="${BASE}chat/" class="blueprint" style="padding:14px 16px;display:flex;justify-content:space-between;gap:10px;align-items:center;text-decoration:none;color:inherit"><span style="display:flex;gap:10px;align-items:center;font-weight:600"><span class="ico ico-20 ${d.icon ? 'i-' + esc(d.icon) : ''}" style="color:var(--color-accent-700)"></span>${esc(s.name)}</span><span style="font-size:13px;color:var(--color-neutral-600);white-space:nowrap">${String(s.count).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}</span></a>`).join('')}</div>
${(d.tasks || []).length ? `<h2 style="font-size:26px;margin:32px 0 12px">Типовые задачи</h2><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px">${d.tasks.map(t => `<div class="blueprint" style="padding:18px 20px;display:flex;flex-direction:column;gap:8px"><span style="font-family:var(--font-heading);font-weight:600;font-size:18px">${esc(t.t)}</span><span style="font-size:14px;color:var(--color-neutral-700)">${esc(t.d || '')}</span><span class="mono" style="font-size:18px;margin-top:auto">${esc(t.from || '')}</span></div>`).join('')}</div>` : ''}
${dirProducts.length ? `<h2 style="font-size:26px;margin:32px 0 12px">Популярные позиции</h2><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px">${dirProducts.map(p => productCard(BASE, p)).join('')}</div>` : ''}
${dirBrands.length ? `<h2 style="font-size:26px;margin:32px 0 12px">Производители</h2><div style="display:flex;gap:8px;flex-wrap:wrap">${dirBrands.map(({ n, b }) => b ? `<a class="tag tag-accent" href="${BASE}proizvoditeli/${b.slug}/" style="text-decoration:none;font-size:14px;padding:6px 14px">${esc(n)}</a>` : `<span class="tag tag-neutral" style="font-size:14px;padding:6px 14px">${esc(n)}</span>`).join('')}</div>` : ''}
${(d.howto || []).length ? `<h2 style="font-size:26px;margin:32px 0 12px">Что указать в заявке</h2><ol style="font-size:16px;line-height:1.8;padding-left:22px;margin:0">${d.howto.map(h => `<li>${esc(h)}</li>`).join('')}</ol>` : ''}
${(d.seo || []).length ? `<div style="max-width:920px;margin-top:32px">${d.seo.map(t => `<p style="font-size:15px;line-height:1.7;color:var(--color-neutral-800);margin:0 0 12px">${esc(t)}</p>`).join('')}</div>` : ''}
${dirArticles.length ? `<h2 style="font-size:26px;margin:32px 0 12px">Статьи по направлению</h2><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px">${dirArticles.map(x => articleCard(BASE, x)).join('')}</div>` : ''}
${faqBlock(d.faq)}`);
    out.push({ path: P.direction(d), index: true, h1: d.h1 || d.name, raw: true, html, faq: d.faq, og: d.cover,
      title: cut(`${d.h1 || d.name}: купить с доставкой, ${d.count} позиций — ПРОМКОНТУР`, 72), desc: cut(d.intro, 158) });
  }

  // ── производители ──
  for (const b of brands) {
    if (b.existing || b.slug === 'grundfos') continue;
    const bp = products.filter(p => p.brandSlug === b.slug || p.brand === b.name).slice(0, 8);
    const html = wrap(`${crumbs(BASE, [home, { name: 'Производители', href: BASE + 'proizvoditeli/grundfos/' }, { name: b.name }])}
<h1 style="font-size:40px;margin:0 0 10px">${esc(b.h1 || b.name)}</h1>
<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:14px;color:var(--color-neutral-700);margin-bottom:16px">${b.country ? `<span>${esc(b.country)}</span>` : ''}${b.founded ? `<span>с ${b.founded} года</span>` : ''}</div>
<p style="font-size:18px;line-height:1.6;max-width:920px;margin:0 0 12px">${esc(b.intro)}</p>
<p style="font-size:15px;line-height:1.7;color:var(--color-neutral-800);max-width:920px;margin:0 0 24px">${esc(b.positioning)}</p>
<h2 style="font-size:26px;margin:0 0 12px">Серии</h2>
<div class="blueprint" style="padding:4px 16px;overflow-x:auto"><table class="table" style="width:100%;min-width:720px"><thead><tr><th>Серия</th><th>Тип</th><th>Рабочий диапазон</th><th>Применение</th><th>Позиций</th><th style="text-align:right">Цена</th></tr></thead><tbody>${(b.series || []).map(s => `<tr><td style="font-weight:600">${esc(s.name)}</td><td>${esc(s.type)}</td><td>${esc(s.range)}</td><td>${esc(s.use)}</td><td>${esc(s.count)}</td><td style="text-align:right;white-space:nowrap">${esc(s.from)}</td></tr>`).join('')}</tbody></table></div>
${bp.length ? `<h2 style="font-size:26px;margin:32px 0 12px">Модели в каталоге</h2><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px">${bp.map(p => productCard(BASE, p)).join('')}</div>` : ''}
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;margin-top:32px">
  <div class="blueprint" style="padding:18px 20px"><div style="display:flex;gap:10px;align-items:center;font-weight:600;margin-bottom:8px"><span class="ico i-dir-spares" style="color:var(--color-accent-700)"></span>Запчасти</div><ul style="margin:0;padding-left:20px;font-size:15px;line-height:1.7">${(b.spares || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
  <div class="blueprint" style="padding:18px 20px"><div style="display:flex;gap:10px;align-items:center;font-weight:600;margin-bottom:8px"><span class="ico i-analog" style="color:var(--color-accent-700)"></span>Аналоги и поставки</div><p style="font-size:15px;line-height:1.6;margin:0 0 8px">${esc(b.analogs)}</p><p style="font-size:14px;color:var(--color-neutral-700);margin:0">${esc(b.availability)}</p></div>
</div>
${faqBlock(b.faq)}`);
    out.push({ path: P.brand(b), index: true, h1: b.h1 || b.name, raw: true, html, faq: b.faq,
      title: cut(`${b.h1 || b.name}: серии, цены и аналоги — ПРОМКОНТУР`, 70), desc: cut(b.intro, 158) });
  }
  return out;
};
module.exports.linkIndex = linkIndex;

// Каталог по категориям товаров (кроме насосов — у них экран из макета): katalog/<категория>/.
// Товары — tools/data/products.json, число позиций и подкатегории — tools/data/directions.json,
// тексты SEO-блока и 8 вопросов — tools/data/catalog_seo.json.
// Фильтры (производитель, подкатегория, наличие, цена), сортировка и ?tip=<подкатегория> — tools/site/catalog.js.
// JSON-LD (BreadcrumbList, ItemList, FAQPage) встраивается прямо в html: сборщик пишет его только для gen_pages.
module.exports = ctx => {
  const { BASE, esc } = ctx;
  const ORIGIN = process.env.ORIGIN || 'https://alex1986-rgb.github.io';
  const abs = p => ORIGIN + BASE + p;
  const products = ctx.products || ctx.load('products.json');
  const directions = ctx.load('directions.json');
  let SEO = {};
  try { SEO = ctx.load('catalog_seo.json') || {}; } catch (e) { SEO = {}; }
  const nf = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  // категория → направление (по названию в directions.json)
  const CATS = {
    armatura: 'Промышленная арматура',
    privod: 'Редукторы и мотор-редукторы',
    podshipniki: 'Подшипники и комплектующие',
    kompressory: 'Компрессоры',
    elektrika: 'Частотники и автоматика',
    pnevmatika: 'Пневматика',
    zapchasti: 'Запчасти для производства',
  };
  // товар → подкатегория направления (названия строго из subcats)
  const TIP = {
    'klapan-obratnyj-dn65-pn16': 'Обратные клапаны',
    'zadvizhka-dn100-pn16-chugun': 'Задвижки клиновые и шиберные',
    'nord-sk-02': 'Цилиндрические соосные мотор-редукторы',
    'skf-6205-2rs': 'Шариковые подшипники',
    'kaishan-lgcy-75': 'Винтовые компрессоры',
    'innovert-vr-15': 'Преобразователи частоты 11–250 кВт',
    'filtr-element-vozdushnyj-2-mkm': 'Блоки подготовки воздуха',
    'komplekt-prokladok-dn65': 'Прокладки и паронит',
    'manzheta-45x65x10-nbr': 'Резинотехнические изделия и кольца',
    'vibroopora-m12': 'Запчасти для станков и линий',
  };
  const inStock = p => /шт/.test(p.stock || '') && !/заказ|уточня/i.test(p.stock || '');
  const brandOf = p => p.brand || 'Без бренда';
  const prodPath = p => `katalog/${p.category || 'kompressory'}/${p.slug}/`;

  const box = (group, value, label, count) => `<label class="pk-cat-check"><input type="checkbox" name="${group}" value="${esc(value)}"><span class="pk-cat-check-t">${esc(label)}</span><span class="pk-cat-check-n mono">${count}</span></label>`;
  const ld = o => `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', ...o }).replace(/</g, '\\u003c')}</script>`;

  const pages = [];
  for (const [cat, dirName] of Object.entries(CATS)) {
    const d = directions.find(x => x.name === dirName);
    const s = SEO[cat] || {};
    if (!d) { console.warn('! gen_catalog: нет направления ' + dirName); continue; }
    const items = products.filter(p => p.category === cat);
    const path = `katalog/${cat}/`;
    const h1 = s.h1 || dirName;
    const subcats = (d.subcats || []).map(x => x.name);
    const tipOf = p => TIP[p.slug] && subcats.includes(TIP[p.slug]) ? TIP[p.slug] : '';

    const brands = [...new Set(items.map(brandOf))].sort((a, b) => (a === 'Без бренда') - (b === 'Без бренда') || a.localeCompare(b, 'ru'));
    const cnt = f => items.filter(f).length;
    const prices = items.map(p => p.price).filter(x => x != null);
    const minP = prices.length ? Math.min(...prices) : 0, maxP = prices.length ? Math.max(...prices) : 0;
    const stockN = cnt(inStock);

    const cards = items.map((p, i) => `<div class="pk-cat-item" data-i="${i}" data-brand="${esc(brandOf(p))}" data-tip="${esc(tipOf(p))}" data-stock="${inStock(p) ? 'in' : 'order'}" data-price="${p.price == null ? '' : p.price}" data-name="${esc(p.name)}">${ctx.productCard(BASE, p)}</div>`).join('\n');

    const need = `<section class="pk-cat-need" aria-labelledby="need-${cat}">
  <h2 id="need-${cat}" class="pk-cat-need-h">Нет нужной позиции?</h2>
  <p class="pk-cat-need-p">В каталоге сайта — часть ассортимента направления «${esc(dirName)}». Остальные ${nf(d.count)} позиций подбираем по запросу: пришлите список, артикул или фото — ответим с ценой и сроком.</p>
  <div class="pk-cat-need-grid">
    <a class="blueprint pk-cat-need-tile" href="${BASE}zayavka-spiskom/"><span class="ico ico-28 i-entry-upload" aria-hidden="true"></span><span class="pk-cat-need-t">Заявка списком</span><span class="pk-cat-need-s">Загрузите Excel — получите спецификацию с ценами</span></a>
    <a class="blueprint pk-cat-need-tile" href="${BASE}chat/?q=${encodeURIComponent(dirName)}"><span class="ico ico-28 i-entry-chat" aria-hidden="true"></span><span class="pk-cat-need-t">Подбор в чате</span><span class="pk-cat-need-s">Опишите задачу словами — инженер уточнит параметры</span></a>
    <a class="blueprint pk-cat-need-tile" href="${BASE}poisk-po-foto/"><span class="ico ico-28 i-entry-photo" aria-hidden="true"></span><span class="pk-cat-need-t">Фото шильдика</span><span class="pk-cat-need-s">Определим модель и артикул, предложим замену</span></a>
  </div>
</section>`;

    const faq = (s.faq || []).slice(0, 8);
    const jsonld = [
      ld({ '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Главная', item: abs('') },
        { '@type': 'ListItem', position: 2, name: 'Каталог', item: abs('napravleniya/') },
        { '@type': 'ListItem', position: 3, name: dirName, item: abs(path) },
      ] }),
      ld({ '@type': 'ItemList', name: h1, numberOfItems: items.length, itemListElement: items.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(prodPath(p)), name: p.name })) }),
      faq.length ? ld({ '@type': 'FAQPage', mainEntity: faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }) : '',
    ].join('\n');

    const html = `<main id="main" class="pk-main pk-cat" data-cat="${cat}" data-cat-title="${esc(h1)}">
${ctx.crumbs(BASE, [{ name: 'Главная', href: BASE }, { name: 'Каталог', href: BASE + 'napravleniya/' }, { name: dirName }])}
<div class="pk-cat-head">
  <div>
    <h1 class="pk-cat-h1" data-cat-h1>${esc(h1)}</h1>
    <p class="pk-cat-sub">${nf(d.count)} позиций по направлению «<a href="${BASE}napravleniya/${d.slug}/">${esc(dirName)}</a>» · ${items.length} в каталоге сайта · цены с НДС и доставкой</p>
  </div>
  <div class="pk-cat-sort">
    <label for="sort-${cat}">Сортировка</label>
    <select class="input" id="sort-${cat}" data-cat-sort>
      <option value="">По умолчанию</option>
      <option value="price-asc">Цена: по возрастанию</option>
      <option value="price-desc">Цена: по убыванию</option>
      <option value="name">Название: А–Я</option>
    </select>
  </div>
</div>
<div class="pk-cat-grid">
  <aside class="blueprint pk-cat-side" aria-label="Фильтры">
    <div class="pk-cat-side-h">
      <span class="pk-cat-side-title">Фильтры</span>
      <button type="button" class="pk-cat-link pk-cat-toggle" data-cat-toggle aria-expanded="true" aria-controls="filters-${cat}">Свернуть</button>
      <button type="button" class="pk-cat-link" data-cat-reset>Сбросить</button>
    </div>
    <div class="pk-cat-side-b" id="filters-${cat}">
      <fieldset class="pk-cat-group"><legend class="mono">Производитель</legend>${brands.map(b => box('brand', b, b, cnt(p => brandOf(p) === b))).join('')}</fieldset>
      <fieldset class="pk-cat-group"><legend class="mono">Подкатегория</legend>${subcats.map(t => box('tip', t, t, cnt(p => tipOf(p) === t))).join('')}</fieldset>
      <fieldset class="pk-cat-group"><legend class="mono">Наличие</legend>${box('stock', 'in', 'В наличии', stockN)}${box('stock', 'order', 'Под заказ', items.length - stockN)}</fieldset>
      <fieldset class="pk-cat-group"><legend class="mono">Цена, ₽</legend><div class="pk-cat-price"><label class="pk-vh" for="pmin-${cat}">Цена от</label><input class="input mono" id="pmin-${cat}" type="number" inputmode="numeric" min="0" step="1" data-cat-min placeholder="от ${nf(minP)}"><label class="pk-vh" for="pmax-${cat}">Цена до</label><input class="input mono" id="pmax-${cat}" type="number" inputmode="numeric" min="0" step="1" data-cat-max placeholder="до ${nf(maxP)}"></div></fieldset>
    </div>
  </aside>
  <div class="pk-cat-results">
    <div class="pk-cat-bar"><div class="pk-cat-chips" data-cat-chips></div><p class="pk-cat-found" data-cat-found role="status" aria-live="polite">Найдено ${items.length}</p></div>
    <h2 class="pk-vh">Товары в каталоге: ${esc(dirName.toLowerCase())}</h2>
    <div class="pk-cat-list" data-cat-list>
${cards}
    </div>
    <div class="blueprint pk-cat-empty" data-cat-empty hidden>
      <strong>Нет позиций по выбранным фильтрам</strong>
      <span>Измените условия или сбросьте фильтры. Нужную позицию подберём по запросу — пришлите артикул, список или фото шильдика.</span>
      <span class="pk-cat-empty-a"><button type="button" class="btn btn-primary" data-cat-reset>Сбросить фильтры</button><a class="btn btn-secondary" href="${BASE}chat/?q=${encodeURIComponent(dirName)}" data-cat-ask>Запросить подбор</a></span>
    </div>
  </div>
</div>
${need}
${ctx.seoSection(s.seo, faq, h1)}
${jsonld}
</main>`;

    pages.push({
      path, index: true, chrome: 'store', scripts: ['catalog.js'], faq,
      title: s.title || `Каталог: ${dirName} — цены и наличие | ПРОМКОНТУР`,
      desc: s.desc || `${dirName}: товары с ценами, фильтры по производителю, подкатегории и наличию. Цена с НДС и доставкой.`,
      h1, html,
    });
  }
  return pages;
};

// Кабинет закупщика: разделы бокового меню отдельными страницами.
// Данные — tools/data/cabinet.json (цифры сведены с макетом: заказы, согласование, автозакупка, спецификации).
// Страница содержит каркас (навигация, заголовок, панель действий) и JSON начального состояния;
// списки, фильтры и действия рисует tools/site/cabinet.js, состояние хранится в localStorage (pk:cab:*).
module.exports = ctx => {
  const { BASE, esc } = ctx;
  const D = ctx.load('cabinet.json');
  if (!D || !D.orders) return [];
  const P = {};
  for (const p of ctx.products || []) {
    P[p.slug] = { name: p.name, sku: p.sku, price: p.price, stock: p.stock || '', lead: p.lead || '', img: (p.photos || [])[0] || '',
      href: 'katalog/' + (p.category || 'kompressory') + '/' + p.slug + '/', brand: p.brand || '' };
  }
  const slugOf = id => id.toLowerCase().replace('пк-', 'pk-');
  const orderPath = o => 'kabinet/zakaz/' + slugOf(o.id) + '/'; // все заказы, включая ПК-10428, — одна карточка
  const seed = JSON.stringify({ ...D, products: P, orderPaths: Object.fromEntries(D.orders.map(o => [o.id, orderPath(o)])) }).replace(/</g, '\\u003c');

  const pending = D.approvals.filter(a => a.status === 'wait' || a.status === 'returned').length;
  const quotesOpen = D.quotes.filter(q => !/Принято|Отозван/.test(q.status)).length;
  const NAV = [
    ['overview', 'Обзор', 'i-ui-home', 'kabinet/', ''],
    ['orders', 'Заказы', 'i-ui-orders', 'kabinet/zakazy/', D.orders.length],
    ['approvals', 'Согласование', 'i-ui-approval', 'kabinet/soglasovanie/', pending],
    ['regular', 'Регулярные закупки', 'i-ui-repeat', 'kabinet/regulyarnye-zakupki/', D.regular.length],
    ['quotes', 'Запросы КП', 'i-ui-quote', 'kabinet/zaprosy-kp/', quotesOpen],
    ['documents', 'Счета и УПД', 'i-pay-invoice', 'kabinet/dokumenty/', D.documents.length],
    ['specs', 'Спецификации', 'i-ui-specs', 'kabinet/specifikacii/', D.specs.length],
    ['employees', 'Сотрудники', 'i-ui-users', 'kabinet/sotrudniki/', D.employees.length],
    ['requisites', 'Реквизиты', 'i-ui-requisites', 'kabinet/rekvizity/', ''],
    ['notify', 'Уведомления', 'i-ui-notify', 'kabinet/uvedomleniya/', ''],
  ];

  const nav = active => `<nav class="blueprint pk-cab-nav" aria-label="Разделы кабинета">
  <div class="pk-cab-org"><span class="ico ico-20 i-ui-account" aria-hidden="true"></span><div><div class="pk-cab-org-name" data-cab-company>${esc(D.company.name)}</div><div class="mono pk-cab-org-inn" data-cab-inn>ИНН ${esc(D.company.inn)}</div></div></div>
  <ul class="pk-cab-menu">${NAV.map(([k, t, ic, href, c]) => `<li><a href="${BASE + href}" class="pk-cab-link${k === active ? ' is-active' : ''}"${k === active ? ' aria-current="page"' : ''} data-cab-nav="${k}"><span class="ico ico-16 ${ic}" aria-hidden="true"></span><span class="pk-cab-link-t">${t}</span><span class="mono pk-cab-count" data-cab-count="${k}">${c === '' ? '' : c}</span></a></li>`).join('')}</ul>
</nav>`;

  const shell = ({ key, h1, sub, actions = '', view, attrs = '', crumb }) => `<main id="main" class="pk-main pk-cab" data-cab-page="${key}">
<div class="pk-cab-grid">
${nav(key === 'order' ? 'orders' : key)}
<div class="pk-cab-body">
  <nav aria-label="Хлебные крошки" class="pk-cab-crumbs"><a href="${BASE}">Главная</a><span aria-hidden="true">/</span>${key === 'overview' ? '<span aria-current="page">Кабинет</span>' : `<a href="${BASE}kabinet/">Кабинет</a>${crumb ? `<span aria-hidden="true">/</span><a href="${BASE + crumb[1]}">${esc(crumb[0])}</a>` : ''}<span aria-hidden="true">/</span><span aria-current="page">${esc(h1)}</span>`}</nav>
  <div class="pk-cab-head">
    <div><h1 class="pk-cab-h1" data-cab-h1>${esc(h1)}</h1>${sub ? `<p class="pk-cab-sub" data-cab-sub>${sub}</p>` : ''}</div>
    ${actions ? `<div class="pk-cab-actions">${actions}</div>` : ''}
  </div>
  <div class="pk-cab-view" data-cab-view="${view || key}"${attrs} aria-live="polite"><p class="pk-cab-loading">Загружаем данные кабинета…</p></div>
  <noscript><p class="blueprint pk-cab-empty">Для работы кабинета включите JavaScript.</p></noscript>
</div>
</div>
<script type="application/json" id="pk-cab-data">${seed}</script>
</main>`;

  const btn = (act, text, cls = 'btn-secondary', icon = '') => `<button type="button" class="btn ${cls}" data-cab-act="${act}">${icon ? `<span class="ico ico-16 ${icon}" aria-hidden="true"></span>` : ''}${text}</button>`;
  const T = s => s + ' — кабинет закупщика ПРОМКОНТУР';
  const page = (path, title, desc, h1, o) => ({ path, title: T(title), desc, h1, chrome: 'store', scripts: ['cabinet.js'], index: false, html: shell({ h1, ...o }) });

  const pages = [
    page('kabinet/', 'Обзор', 'Обзор кабинета закупщика: заказы в работе, запросы КП, согласование заявок и автозакупка регулярных позиций.', 'Кабинет закупщика',
      { key: 'overview', sub: 'Что происходит с закупками компании сейчас: заказы в пути, заявки на согласовании, ответы на запросы КП.', actions: btn('export-orders', 'Выгрузить реестр', 'btn-secondary', 'i-ui-download') + `<a class="btn btn-primary" href="${BASE}kabinet/zaprosy-kp/#new">Новый запрос КП</a>` }),
    page('kabinet/uvedomleniya/', 'Уведомления', 'Настройка уведомлений: события заказа, документы и КП по каналам MAX, почта и SMS; тихие часы и слежение за ценами.', 'Уведомления',
      { key: 'notify', sub: 'Выберите, о чём и куда сообщать. По умолчанию всё важное приходит в MAX, документы — на рабочую почту.' }),
    page('kabinet/zakazy/', 'Заказы', 'Все заказы компании: поиск по номеру и позиции, фильтр по статусу, сортировка по дате и сумме.', 'Заказы',
      { key: 'orders', sub: 'История закупок компании: статусы, суммы и документы. Нажмите на строку, чтобы открыть заказ.', actions: btn('export-orders', 'Выгрузить реестр', 'btn-secondary', 'i-ui-download') + `<a class="btn btn-primary" href="${BASE}kabinet/zaprosy-kp/#new">Новый запрос КП</a>` }),
    page('kabinet/soglasovanie/', 'Согласование заявок', 'Заявки цехов проходят маршрут Цех → Бюджет → Закупка с ролями и лимитами.', 'Согласование заявок',
      { key: 'approvals', sub: 'Заявка цеха проходит бюджет и закупку. Роли и лимиты — в разделе «Сотрудники».' }),
    page('kabinet/regulyarnye-zakupki/', 'Регулярные закупки', 'Автозакупка регулярных позиций: периодичность, количество, лимит без подтверждения, контроль роста цены.', 'Регулярные закупки',
      { key: 'regular', sub: 'Система считает периодичность по истории заказов и формирует счёт при наступлении срока. Внутри лимита — без подтверждения.' }),
    page('kabinet/zaprosy-kp/', 'Запросы КП', 'Запросы коммерческих предложений: статус, срок ответа инженера, принятие КП в заказ.', 'Запросы КП',
      { key: 'quotes', sub: 'Инженер отвечает на запрос в течение 2 рабочих часов. Принятое КП превращается в заказ со счётом.', actions: btn('quote-new', 'Новый запрос', 'btn-primary', 'i-ui-quote') }),
    page('kabinet/dokumenty/', 'Счета и УПД', 'Счета, УПД, акты сверки и договоры: фильтры по типу и периоду, статусы ЭДО.', 'Счета и УПД',
      { key: 'documents', sub: 'Закрывающие документы по заказам. Подписание — через оператора ЭДО.', actions: btn('export-docs', 'Выгрузить реестр', 'btn-secondary', 'i-ui-download') }),
    page('kabinet/specifikacii/', 'Спецификации', 'Сохранённые спецификации: позиции, суммы, отправка всей спецификации в корзину.', 'Спецификации',
      { key: 'specs', sub: 'Шаблоны заявок для ремонтов, проектов и регулярной номенклатуры. Цены пересчитываются по текущему прайсу.', actions: btn('spec-from-cart', 'Создать из корзины', 'btn-primary', 'i-ui-cart') }),
    page('kabinet/sotrudniki/', 'Сотрудники и роли', 'Сотрудники компании, роли в маршруте согласования и лимиты.', 'Сотрудники и роли',
      { key: 'employees', sub: 'Роль определяет этап маршрута согласования, лимит — сумму, которую сотрудник решает сам.', actions: btn('emp-new', 'Добавить сотрудника', 'btn-primary', 'i-ui-users') }),
    page('kabinet/rekvizity/', 'Реквизиты и адреса', 'Реквизиты компании для счетов и адреса доставки.', 'Реквизиты и адреса',
      { key: 'requisites', sub: 'Используются в счетах, УПД и договоре. Изменения сохраняются в этом браузере (демо).' }),
    page('kabinet/zakaz/', 'Заказ', 'Карточка заказа: статус, позиции, документы.', 'Заказ',
      { key: 'order', view: 'order', crumb: ['Заказы', 'kabinet/zakazy/'] }),
  ];
  const STEPS = ['Оформлен', 'Счёт', 'Оплачен', 'Отгружен', 'В пути', 'Доставлен', 'Закрыт'];
  for (const o of D.orders) {
    const st = STEPS.indexOf(o.status);
    pages.push(page(orderPath(o), 'Заказ ' + o.id, `Заказ ${o.id}: ${o.status.toLowerCase()}, ${o.items.length} поз., трек, документы и повтор заказа.`, 'Заказ ' + o.id,
      { key: 'order', view: 'order', attrs: ` data-order="${esc(o.id)}"`, crumb: ['Заказы', 'kabinet/zakazy/'], sub: st >= 0 ? `Статус: ${esc(o.status)}` : '' }));
  }
  // старый адрес экрана макета «Статус заказа» → общая карточка заказа
  const to = BASE + orderPath({ id: 'ПК-10428' });
  pages.push({ path: 'kabinet/zakaz-pk-10428/', title: 'Заказ ПК-10428: адрес карточки изменился — ПРОМКОНТУР', desc: 'Карточка заказа ПК-10428 переехала в раздел «Заказы» кабинета закупщика.', h1: 'Заказ ПК-10428', chrome: 'store', index: false,
    html: `<main id="main" class="pk-main pk-cab pk-cab-redirect"><meta http-equiv="refresh" content="0; url=${to}"><script>location.replace(${JSON.stringify(to)} + location.search + location.hash)</script>
<h1 class="pk-cab-h1">Заказ ПК-10428</h1><p class="pk-cab-sub">Карточка заказа переехала. Если переход не произошёл автоматически — <a href="${to}">откройте заказ ПК-10428</a>.</p></main>` });
  return pages;
};

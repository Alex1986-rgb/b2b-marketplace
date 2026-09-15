// Кабинет поставщика: заявки, карточки заявок, прайс-редактор, выгрузка, расчёты, настройки.
// Данные — tools/data/vendor.json, логика и разметка динамических блоков — tools/site/vendor.js
// (тот же файл отдаёт функции разметки в Node, так что первая отрисовка совпадает с браузерной).
const R = require('./site/vendor.js');

module.exports = ctx => {
  const { BASE } = ctx;
  const esc = R.esc;
  const D = JSON.parse(JSON.stringify(ctx.load('vendor.json')));
  if (!D || !D.orders) return [];
  const products = ctx.products || [];
  const prodHref = p => p.quote ? `katalog/${p.category || 'kompressory'}/${p.slug}/` : `katalog/${p.category}/${p.slug}/`;
  const enrich = x => {
    const p = x.slug && products.find(q => q.slug === x.slug);
    if (p) { x.href = prodHref(p); x.photo = (p.photos || [])[0] || null; }
    return x;
  };
  D.price.forEach(enrich);
  D.orders.forEach(o => o.items.forEach(enrich));
  const dataTag = `<script type="application/json" id="pk-ven-data">${JSON.stringify(D).replace(/</g, '\\u003c')}</script>`;

  const V = BASE + 'kabinet-postavshchika/';
  const c = R.counts(D.orders);
  const errCount = D.price.filter(r => R.rowStatus(r) === 'Ошибка формата').length;
  const NAV = [
    { key: 'home', href: V, icon: 'ui-home', t: 'Сводка' },
    { key: 'orders', href: V + 'zayavki/', icon: 'orders-inbox', t: 'Заявки', count: 'new', n: c['Новая'] },
    { key: 'price', href: V + 'prajs/', icon: 'vendor-price', t: 'Прайс и остатки', count: 'err', n: errCount },
    { key: 'feed', href: V + 'vygruzka/', icon: 'tier-sync', t: 'Выгрузка', count: 'feed', n: D.feed.log[0].errors },
    { key: 'settle', href: V + 'raschety/', icon: 'payout', t: 'Расчёты', count: 'pay', n: c.pay },
    { key: 'settings', href: V + 'nastrojki/', icon: 'vendor-directions', t: 'Настройки', count: '', n: 0 },
  ];
  const TITLE_N = { 'new': 'новых заявок', err: 'ошибок формата', feed: 'ошибок в последнем обмене', pay: 'заявок к расчёту' };
  const crumbs = items => ctx.crumbs.length >= 2 ? ctx.crumbs(BASE, items) : ctx.crumbs(items);

  const shell = (active, h1, lead, content, tools = '', crumbTail = null) => `${dataTag}
<div class="pv-shell">
  <nav class="blueprint pv-side" aria-label="Разделы кабинета поставщика">
    <div class="pv-company"><span class="pv-ava" aria-hidden="true">${esc(D.company.short)}</span><div><strong>${esc(D.company.name)}</strong><div class="pv-sub">Уровень «${esc(D.company.tier)}» · ${esc(D.company.tierFormat)}</div></div></div>
    <ul class="pv-menu">${NAV.map(n => `<li><a href="${n.href}" class="pv-menu-a"${n.key === active ? ' aria-current="page"' : ''}>${R.ico(n.icon)}<span>${n.t}</span>${n.count ? `<span class="pv-count mono" data-ven-count="${n.count}"${n.n ? '' : ' hidden'} title="${TITLE_N[n.count]}">${n.n || ''}</span>` : ''}</a></li>`).join('')}</ul>
    <a class="pv-side-foot" href="${BASE}postavshchikam/usloviya/">${R.ico('doc-generic')}Условия для поставщиков</a>
  </nav>
  <div class="pv-body" data-ven-page="${active}"${active === 'order' ? '' : ''}>
    ${crumbs([{ name: 'Кабинет поставщика', href: V }, ...(crumbTail || []), { name: h1 }])}
    <div class="pv-head"><div><h1 class="pv-h1">${h1}</h1>${lead ? `<p class="pv-lead">${lead}</p>` : ''}</div>${tools ? `<div class="pv-head-tools">${tools}</div>` : ''}</div>
    ${content}
  </div>
</div>`;
  const statBox = rows => rows.map(x => `<div class="blueprint pv-stat"><div class="mono pv-stat-v">${x[0]}</div><div class="pv-stat-k">${x[1]}</div></div>`).join('');
  const page = (path, title, desc, h1, html) => ({ path, title, desc, h1, html, chrome: 'vendor', scripts: ['vendor.js'], index: false });
  const pages = [];

  // ── заявки ──
  pages.push(page('kabinet-postavshchika/zayavki/', 'Заявки поставщика — кабинет ПРОМКОНТУР', 'Входящие заявки поставщика: подтверждение, сборка, отгрузка с трек-номером, передача к расчёту.', 'Заявки',
    shell('orders', 'Заявки', 'Новую заявку нужно подтвердить за 2 часа: наличие и дата отгрузки. Покупатель обезличен — вся переписка идёт через менеджера площадки.', `
    <div class="pv-stats" data-ven-stats>${statBox([[c['Новая'] || 0, 'новых — подтвердить за 2 часа'], [c.work, 'в сборке и к отгрузке'], [c['Отгружена'] || 0, 'в пути у перевозчика'], [R.rub(D.company.shippedMonth), 'отгружено за сентябрь']])}</div>
    <div class="pv-toolbar">
      <div class="pv-chips" role="group" aria-label="Фильтр по статусу" data-ven-chips>${['Все'].concat(D.statuses).map(s => `<button type="button" class="pv-chip" aria-pressed="${s === 'Все'}" data-st="${esc(s)}">${esc(s)} <span class="mono">${s === 'Все' ? c.all : (c[s] || 0)}</span></button>`).join('')}</div>
      <label class="pv-search">${R.ico('ui-search')}<input class="input" type="search" data-ven-q placeholder="Номер заявки, город или позиция" aria-label="Поиск по заявкам"></label>
    </div>
    <div class="blueprint pv-card pv-card-flush">
      <div class="pv-scroll"><table class="table pv-table pv-cards pv-orders">
        <thead><tr><th scope="col">Заявка</th><th scope="col">Покупатель</th><th scope="col">Позиции</th><th scope="col" class="pv-num">Сумма</th><th scope="col">Срок</th><th scope="col">Статус</th><th scope="col"><span class="pv-sr">Действия</span></th></tr></thead>
        <tbody data-ven-orders>${R.orderRows(D.orders, D, BASE)}</tbody>
      </table></div>
      <div class="pk-empty" data-ven-empty hidden><strong>Заявок не найдено</strong><span>Смените статус или уточните поиск.</span></div>
    </div>`)));

  // ── карточки заявок ──
  for (const o of D.orders) {
    const first = o.items[0];
    pages.push(page(`kabinet-postavshchika/zayavka/${R.slug(o.id)}/`, `Заявка ${o.id} — кабинет поставщика ПРОМКОНТУР`, `Заявка ${o.id} от ${R.fmtD(o.created)}: ${first.name}${o.items.length > 1 ? ' и ещё ' + (o.items.length - 1) + ' поз.' : ''}, сумма ${R.num(R.orderSum(o)).replace(/\u00a0/g, ' ')} ₽.`, `Заявка ${o.id}`,
      shell('order', `Заявка ${esc(o.id)}`, '', `<div data-ven-order>${R.orderView(o, D, BASE)}</div>`,
        `<a class="btn btn-secondary" href="${V}zayavki/">${R.ico('ui-arrow-left', 'color:currentColor')}Все заявки</a>`, [{ name: 'Заявки', href: V + 'zayavki/' }])
        .replace('data-ven-page="order"', `data-ven-page="order" data-id="${esc(o.id)}"`)));
  }

  // ── прайс ──
  const manual = D.price.filter(r => r.source === 'ручная правка').length, zero = D.price.filter(r => r.stock === 0).length;
  pages.push(page('kabinet-postavshchika/prajs/', 'Прайс и остатки поставщика — кабинет ПРОМКОНТУР', 'Редактор прайса: цена, остаток и срок по каждой позиции, источник значения, фильтры по ошибкам, пакетное изменение цен, выгрузка в CSV.', 'Прайс и остатки',
    shell('price', 'Прайс и остатки', `Ручная правка переопределяет фид до следующей выгрузки. В демо — ${D.price.length} позиций из ${R.num(D.company.positionsTotal)} в выгрузке.`, `
    <div class="blueprint pv-card pv-card-flush">
      <div class="pv-toolbar pv-toolbar-in">
        <div class="pv-chips" role="group" aria-label="Фильтр прайса" data-ven-chips>
          <button type="button" class="pv-chip" data-f="all" aria-pressed="true">Все <span class="mono">${D.price.length}</span></button><button type="button" class="pv-chip" data-f="zero" aria-pressed="false">Нулевые остатки <span class="mono">${zero}</span></button><button type="button" class="pv-chip" data-f="errors" aria-pressed="false">Ошибки формата <span class="mono">${errCount}</span></button><button type="button" class="pv-chip" data-f="manual" aria-pressed="false">Ручные правки <span class="mono">${manual}</span></button><button type="button" class="pv-chip" data-f="changed" aria-pressed="false">Не сохранено <span class="mono">0</span></button>
        </div>
        <label class="pv-search">${R.ico('ui-search')}<input class="input" type="search" data-ven-q placeholder="Код или наименование" aria-label="Поиск по прайсу"></label>
      </div>
      <div class="pv-batch" role="group" aria-label="Пакетное изменение цен">
        <span class="pv-sub" data-ven-selinfo aria-live="polite">Отметьте строки</span>
        <label class="pv-pct"><span>Цены на</span><input class="input mono" data-ven-pct inputmode="decimal" value="5" aria-label="Процент изменения цен"><span>%</span></label>
        <button type="button" class="btn btn-secondary pv-btn-sm" data-ven-batch="-1">− понизить</button>
        <button type="button" class="btn btn-secondary pv-btn-sm" data-ven-batch="1">+ повысить</button>
        <span class="pv-grow"></span>
        <button type="button" class="btn btn-secondary pv-btn-sm" data-ven-csv>${R.ico('ui-download', 'color:currentColor')}Экспорт CSV</button>
      </div>
      <p class="pv-scroll-hint" aria-hidden="true">Таблица листается вбок →</p>
      <div class="pv-scroll"><table class="table pv-table pv-price">
        <thead><tr><th scope="col" class="pv-chk"><label class="pv-check"><input type="checkbox" data-ven-all aria-label="Выбрать все видимые строки"><span aria-hidden="true"></span></label></th><th scope="col">Позиция</th><th scope="col">Цена, ₽</th><th scope="col">Остаток</th><th scope="col">Срок, дн.</th><th scope="col">Источник</th><th scope="col">Статус</th></tr></thead>
        <tbody data-ven-price>${D.price.map(r => R.priceRow(r, { raw: {}, invalid: {}, changed: {}, source: r.source }, R.rowStatus(r), BASE)).join('')}</tbody>
      </table></div>
      <div class="pk-empty" data-ven-empty hidden><strong>Ничего не найдено</strong><span>Смените фильтр или уточните поиск.</span></div>
      <div class="pv-savebar">
        <span class="pv-sub" data-ven-bar aria-live="polite">Изменений нет</span>
        <button type="button" class="btn btn-secondary" data-ven-cancel disabled>Отменить</button>
        <button type="button" class="btn btn-primary" data-ven-save disabled>Сохранить изменения</button>
      </div>
    </div>`)));

  // ── выгрузка ──
  const FORMATS = [['XML', 'XML'], ['YML', 'YML'], ['CSV', 'CSV'], ['API', 'REST API']];
  const SCHED = ['каждый час', 'каждые 2 часа', 'каждые 4 часа', 'раз в сутки'];
  pages.push(page('kabinet-postavshchika/vygruzka/', 'Выгрузка прайса поставщика — кабинет ПРОМКОНТУР', 'Настройка фида поставщика: адрес, формат XML/YML/CSV/API, расписание, ручной запуск обмена и журнал обменов с ошибками строк.', 'Выгрузка и синхронизация',
    shell('feed', 'Выгрузка и синхронизация', 'Фид обновляет цены и остатки без участия людей. Строки с ошибками не публикуются — на витрине остаются прошлые значения.', `
    <div class="pv-stats" data-ven-feedsum>${statBox([[R.fmtDT(D.feed.last), 'последний обмен · ' + D.feed.format], ['—', 'следующий по расписанию'], [R.num(D.feed.log[0].total), 'строк в последнем файле'], [R.num(D.feed.log[0].errors), 'строк с ошибками']])}</div>
    <div class="pv-two">
      <form class="blueprint pv-card" data-ven-feedform novalidate aria-labelledby="pv-feed-h">
        <h2 class="pv-h2" id="pv-feed-h">Настройки фида</h2>
        <div class="field"><label for="pv-url">Адрес фида</label><input class="input mono" id="pv-url" name="url" type="url" inputmode="url" autocomplete="off" value="${esc(D.feed.url)}" aria-describedby="pv-url-err"><span class="pk-err" id="pv-url-err" data-ven-urlerr hidden>Адрес вида https://site.ru/export/price.xml</span></div>
        <fieldset class="pv-fieldset"><legend>Формат</legend><div class="seg pv-seg">${FORMATS.map(f => `<label class="seg-opt"><input type="radio" name="format" value="${f[0]}"${f[0] === D.feed.format ? ' checked' : ''}>${f[1]}</label>`).join('')}</div><p class="pv-sub" data-ven-fhint></p></fieldset>
        <div class="field"><label for="pv-sched">Расписание</label><select class="input" id="pv-sched" name="schedule">${SCHED.map(s => `<option${s === D.feed.schedule ? ' selected' : ''}>${s}</option>`).join('')}</select></div>
        <div class="pv-actrow"><button type="submit" class="btn btn-secondary">Сохранить настройки</button></div>
      </form>
      <section class="blueprint pv-card" aria-labelledby="pv-run-h">
        <h2 class="pv-h2" id="pv-run-h">Обмен вручную</h2>
        <p class="pv-sub">Запустите внеплановый обмен после правки файла — не нужно ждать расписания. Ручные правки в прайсе сохраняются до следующей выгрузки.</p>
        <div class="pv-actrow"><button type="button" class="btn btn-primary" data-ven-run>${R.ico('tier-sync', 'color:currentColor')}Запустить обмен</button></div>
        <div class="pv-progress" data-ven-progress hidden><div class="pv-progress-track" role="progressbar" aria-label="Ход обмена" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="pv-progress-fill"></div></div><div class="pv-sub mono" data-ven-stage aria-live="polite">Начинаем…</div></div>
        <div class="pv-result" data-ven-result tabindex="-1" hidden></div>
      </section>
    </div>
    <section class="blueprint pv-card pv-card-flush" aria-labelledby="pv-log-h">
      <h2 class="pv-h2 pv-pad" id="pv-log-h">Журнал обменов</h2>
      <div class="pv-scroll"><table class="table pv-table pv-cards"><thead><tr><th scope="col">Обмен</th><th scope="col" class="pv-num">Длительность</th><th scope="col" class="pv-num">Строк</th><th scope="col" class="pv-num">Обновлено</th><th scope="col" class="pv-num">Ошибок</th><th scope="col">Результат</th></tr></thead><tbody data-ven-log>${R.logRows(D.feed.log)}</tbody></table></div>
    </section>
    <section class="blueprint pv-card pv-card-flush" aria-labelledby="pv-rowerr-h">
      <h2 class="pv-h2 pv-pad" id="pv-rowerr-h">${R.ico('state-sync-error', 'width:20px;height:20px;color:var(--color-accent-700)')} Ошибки строк в последнем обмене</h2>
      <div class="pv-scroll"><table class="table pv-table pv-cards"><thead><tr><th scope="col">Строка</th><th scope="col">Код</th><th scope="col">Поле</th><th scope="col">Значение</th><th scope="col">Ошибка</th></tr></thead><tbody>${R.errRows(D.feed.rowErrors)}</tbody></table></div>
    </section>`)));

  // ── расчёты ──
  const payouts = R.payouts(D.orders, D);
  pages.push(page('kabinet-postavshchika/raschety/', 'Расчёты с поставщиком — кабинет ПРОМКОНТУР', 'Выплаты поставщику по заявкам, сумма к оплате и оплаченная за месяц, акты сверки, срок расчёта по уровню подключения.', 'Расчёты',
    shell('settle', 'Расчёты', `Площадка платит закупочную цену полностью, без комиссии: зарабатываем на наценке для покупателя. Срок выплаты — от 3 до 7 рабочих дней после отгрузки, по уровню подключения.`, `
    <div class="pv-stats" data-ven-stats>${statBox([['—', 'к оплате'], ['—', 'ждут УПД'], [R.rub(D.settlements.paidMonth), 'оплачено в сентябре'], ['—', 'ближайшая выплата']])}</div>
    <section class="blueprint pv-card" aria-labelledby="pv-tier-h">
      <h2 class="pv-h2" id="pv-tier-h">Срок расчёта по уровню подключения</h2>
      <div class="pv-tiers">${D.tiers.map(t => `<div class="pv-tier${t.name === D.company.tier ? ' pv-tier-on' : ''}">${R.ico(t.icon, 'width:22px;height:22px;color:var(--color-accent-700)')}<div><strong>${esc(t.name)}</strong>${t.name === D.company.tier ? ' <span class="tag tag-accent pv-tag">ваш уровень</span>' : ''}<div class="pv-sub">${esc(t.how)}</div></div><div class="mono pv-tier-d">до ${t.days} раб. дн.</div></div>`).join('')}</div>
      <p class="pv-sub">Перейти на «Партнёр» (API и 1С, расчёт до 3 дней) — через менеджера: <a class="pv-link" href="${BASE}postavshchikam/usloviya/">условия для поставщиков</a>.</p>
    </section>
    <section class="blueprint pv-card pv-card-flush" aria-labelledby="pv-pay-h">
      <h2 class="pv-h2 pv-pad" id="pv-pay-h">Выплаты по заявкам</h2>
      <div class="pv-scroll"><table class="table pv-table pv-cards"><thead><tr><th scope="col">Заявка</th><th scope="col">Отгрузка</th><th scope="col" class="pv-num">Сумма</th><th scope="col">Статус</th><th scope="col">Выплата</th><th scope="col">П/п</th></tr></thead><tbody data-ven-payouts>${R.payoutRows(payouts, BASE)}</tbody></table></div>
    </section>
    <section class="blueprint pv-card pv-card-flush" id="akty" aria-labelledby="pv-acts-h">
      <h2 class="pv-h2 pv-pad" id="pv-acts-h">Акты сверки</h2>
      <div class="pv-scroll"><table class="table pv-table pv-cards" data-ven-acts><thead><tr><th scope="col">Период</th><th scope="col" class="pv-num">Оборот</th><th scope="col">Статус</th><th scope="col">Дата</th><th scope="col"><span class="pv-sr">Файл</span></th></tr></thead><tbody>${D.settlements.acts.map(a => `<tr><td data-label="Период">${esc(a.period)}</td><td data-label="Оборот" class="mono pv-num">${R.rub(a.sum)}</td><td data-label="Статус">${a.sum ? '<span class="tag pv-tag-ok pv-tag">' + esc(a.status) + '</span>' : '<span class="tag tag-neutral pv-tag">' + esc(a.status) + '</span>'}</td><td data-label="Дата">${/^\d{4}-/.test(a.date) ? R.fmtD(a.date) : esc(a.date)}</td><td class="pv-acts">${a.sum ? `<button type="button" class="btn btn-secondary pv-btn-sm" data-act-id="${esc(a.id)}">${R.ico('ui-download', 'color:currentColor')}Скачать (демо)</button>` : '<span class="pv-sub">ещё не готов</span>'}</td></tr>`).join('')}</tbody></table></div>
    </section>`)));

  // ── настройки ──
  const S = D.settings;
  const chk = (attr, i, label, on) => `<label class="radio pv-radio"><input type="checkbox" ${attr}="${i}"${on ? ' checked' : ''}><span class="dot"></span>${esc(label)}</label>`;
  pages.push(page('kabinet-postavshchika/nastrojki/', 'Настройки поставщика — кабинет ПРОМКОНТУР', 'Регионы отгрузки, минимальная сумма заказа, направления, контакты менеджеров и уведомления поставщика.', 'Настройки',
    shell('settings', 'Настройки', 'Регионы, направления и минимальная сумма меняются без обращения к менеджеру площадки и действуют на новые заявки.', `
    <form data-ven-settings novalidate>
    <div class="pv-two">
      <section class="blueprint pv-card" aria-labelledby="pv-min-h">
        <h2 class="pv-h2" id="pv-min-h">Приём заявок</h2>
        <div class="field"><label for="pv-min">Минимальная сумма заказа, ₽</label><input class="input mono" id="pv-min" name="minSum" inputmode="numeric" value="${S.minSum}" aria-describedby="pv-min-err" style="max-width:220px"><span class="pk-err" id="pv-min-err" data-ven-minerr hidden>Целое число рублей, например 15000</span></div>
        <label class="radio pv-radio"><input type="checkbox" name="hideZero"${S.hideZero ? ' checked' : ''}><span class="dot"></span>Скрывать позиции с нулевым остатком</label>
      </section>
      <fieldset class="blueprint pv-card pv-fieldset" id="napravleniya"><legend class="pv-h2">Направления</legend><div class="pv-checks">${S.categories.map((x, i) => chk('data-cat', i, x.n, x.on)).join('')}</div></fieldset>
    </div>
    <fieldset class="blueprint pv-card pv-fieldset"><legend class="pv-h2">Регионы отгрузки</legend><div class="pv-checks pv-checks-3">${S.regions.map((x, i) => chk('data-reg', i, x.n, x.on)).join('')}</div></fieldset>
    <section class="blueprint pv-card" aria-labelledby="pv-mgr-h">
      <h2 class="pv-h2" id="pv-mgr-h">Контакты менеджеров</h2>
      <ul class="pv-mgrs" data-ven-managers>${S.managers.map(m => `<li class="pv-mgr"><span class="pv-ava" aria-hidden="true">${esc(m.name.split(' ').map(x => x[0]).join(''))}</span><div><strong>${esc(m.name)}</strong><div class="pv-sub">${esc(m.role)}</div><div class="pv-sub mono">${esc(m.phone)} · ${esc(m.email)}</div></div><button type="button" class="pk-del" data-del="${esc(m.id)}" aria-label="Удалить: ${esc(m.name)}">×</button></li>`).join('')}</ul>
      <div class="pv-addmgr" data-ven-addmgr>
        <div class="field"><label for="pv-mn">Имя и фамилия</label><input class="input" id="pv-mn" name="mName" autocomplete="off" maxlength="60"></div>
        <div class="field"><label for="pv-mr">Зона ответственности</label><input class="input" id="pv-mr" name="mRole" autocomplete="off" maxlength="60" placeholder="Заявки и отгрузки"></div>
        <div class="field"><label for="pv-mp">Телефон</label><input class="input mono" id="pv-mp" name="mPhone" type="tel" autocomplete="off" maxlength="20" placeholder="+7 (495) 000-00-00"></div>
        <div class="field"><label for="pv-me">Почта</label><input class="input mono" id="pv-me" name="mEmail" type="email" autocomplete="off" maxlength="80"></div>
        <div class="pv-addmgr-btn"><button type="button" class="btn btn-secondary" data-ven-addbtn>+ Добавить контакт</button></div>
      </div>
      <p class="pk-err" data-ven-mgrerr role="alert" hidden></p>
    </section>
    <section class="blueprint pv-card pv-card-flush" aria-labelledby="pv-nt-h">
      <h2 class="pv-h2 pv-pad" id="pv-nt-h">Уведомления</h2>
      <div class="pv-scroll"><table class="table pv-table pv-notify"><thead><tr><th scope="col">Событие</th><th scope="col">MAX</th><th scope="col">Почта</th><th scope="col">SMS</th></tr></thead><tbody>${S.notify.map((n, i) => `<tr><th scope="row">${esc(n.ev)}</th>${['max', 'mail', 'sms'].map(ch => `<td><label class="pv-check"><input type="checkbox" data-nt="${i}:${ch}"${n[ch] ? ' checked' : ''} aria-label="${esc(n.ev)}: ${({ max: 'MAX', mail: 'почта', sms: 'SMS' })[ch]}"><span aria-hidden="true"></span></label></td>`).join('')}</tr>`).join('')}</tbody></table></div>
    </section>
    <div class="pv-savebar pv-savebar-page">
      <span class="pv-sub" data-ven-dirty aria-live="polite">Все изменения сохранены</span>
      <button type="button" class="btn btn-secondary pv-btn-sm pv-reset" data-ven-reset>Сбросить демо-данные</button>
      <button type="button" class="btn btn-secondary" data-ven-undo>Отменить</button>
      <button type="submit" class="btn btn-primary">Сохранить настройки</button>
    </div>
    </form>`)));

  return pages;
};

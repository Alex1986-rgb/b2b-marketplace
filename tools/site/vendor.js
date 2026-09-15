/* Кабинет поставщика ПРОМКОНТУР: заявки, прайс-редактор, выгрузка, расчёты, настройки.
   Демо без сервера: начальные данные — <script type="application/json" id="pk-ven-data">,
   дальше всё живёт в localStorage с префиксом 'pk:ven:'.
   Файл двойного назначения: в Node (tools/gen_vendor.js) отдаёт чистые функции разметки R,
   в браузере — ещё и логику страниц. */
(function () {
  'use strict';

  // ═════════ Чистые функции (общие для сборки и браузера) ═════════
  var R = {};
  var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  var esc = R.esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); };
  var num = R.num = function (n) { return n == null || isNaN(n) ? '—' : String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); };
  var rub = R.rub = function (n) { return n == null ? '—' : num(n) + ' ₽'; };
  var fmtD = R.fmtD = function (iso) { if (!iso) return '—'; var m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? (+m[3]) + ' ' + MONTHS[+m[2] - 1] : esc(iso); };
  var fmtDT = R.fmtDT = function (iso) { var m = String(iso || '').match(/T(\d{2}:\d{2})/); return fmtD(iso) + (m ? ', ' + m[1] : ''); };
  var orderSum = R.orderSum = function (o) { return o.items.reduce(function (s, i) { return s + i.qty * i.price; }, 0); };
  var slug = R.slug = function (id) { return String(id).toLowerCase().replace('зв-', 'zv-'); };
  // bus: у заявок из шины нет статической страницы — ссылка на список с поиском по номеру
  var oHref = R.oHref = function (o, BASE) { return o.bus ? BASE + 'kabinet-postavshchika/zayavki/?q=' + encodeURIComponent(o.id) : BASE + 'kabinet-postavshchika/zayavka/' + slug(o.id) + '/'; };
  var TAG = { 'Новая': 'tag-accent', 'Подтверждена': 'tag-outline', 'Собрана': 'tag-outline', 'Отгружена': 'tag-neutral', 'Доставлена': 'tag-neutral', 'К расчёту': 'tag-outline', 'Оплачена': 'pv-tag-ok', 'Отклонена': 'pv-tag-bad', 'ОК': 'pv-tag-ok', 'Нет остатка': 'tag-neutral', 'Ошибка формата': 'pv-tag-bad', 'Успешно': 'pv-tag-ok', 'С ошибками': 'tag-outline', 'Сбой': 'pv-tag-bad' };
  var tag = R.tag = function (s) { return '<span class="tag ' + (TAG[s] || 'tag-neutral') + ' pv-tag">' + esc(s) + '</span>'; };
  var ico = R.ico = function (id, extra) { return '<span class="ico ico-16 i-' + id + '" aria-hidden="true"' + (extra ? ' style="' + extra + '"' : '') + '></span>'; };

  // следующий шаг поставщика по статусу
  R.actions = function (o) {
    switch (o.status) {
      case 'Новая': return [{ act: 'confirm', label: 'Подтвердить', primary: true }, { act: 'reject', label: 'Отклонить' }];
      case 'Подтверждена': return [{ act: 'pack', label: 'Отметить собранной', primary: true }];
      case 'Собрана': return [{ act: 'ship', label: 'Отгрузить', primary: true }];
      case 'Отгружена': return [{ act: 'deliver', label: 'Отметить доставленной' }];
      case 'Доставлена': return [{ act: 'settle', label: 'Передать к расчёту', primary: true }];
      default: return [];
    }
  };
  R.counts = function (orders) {
    var c = { all: orders.length };
    orders.forEach(function (o) { c[o.status] = (c[o.status] || 0) + 1; });
    c.work = (c['Подтверждена'] || 0) + (c['Собрана'] || 0);
    c.pay = (c['Доставлена'] || 0) + (c['К расчёту'] || 0);
    return c;
  };

  // ── заявки: строки таблицы ──
  R.orderRow = function (o, D, BASE) {
    var first = o.items[0], more = o.items.length - 1;
    var acts = R.actions(o).map(function (a) {
      return '<button type="button" class="btn ' + (a.primary ? 'btn-primary' : 'btn-secondary') + ' pv-btn-sm" data-ven-act="' + a.act + '" data-id="' + esc(o.id) + '">' + esc(a.label) + '</button>';
    }).join('');
    var term = o.status === 'Новая'
      ? '<span class="pv-sla" data-sla="' + esc(o.id) + '">подтвердить за 2 ч</span><div class="pv-sub">отгрузка до ' + fmtD(o.shipBy) + '</div>'
      : o.status === 'Отклонена' ? '<span class="pv-sub">' + esc(o.reject || '') + '</span>'
      : /Отгружена|Доставлена|К расчёту|Оплачена/.test(o.status) ? (o.carrier ? esc(o.carrier) : 'отгружено') + (o.track ? '<div class="pv-sub mono">' + esc(o.track) + '</div>' : '')
      : 'отгрузка до ' + fmtD(o.confirmedShip || o.shipBy);
    return '<tr data-id="' + esc(o.id) + '">' +
      '<td data-label="Заявка"><a class="pv-link mono" href="' + oHref(o, BASE) + '">' + esc(o.id) + '</a><div class="pv-sub">' + fmtDT(o.created) + (o.pkOrder ? ' · заказ ' + esc(o.pkOrder) : '') + '</div></td>' + // bus: oHref, pkOrder
      '<td data-label="Покупатель">' + esc(D.buyer) + ' · ' + esc(o.city) + '<div class="pv-sub">' + esc(String(o.warehouse).split(' · ')[1] ? o.warehouse.split(' · ')[1].split(',')[0] : '') + ' → ' + esc(o.city) + '</div></td>' +
      '<td data-label="Позиции">' + esc(first.name) + ' × ' + num(first.qty) + (more > 0 ? '<div class="pv-sub">и ещё ' + more + ' поз.</div>' : '') + '</td>' +
      '<td data-label="Сумма" class="mono pv-num">' + rub(orderSum(o)) + '</td>' +
      '<td data-label="Срок">' + term + '</td>' +
      '<td data-label="Статус">' + tag(o.status) + '</td>' +
      '<td class="pv-acts">' + (acts || '<a class="btn btn-secondary pv-btn-sm" href="' + oHref(o, BASE) + '">Открыть</a>') + '</td></tr>'; // bus: oHref
  };
  R.orderRows = function (orders, D, BASE) { return orders.map(function (o) { return R.orderRow(o, D, BASE); }).join(''); };

  // ── карточка заявки ──
  R.orderView = function (o, D, BASE) {
    var items = o.items.map(function (i) {
      var name = i.href ? '<a class="pv-link" href="' + BASE + i.href + '">' + esc(i.name) + '</a>' : esc(i.name);
      return '<tr><td data-label="Позиция"><div class="pv-pos">' + (i.photo ? '<span class="pv-thumb" aria-hidden="true" style="background:url(' + BASE + 'img/' + esc(i.photo) + '.jpg) center/contain no-repeat #fff"></span>' : '<span class="pv-thumb pv-thumb-empty" aria-hidden="true">' + ico('doc-generic') + '</span>') +
        '<span>' + name + '<span class="pv-sub mono">' + esc(i.sku) + '</span></span></div></td>' +
        '<td data-label="Кол-во" class="mono pv-num">' + num(i.qty) + ' шт.</td><td data-label="Цена" class="mono pv-num">' + rub(i.price) + '</td><td data-label="Сумма" class="mono pv-num">' + rub(i.qty * i.price) + '</td></tr>';
    }).join('');
    var sum = orderSum(o), vat = Math.round(sum * 22 / 122);
    var hist = o.history.slice().reverse().map(function (h) {
      return '<li><span class="pv-dot" aria-hidden="true"></span><div><div class="pv-sub mono">' + fmtDT(h.ts) + ' · ' + esc(h.who) + '</div><div>' + esc(h.text) + '</div></div></li>';
    }).join('');
    var acts = R.actions(o).map(function (a) {
      return '<button type="button" class="btn ' + (a.primary ? 'btn-primary' : 'btn-secondary') + '" data-ven-act="' + a.act + '" data-id="' + esc(o.id) + '">' + esc(a.label) + '</button>';
    }).join('');
    var sla = o.status === 'Новая'
      ? '<div class="blueprint pv-card pv-sla-card" role="timer" aria-live="off"><div class="pv-k">До срока подтверждения</div><div class="mono pv-big" data-sla="' + esc(o.id) + '">2:00:00</div><div class="pv-sub">Регламент: подтвердить наличие и срок за 2 часа. Просрочка снижает приоритет в подборе.</div></div>' : '';
    var ship = [
      ['Склад отгрузки', esc(o.warehouse)],
      ['Доставка', esc(o.delivery)],
      ['Срок отгрузки по заявке', 'до ' + fmtD(o.shipBy)],
      o.confirmedShip ? ['Подтверждённая дата', fmtD(o.confirmedShip)] : null,
      o.carrier ? ['Перевозчик', esc(o.carrier)] : null,
      o.track ? ['Трек-номер', '<span class="mono">' + esc(o.track) + '</span>'] : null,
      o.reject ? ['Причина отказа', esc(o.reject) + (o.rejectNote ? ' — ' + esc(o.rejectNote) : '')] : null,
      o.payPlan ? ['Плановая выплата', fmtD(o.payPlan)] : null,
      o.paidAt ? ['Выплачено', fmtD(o.paidAt) + (o.payDoc ? ', п/п № ' + esc(o.payDoc) : '')] : null
    ].filter(Boolean).map(function (r) { return '<div class="pv-kv"><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'; }).join('');
    var docs = /Отгружена|Доставлена|К расчёту|Оплачена/.test(o.status)
      ? '<li>' + ico('doc-generic') + ' УПД по заявке ' + esc(o.id) + ' <button type="button" class="pv-linkbtn" data-ven-doc="' + esc(o.id) + '">Скачать (демо)</button></li>'
      : '<li class="pv-sub">УПД и транспортная накладная появятся после отгрузки.</li>';
    return '<div class="pv-order-head">' + tag(o.status) + '<span class="pv-sub">создана ' + fmtDT(o.created) + ' · ' + esc(D.buyer) + ' · ' + esc(o.city) + '</span></div>' +
      '<div class="pv-order-grid"><div class="pv-col">' +
      '<section class="blueprint pv-card" aria-labelledby="pv-items-h"><h2 id="pv-items-h" class="pv-h2">Позиции</h2>' +
      '<div class="pv-scroll"><table class="table pv-table pv-cards"><thead><tr><th>Позиция</th><th class="pv-num">Кол-во</th><th class="pv-num">Цена поставщика</th><th class="pv-num">Сумма</th></tr></thead><tbody>' + items + '</tbody></table></div>' +
      '<div class="pv-total"><span>Сумма отгрузки</span><strong class="mono">' + rub(sum) + '</strong><span class="pv-sub">в т. ч. НДС 22% — ' + rub(vat) + ' · цены закупочные, без наценки площадки</span></div></section>' +
      '<section class="blueprint pv-card" aria-labelledby="pv-hist-h"><h2 id="pv-hist-h" class="pv-h2">История</h2><ol class="pv-hist">' + hist + '</ol></section>' +
      '</div><aside class="pv-col">' + sla +
      (acts ? '<div class="blueprint pv-card"><div class="pv-k">Действия</div><div class="pv-actrow">' + acts + '</div></div>' : '') +
      '<section class="blueprint pv-card" aria-labelledby="pv-ship-h"><h2 id="pv-ship-h" class="pv-h2">Отгрузка</h2><dl class="pv-dl">' + ship + '</dl></section>' +
      '<section class="blueprint pv-card" aria-labelledby="pv-doc-h"><h2 id="pv-doc-h" class="pv-h2">Документы</h2><ul class="pv-docs">' + docs + '</ul>' +
      '<p class="pv-sub">Контакты покупателя скрыты: вопросы по заявке — через менеджера ПРОМКОНТУР в MAX.</p></section>' +
      '</aside></div>';
  };

  // ── прайс ──
  var PRICE_RE = /^\d{1,9}([.,]\d{1,2})?$/, INT_RE = /^\d{1,7}$/;
  R.parseCell = function (f, raw) {
    var s = String(raw == null ? '' : raw).replace(/[\s ]/g, '');
    if (s === '') return { ok: false, msg: 'Заполните значение' };
    if (f === 'price') { if (!PRICE_RE.test(s)) return { ok: false, msg: 'Цена — число, до 2 знаков после запятой' }; var v = parseFloat(s.replace(',', '.')); return v > 0 ? { ok: true, v: v } : { ok: false, msg: 'Цена больше нуля' }; }
    if (!INT_RE.test(s)) return { ok: false, msg: f === 'stock' ? 'Остаток — целое число ≥ 0' : 'Срок — целое число дней' };
    var n = parseInt(s, 10);
    if (f === 'lead' && n > 365) return { ok: false, msg: 'Срок не больше 365 дней' };
    return { ok: true, v: n };
  };
  R.rowStatus = function (eff) {
    if (eff.price == null || eff.stock == null || eff.lead == null || eff.bad) return 'Ошибка формата';
    return eff.stock === 0 ? 'Нет остатка' : 'ОК';
  };
  R.priceRow = function (r, eff, st, BASE) {
    // eff: {price, stock, lead, raw:{f:str}, invalid:{f:msg}, changed:{f:true}, source}
    var cell = function (f, label, w) {
      var raw = eff.raw[f] != null ? eff.raw[f] : (r[f] == null ? '' : String(r[f]));
      var bad = eff.invalid[f], ch = eff.changed[f];
      var ph = r.error && r.error.field === ({ price: 'цена', stock: 'остаток', lead: 'срок' })[f] ? r.error.raw : '';
      return '<td data-label="' + label + '"><input class="input mono pv-cell' + (ch ? ' pv-changed' : '') + (bad ? ' pv-invalid' : '') + '" style="width:' + w + 'px" inputmode="' + (f === 'price' ? 'decimal' : 'numeric') + '" autocomplete="off" data-f="' + f + '" data-row="' + esc(r.id) + '" value="' + esc(raw) + '"' +
        (ph ? ' placeholder="' + esc(ph) + '"' : '') + ' aria-label="' + label + ': ' + esc(r.name) + '"' + (bad ? ' aria-invalid="true" title="' + esc(bad) + '"' : '') + '></td>';
    };
    var name = r.href ? '<a class="pv-link" href="' + BASE + r.href + '">' + esc(r.name) + '</a>' : esc(r.name);
    var err = r.error && st === 'Ошибка формата' ? '<div class="pv-err-note">' + ico('state-sync-error') + ' Фид: ' + esc(r.error.msg) + '</div>' : '';
    return '<tr data-row="' + esc(r.id) + '"' + (Object.keys(eff.changed).length ? ' class="pv-row-changed"' : '') + '>' +
      '<td class="pv-chk"><label class="pv-check"><input type="checkbox" data-sel="' + esc(r.id) + '"' + (eff.selected ? ' checked' : '') + ' aria-label="Выбрать: ' + esc(r.name) + '"><span aria-hidden="true"></span></label></td>' +
      '<td data-label="Позиция" class="pv-name">' + name + '<div class="pv-sub mono">' + esc(r.sku) + '</div>' + err + '</td>' +
      cell('price', 'Цена, ₽', 112) + cell('stock', 'Остаток', 84) + cell('lead', 'Срок, дн.', 64) +
      '<td data-label="Источник" class="pv-src">' + (eff.source === 'ручная правка' ? '<span class="pv-src-manual">' + ico('ui-history') + 'ручная правка</span>' : '<span class="pv-src-feed">' + ico('tier-sync') + 'фид</span>') + '</td>' +
      '<td data-label="Статус" class="pv-st">' + tag(st) + '</td></tr>';
  };

  // ── выгрузка: журнал ──
  R.logRows = function (log) {
    return log.slice(0, 10).map(function (l, i) {
      return '<tr><td data-label="Обмен" class="mono">' + fmtDT(l.ts) + '</td><td data-label="Длительность" class="mono pv-num">' + l.dur + ' с</td>' +
        '<td data-label="Строк" class="mono pv-num">' + num(l.total) + '</td><td data-label="Обновлено" class="mono pv-num">' + num(l.updated) + '</td>' +
        '<td data-label="Ошибок" class="mono pv-num">' + num(l.errors) + '</td><td data-label="Результат">' + tag(l.result) + (l.note ? '<div class="pv-sub">' + esc(l.note) + '</div>' : '') + '</td></tr>';
    }).join('');
  };
  R.errRows = function (errs) {
    return errs.map(function (e) {
      return '<tr><td data-label="Строка" class="mono">' + e.line + '</td><td data-label="Код" class="mono">' + esc(e.sku || '—') + '</td><td data-label="Поле">' + esc(e.field) + '</td><td data-label="Значение" class="mono">' + esc(e.value === '' ? '(пусто)' : e.value) + '</td><td data-label="Ошибка">' + esc(e.msg) + '</td></tr>';
    }).join('');
  };

  // ── расчёты ──
  R.addWorkDays = function (iso, n) {
    var d = new Date(iso + 'T12:00:00'); var k = 0;
    while (k < n) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) k++; }
    return d.toISOString().slice(0, 10);
  };
  R.payouts = function (orders, D) {
    var rows = orders.filter(function (o) { return /Доставлена|К расчёту|Оплачена/.test(o.status); }).map(function (o) {
      var shipped = (o.history.filter(function (h) { return /Отгружена/.test(h.text); })[0] || {}).ts || o.confirmedShip;
      return { order: o.id, shipped: shipped, sum: orderSum(o), status: o.status, date: o.paidAt || o.payPlan || null, doc: o.payDoc || '', mine: true };
    });
    return rows.concat(D.settlements.payouts).sort(function (a, b) { return String(b.shipped).localeCompare(String(a.shipped)); });
  };
  R.payoutRows = function (list, BASE) {
    return list.map(function (p) {
      var st = p.status === 'Доставлена' ? 'Ждёт документов' : p.status;
      var ord = p.mine ? '<a class="pv-link mono" href="' + BASE + 'kabinet-postavshchika/zayavka/' + slug(p.order) + '/">' + esc(p.order) + '</a>' : '<span class="mono">' + esc(p.order) + '</span>';
      return '<tr><td data-label="Заявка">' + ord + '</td><td data-label="Отгрузка">' + fmtD(p.shipped) + '</td><td data-label="Сумма" class="mono pv-num">' + rub(p.sum) + '</td>' +
        '<td data-label="Статус">' + (st === 'Ждёт документов' ? '<span class="tag tag-neutral pv-tag">Ждёт документов</span>' : tag(st)) + '</td>' +
        '<td data-label="Выплата">' + (p.status === 'Оплачена' ? fmtD(p.date) : p.date ? 'план ' + fmtD(p.date) : '—') + '</td><td data-label="П/п" class="mono">' + (p.doc ? '№ ' + esc(p.doc) : '—') + '</td></tr>';
    }).join('');
  };

  if (typeof module !== 'undefined' && module.exports) { module.exports = R; return; }

  // ═════════ Браузер ═════════
  if (window.PK_AUTH && typeof window.PK_AUTH.require === 'function' && !window.PK_AUTH.require('vendor')) return;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var txt = function (el) { return (el && el.textContent || '').replace(/\s+/g, ' ').trim(); };
  var script = document.currentScript || $('script[src*="vendor.js"]');
  var BASE = (script && script.getAttribute('src') || '').replace(/assets\/vendor\.js.*$/, '') || '/b2b-marketplace/';
  var LS = 'pk:ven:';
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(LS + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) { toast('Браузер не даёт сохранить данные — изменения пропадут после перезагрузки'); } }
  };
  var nowIso = function () { var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()); };
  var todayIso = function () { return nowIso().slice(0, 10); };

  var D, S; // D — исходные данные, S — живое состояние
  function boot(data) {
    D = data;
    if (store.get('v') !== D.version) {
      store.set('orders', D.orders); store.set('price', D.price); store.set('feed', D.feed); store.set('settings', D.settings);
      store.set('meta', { slaBase: Date.now() }); store.set('v', D.version);
    }
    S = { orders: store.get('orders', D.orders), price: store.get('price', D.price), feed: store.get('feed', D.feed), settings: store.get('settings', D.settings), meta: store.get('meta', { slaBase: Date.now() }) };
    initCommon();
    var pg = $('[data-ven-page]');
    var kind = pg && pg.getAttribute('data-ven-page');
    if (kind === 'orders') pageOrders(pg);
    else if (kind === 'order') pageOrder(pg);
    else if (kind === 'price') pagePrice(pg);
    else if (kind === 'feed') pageFeed(pg);
    else if (kind === 'settle') pageSettle(pg);
    else if (kind === 'settings') pageSettings(pg);
    else if ($('[data-screen-label="Кабинет поставщика"]')) pageMockup($('[data-screen-label="Кабинет поставщика"]'));
    tick(); setInterval(tick, 1000);
    if (window.PK_BUS_READY) PK_BUS_READY(busConnect); // bus
  }
  function save(k) { store.set(k, S[k]); }

  // ═════════ bus: события витрины и оператора ═════════
  function busApply(ev) {
    var p = ev.payload || {};
    if (ev.type === 'order.created') {
      if (S.orders.some(function (o) { return o.pkOrder === p.order; })) return { dup: true };
      var lines = (p.items || []).map(function (i) {
        var row = S.price.filter(function (r) { return (i.sku && r.sku === i.sku) || (i.slug && r.slug === i.slug); })[0];
        return row && row.price != null ? { sku: row.sku, name: row.name, slug: row.slug || null, href: row.href || (row.slug && row.category ? 'katalog/' + row.category + '/' + row.slug + '/' : undefined), qty: +i.qty || 1, price: row.price } : null;
      }).filter(Boolean);
      if (!lines.length) return { skipped: true };
      var n = S.orders.reduce(function (m, o) { var r = /^ЗВ-(\d+)/.exec(o.id); return r ? Math.max(m, +r[1]) : m; }, 0) + 1;
      var shipBy = R.addWorkDays(todayIso(), 3);
      var o = { id: 'ЗВ-' + n, created: nowIso(), city: p.city || '—', status: 'Новая', slaMin: Math.round((Date.now() - S.meta.slaBase) / 60000) + 120, shipBy: shipBy,
        warehouse: (D.orders[0] && D.orders[0].warehouse) || 'Склад поставщика', delivery: 'доставка до адреса покупателя' + (p.address ? ': ' + p.address : ''), items: lines,
        history: [{ ts: nowIso(), who: 'ПРОМКОНТУР', text: 'Заявка создана по заказу ' + p.order + ' с витрины (' + (p.payment || 'счёт') + ')' }], pkOrder: p.order, bus: true };
      S.orders.unshift(o); save('orders');
      return { request: o.id, lines: lines.length };
    }
    if (ev.type === 'vendor.suspended' || ev.type === 'vendor.resumed' || ev.type === 'price.rule.changed') {
      var N = store.get('notices', {});
      if (ev.type === 'vendor.suspended') N.suspended = { why: p.why || '', at: ev.ts };
      else if (ev.type === 'vendor.resumed') { N.suspended = null; N.resumed = { at: ev.ts }; }
      else N.terms = { what: p.what || 'правила наценки', at: ev.ts, closed: false };
      store.set('notices', N);
      return { notice: ev.type };
    }
    return { ignored: true };
  }
  function busBanner() {
    var N = store.get('notices', {}), host = $('[data-ven-page]') || $('[data-screen-label="Кабинет поставщика"]') || $('main');
    $$('.pk-bus-banner').forEach(function (b) { b.remove(); });
    if (!host) return;
    function banner(title, text, closable) {
      var b = document.createElement('div'); b.className = 'pk-bus-banner'; b.setAttribute('role', 'status');
      b.innerHTML = '<div><b>' + esc(title) + '</b><span>' + esc(text) + '</span></div>';
      if (closable) { var x = document.createElement('button'); x.type = 'button'; x.className = 'btn btn-secondary pv-btn-sm'; x.textContent = 'Понятно'; x.addEventListener('click', function () { var M = store.get('notices', {}); if (M.terms) M.terms.closed = true; store.set('notices', M); busBanner(); }); b.appendChild(x); }
      host.insertBefore(b, host.firstChild);
    }
    if (N.terms && !N.terms.closed) banner('Сервис изменил условия', 'Обновлены правила наценки площадки: ' + N.terms.what + '. Ваши закупочные цены не меняются.', true);
    if (N.suspended) banner('Сервис приостановил приём заявок', 'Причина: ' + (N.suspended.why || 'не указана') + '. Новые заявки не поступают, открытые заявки выполняйте как обычно. Вопросы — менеджеру ПРОМКОНТУР в MAX.', false);
  }
  function busConnect(B) {
    if (window.PK_BUS && PK_BUS.css) PK_BUS.css();
    function run(list) {
      var n = 0;
      list.forEach(function (ev) { var r = busApply(ev); B.ack(ev.id, 'vendor', r); if (!r.ignored && !r.skipped && !r.dup) n++; });
      if (n) { refresh(); busBanner(); }
      return n;
    }
    var n = run(B.pending('vendor'));
    busBanner();
    if (n) toast('Новых событий от сервиса: ' + n);
    B.on('*', function (ev) { if (ev.to.indexOf('vendor') < 0) return; if (run([ev])) toast(B.describe(ev, 'vendor').t); });
  }

  // ── общие: тост, диалог, счётчики, SLA ──
  var toastEl, toastT;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'pk-toast pv-toast'; toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite'); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('on'); clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove('on'); }, 3600);
  }
  var dlgN = 0;
  function modal(o) {
    var d = document.createElement('dialog'), id = 'pv-dlg-' + (++dlgN);
    d.className = 'dialog pv-dialog'; d.setAttribute('aria-labelledby', id + '-t');
    d.innerHTML = '<form novalidate><h2 class="dialog-title" id="' + id + '-t">' + esc(o.title) + '</h2>' + (o.lead ? '<p class="pv-sub">' + esc(o.lead) + '</p>' : '') +
      '<div class="pv-dlg-body">' + o.body + '</div><p class="pk-err" role="alert" hidden></p>' +
      '<div class="dialog-actions"><button type="button" class="btn btn-secondary" data-close>Отмена</button><button type="submit" class="btn ' + (o.danger ? 'pv-btn-danger' : 'btn-primary') + '">' + esc(o.ok) + '</button></div></form>';
    document.body.appendChild(d);
    var back = document.activeElement, form = d.querySelector('form'), err = d.querySelector('.pk-err');
    var close = function () { d.close(); };
    d.addEventListener('close', function () { d.remove(); if (back && back.isConnected) back.focus(); });
    d.querySelector('[data-close]').addEventListener('click', close);
    d.addEventListener('click', function (e) { if (e.target === d) close(); });
    if (o.init) o.init(form);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      $$('.pk-invalid', form).forEach(function (x) { x.classList.remove('pk-invalid'); x.removeAttribute('aria-invalid'); });
      var r = o.onOk(form);
      if (r && r.error) {
        err.textContent = r.error; err.hidden = false;
        if (r.field) { r.field.classList.add('pk-invalid'); r.field.setAttribute('aria-invalid', 'true'); r.field.focus(); }
        return;
      }
      close();
    });
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
    var f = form.querySelector('input:not([type=hidden]), select, textarea'); if (f) f.focus();
    return d;
  }
  var refreshers = [];
  function refresh() { refreshers.forEach(function (fn) { fn(); }); paintCounts(); tick(); }
  function paintCounts() {
    var c = R.counts(S.orders);
    var errs = S.price.filter(function (r) { return R.rowStatus(r) === 'Ошибка формата'; }).length;
    var map = { 'new': c['Новая'] || 0, work: c.work, pay: c.pay, err: errs, feed: (S.feed.log[0] || {}).errors || 0 };
    $$('[data-ven-count]').forEach(function (el) {
      var v = map[el.getAttribute('data-ven-count')]; el.textContent = v ? v : ''; el.hidden = !v;
    });
  }
  function slaUntil(o) { return S.meta.slaBase + (o.slaMin || 120) * 60000; }
  function tick() {
    $$('[data-sla]').forEach(function (el) {
      var o = byId(el.getAttribute('data-sla')); if (!o || o.status !== 'Новая') return;
      var left = slaUntil(o) - Date.now(), big = el.classList.contains('pv-big');
      el.classList.toggle('pv-late', left < 0); el.classList.toggle('pv-soon', left >= 0 && left < 30 * 60000);
      var a = Math.abs(left), h = Math.floor(a / 3600000), m = Math.floor(a % 3600000 / 60000), s = Math.floor(a % 60000 / 1000);
      var t = h + ':' + (m < 10 ? '0' : '') + m + (big ? ':' + (s < 10 ? '0' : '') + s : '');
      el.textContent = left < 0 ? (big ? '−' + t : 'просрочено на ' + (h ? h + ' ч ' : '') + m + ' мин') : (big ? t : 'подтвердить: ' + (h ? h + ' ч ' : '') + m + ' мин');
    });
  }
  function byId(id) { return S.orders.filter(function (o) { return o.id === id; })[0]; }

  // ── действия с заявками (общие для всех страниц) ──
  function hist(o, text) { o.history.push({ ts: nowIso(), who: 'Гидромаш · кабинет', text: text }); }
  // bus: смена статуса заявки → vendor.order.status (закупщику и оператору)
  function busStatus(o) {
    try { if (window.PK_BUS) PK_BUS.emit('vendor.order.status', { request: o.id, order: o.pkOrder || null, status: o.status, vendor: 'Гидромаш', track: o.track || '', carrier: o.carrier || '', confirmedShip: o.confirmedShip || '', reject: o.reject || '', sum: orderSum(o), skus: o.items.map(function (i) { return i.sku; }) }); } catch (e) {}
  }
  function doAct(act, id) {
    var o = byId(id); if (!o) return;
    if (act === 'confirm') {
      var def = o.shipBy < todayIso() ? todayIso() : o.shipBy;
      modal({ title: 'Подтвердить заявку ' + o.id, lead: 'Сумма ' + num(orderSum(o)) + ' ₽ · ' + o.items.length + ' поз. · отгрузка по заявке до ' + fmtD(o.shipBy), ok: 'Подтвердить',
        body: '<div class="field"><label for="pv-ship-date">Дата отгрузки</label><input class="input mono" type="date" id="pv-ship-date" name="date" required min="' + todayIso() + '" value="' + def + '"></div>' +
          '<label class="radio pv-radio"><input type="checkbox" name="reserve" checked><span class="dot"></span>Поставить резерв на складе</label>',
        onOk: function (f) {
          var v = f.date.value;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return { error: 'Укажите дату отгрузки', field: f.date };
          if (v < todayIso()) return { error: 'Дата отгрузки не может быть в прошлом', field: f.date };
          o.status = 'Подтверждена'; o.confirmedShip = v;
          hist(o, 'Подтверждена, отгрузка ' + fmtD(v) + (v > o.shipBy ? ' (позже срока в заявке — покупатель уведомлён)' : '') + (f.reserve.checked ? ', резерв поставлен' : ''));
          save('orders'); busStatus(o); /* bus */ refresh(); toast('Заявка ' + o.id + ' подтверждена · отгрузка ' + fmtD(v));
        } });
    } else if (act === 'reject') {
      modal({ title: 'Отклонить заявку ' + o.id, lead: 'Позиции уйдут второму поставщику. Частые отказы снижают рейтинг в подборе.', ok: 'Отклонить', danger: true,
        body: '<div class="field"><label for="pv-rej">Причина</label><select class="input" id="pv-rej" name="reason" required><option value="">Выберите причину</option>' + D.rejectReasons.map(function (r) { return '<option>' + esc(r) + '</option>'; }).join('') + '</select></div>' +
          '<div class="field"><label for="pv-rej-note">Комментарий <span class="pv-sub">(обязателен для «Другое»)</span></label><textarea class="input" id="pv-rej-note" name="note" rows="3" maxlength="300"></textarea></div>',
        onOk: function (f) {
          if (!f.reason.value) return { error: 'Выберите причину отказа', field: f.reason };
          var note = f.note.value.trim();
          if (f.reason.value === 'Другое' && note.length < 5) return { error: 'Опишите причину в комментарии', field: f.note };
          o.status = 'Отклонена'; o.reject = f.reason.value; o.rejectNote = note;
          hist(o, 'Отклонена: ' + f.reason.value.toLowerCase() + (note ? ' — ' + note : ''));
          save('orders'); busStatus(o); /* bus */ refresh(); toast('Заявка ' + o.id + ' отклонена');
        } });
    } else if (act === 'pack') {
      o.status = 'Собрана'; hist(o, 'Отмечена собранной'); save('orders'); busStatus(o); /* bus */ refresh(); toast('Заявка ' + o.id + ' собрана — можно отгружать');
    } else if (act === 'ship') {
      modal({ title: 'Отгрузить заявку ' + o.id, lead: 'Трек-номер уйдёт покупателю, статус будет обновляться из системы перевозчика.', ok: 'Отгрузить',
        body: '<div class="field"><label for="pv-car">Перевозчик</label><select class="input" id="pv-car" name="carrier" required><option value="">Выберите перевозчика</option>' + D.carriers.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</select></div>' +
          '<div class="field"><label for="pv-track">Трек-номер или номер накладной</label><input class="input mono" id="pv-track" name="track" autocomplete="off" maxlength="40"></div>' +
          '<div class="field"><label for="pv-places">Мест, шт.</label><input class="input mono" id="pv-places" name="places" inputmode="numeric" value="1" style="max-width:120px"></div>',
        onOk: function (f) {
          if (!f.carrier.value) return { error: 'Выберите перевозчика', field: f.carrier };
          var pickup = /Самовывоз/.test(f.carrier.value), tr = f.track.value.trim();
          if (!pickup && !/^[A-Za-zА-Яа-я0-9][A-Za-zА-Яа-я0-9\-\/ ]{4,39}$/.test(tr)) return { error: 'Трек-номер: от 5 символов, буквы, цифры, дефис', field: f.track };
          if (!/^\d{1,3}$/.test(f.places.value.trim()) || +f.places.value < 1) return { error: 'Количество мест — целое число от 1', field: f.places };
          o.status = 'Отгружена'; o.carrier = f.carrier.value; o.track = pickup ? '' : tr;
          hist(o, 'Отгружена: ' + o.carrier + (o.track ? ', трек ' + o.track : '') + ', мест ' + (+f.places.value));
          save('orders'); busStatus(o); /* bus */ refresh(); toast('Заявка ' + o.id + ' отгружена · ' + o.carrier);
        } });
    } else if (act === 'deliver') {
      o.status = 'Доставлена'; hist(o, 'Доставлена (отметка поставщика, в работе приходит от перевозчика)'); save('orders'); busStatus(o); /* bus */ refresh(); toast('Заявка ' + o.id + ' доставлена — загрузите УПД для расчёта');
    } else if (act === 'settle') {
      modal({ title: 'Передать к расчёту ' + o.id, lead: 'Нужен подписанный УПД. Выплата — до ' + D.company.settleDays + ' раб. дней по уровню «' + D.company.tier + '».', ok: 'Передать',
        body: '<div class="field"><label for="pv-upd">Номер УПД</label><input class="input mono" id="pv-upd" name="upd" autocomplete="off" maxlength="20" placeholder="например, 1482"></div>',
        onOk: function (f) {
          var v = f.upd.value.trim();
          if (!/^[\wА-Яа-я\-\/]{1,20}$/.test(v)) return { error: 'Укажите номер УПД', field: f.upd };
          o.status = 'К расчёту'; o.upd = v; o.payPlan = R.addWorkDays(todayIso(), D.company.settleDays);
          hist(o, 'УПД № ' + v + ' загружен, передана к расчёту · плановая выплата ' + fmtD(o.payPlan));
          save('orders'); busStatus(o); /* bus */ refresh(); toast('Передана к расчёту · выплата ' + fmtD(o.payPlan));
        } });
    }
  }
  function initCommon() {
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ven-act]');
      if (b) { e.preventDefault(); doAct(b.getAttribute('data-ven-act'), b.getAttribute('data-id')); return; }
      var doc = e.target.closest('[data-ven-doc]');
      if (doc) { var o = byId(doc.getAttribute('data-ven-doc')); if (o) download('upd-' + slug(o.id) + '.csv', csv([['УПД (демо) по заявке', o.id], ['Поставщик', D.company.name], ['Покупатель', D.buyer + ' · ' + o.city], [], ['Код', 'Наименование', 'Кол-во', 'Цена', 'Сумма']].concat(o.items.map(function (i) { return [i.sku, i.name, i.qty, i.price, i.qty * i.price]; })).concat([[], ['Итого', '', '', '', orderSum(o)]]))); }
    });
    paintCounts();
  }
  function csv(rows) { return '﻿' + rows.map(function (r) { return r.map(function (c) { c = c == null ? '' : String(c); return /[;"\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(';'); }).join('\r\n'); }
  function download(name, content) {
    var url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    var a = document.createElement('a'); a.href = url; a.download = name; a.hidden = true; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
    toast('Файл ' + name + ' сохранён');
  }

  // ═════════ Заявки ═════════
  function pageOrders(pg) {
    var tbody = $('[data-ven-orders]', pg), chips = $('[data-ven-chips]', pg), q = $('[data-ven-q]', pg), empty = $('[data-ven-empty]', pg), stats = $('[data-ven-stats]', pg);
    var qs = new URLSearchParams(location.search), filter = qs.get('st') || 'Все';
    if (qs.get('q')) q.value = qs.get('q'); // bus: ссылка на заявку из шины
    function list() {
      var s = q.value.trim().toLowerCase();
      return S.orders.filter(function (o) {
        if (filter !== 'Все' && !(filter === 'В работе' ? /Подтверждена|Собрана/.test(o.status) : o.status === filter)) return false;
        if (!s) return true;
        return (o.id + ' ' + o.city + ' ' + o.items.map(function (i) { return i.name + ' ' + i.sku; }).join(' ')).toLowerCase().indexOf(s) >= 0;
      });
    }
    function render() {
      var c = R.counts(S.orders);
      chips.innerHTML = ['Все'].concat(D.statuses).map(function (st) {
        var n = st === 'Все' ? c.all : (c[st] || 0);
        return '<button type="button" class="pv-chip" aria-pressed="' + (st === filter) + '" data-st="' + esc(st) + '">' + esc(st) + ' <span class="mono">' + n + '</span></button>';
      }).join('');
      var l = list();
      tbody.innerHTML = R.orderRows(l, D, BASE);
      empty.hidden = !!l.length;
      var shippedAdd = S.orders.filter(function (o) { return o.history.some(function (h) { return /кабинет/.test(h.who) && /^Отгружена/.test(h.text); }); }).reduce(function (s, o) { return s + orderSum(o); }, 0);
      stats.innerHTML = [[c['Новая'] || 0, 'новых — подтвердить за 2 часа'], [c.work, 'в сборке и к отгрузке'], [(c['Отгружена'] || 0), 'в пути у перевозчика'], [rub(D.company.shippedMonth + shippedAdd), 'отгружено за сентябрь']]
        .map(function (x) { return '<div class="blueprint pv-stat"><div class="mono pv-stat-v">' + (typeof x[0] === 'number' ? num(x[0]) : x[0]) + '</div><div class="pv-stat-k">' + x[1] + '</div></div>'; }).join('');
    }
    chips.addEventListener('click', function (e) {
      var b = e.target.closest('[data-st]'); if (!b) return;
      filter = b.getAttribute('data-st'); render();
      var u = new URL(location.href); if (filter === 'Все') u.searchParams.delete('st'); else u.searchParams.set('st', filter); history.replaceState(null, '', u);
      var nb = $('[data-st="' + filter + '"]', chips); if (nb) nb.focus();
    });
    q.addEventListener('input', render);
    refreshers.push(render); render();
  }

  // ═════════ Карточка заявки ═════════
  function pageOrder(pg) {
    var id = pg.getAttribute('data-id'), box = $('[data-ven-order]', pg);
    function render() { var o = byId(id); if (o) box.innerHTML = R.orderView(o, D, BASE); }
    refreshers.push(render); render();
  }

  // ═════════ Прайс ═════════
  function pagePrice(pg) {
    var tbody = $('[data-ven-price]', pg), chips = $('[data-ven-chips]', pg), q = $('[data-ven-q]', pg), all = $('[data-ven-all]', pg);
    var bar = $('[data-ven-bar]', pg), btnSave = $('[data-ven-save]', pg), btnCancel = $('[data-ven-cancel]', pg), pct = $('[data-ven-pct]', pg), selInfo = $('[data-ven-selinfo]', pg), empty = $('[data-ven-empty]', pg);
    var draft = {}, selected = {}, filter = 'all';
    function eff(r) {
      var d = draft[r.id] || {}, e = { raw: {}, invalid: {}, changed: {}, selected: !!selected[r.id], source: r.source };
      ['price', 'stock', 'lead'].forEach(function (f) {
        if (f in d) {
          e.raw[f] = d[f]; var p = R.parseCell(f, d[f]);
          if (p.ok) { e[f] = p.v; if (p.v !== r[f]) e.changed[f] = true; } else { e[f] = null; e.invalid[f] = p.msg; e.changed[f] = true; }
        } else e[f] = r[f];
      });
      if (Object.keys(e.changed).length) e.source = 'ручная правка';
      return e;
    }
    function statusOf(r) { var e = eff(r); return R.rowStatus({ price: e.price, stock: e.stock, lead: e.lead, bad: Object.keys(e.invalid).length }); }
    var FILTERS = [
      ['all', 'Все', function () { return true; }],
      ['zero', 'Нулевые остатки', function (r) { return eff(r).stock === 0; }],
      ['errors', 'Ошибки формата', function (r) { return statusOf(r) === 'Ошибка формата'; }],
      ['manual', 'Ручные правки', function (r) { return eff(r).source === 'ручная правка'; }],
      ['changed', 'Не сохранено', function (r) { return !!draft[r.id]; }]
    ];
    function visible() {
      var s = q.value.trim().toLowerCase(), fn = FILTERS.filter(function (f) { return f[0] === filter; })[0][2];
      return S.price.filter(function (r) { return fn(r) && (!s || (r.name + ' ' + r.sku).toLowerCase().indexOf(s) >= 0); });
    }
    function paintBar() {
      var changedRows = Object.keys(draft).length, bad = $$('.pv-cell.pv-invalid', tbody).length + S.price.filter(function (r) { return draft[r.id] && Object.keys(eff(r).invalid).length; }).length;
      var nSel = Object.keys(selected).length;
      btnSave.disabled = !changedRows; btnCancel.disabled = !changedRows;
      bar.textContent = changedRows ? 'Не сохранено: ' + changedRows + ' поз.' + (bad ? ' · есть ошибки ввода' : '') : 'Изменений нет';
      bar.classList.toggle('pv-dirty', !!changedRows);
      selInfo.textContent = nSel ? 'Выбрано: ' + nSel : 'Отметьте строки';
      FILTERS.forEach(function (f) { var b = $('[data-f="' + f[0] + '"] .mono', chips); if (b) b.textContent = S.price.filter(f[2]).length; });
      var vis = visible(), on = vis.filter(function (r) { return selected[r.id]; }).length;
      all.checked = vis.length > 0 && on === vis.length; all.indeterminate = on > 0 && on < vis.length;
    }
    function render() {
      chips.innerHTML = FILTERS.map(function (f) { return '<button type="button" class="pv-chip" data-f="' + f[0] + '" aria-pressed="' + (f[0] === filter) + '">' + f[1] + ' <span class="mono">0</span></button>'; }).join('');
      var vis = visible();
      tbody.innerHTML = vis.map(function (r) { var e = eff(r); return R.priceRow(r, e, R.rowStatus({ price: e.price, stock: e.stock, lead: e.lead, bad: Object.keys(e.invalid).length }), BASE); }).join('');
      empty.hidden = !!vis.length;
      paintBar();
    }
    function rowOf(id) { return S.price.filter(function (r) { return r.id === id; })[0]; }
    function repaintRow(id) { // без перерисовки таблицы — фокус остаётся в ячейке
      var r = rowOf(id), tr = $('tr[data-row="' + CSS.escape(id) + '"]', tbody); if (!r || !tr) return;
      var e = eff(r), st = R.rowStatus({ price: e.price, stock: e.stock, lead: e.lead, bad: Object.keys(e.invalid).length });
      $$('.pv-cell', tr).forEach(function (inp) {
        var f = inp.getAttribute('data-f'), bad = e.invalid[f];
        inp.classList.toggle('pv-changed', !!e.changed[f]); inp.classList.toggle('pv-invalid', !!bad);
        if (bad) { inp.setAttribute('aria-invalid', 'true'); inp.title = bad; } else { inp.removeAttribute('aria-invalid'); inp.removeAttribute('title'); }
      });
      tr.classList.toggle('pv-row-changed', !!Object.keys(e.changed).length);
      var tmp = document.createElement('tbody'); tmp.innerHTML = R.priceRow(r, e, st, BASE);
      $('.pv-src', tr).innerHTML = $('.pv-src', tmp).innerHTML; $('.pv-st', tr).innerHTML = $('.pv-st', tmp).innerHTML;
      var note = $('.pv-err-note', tr), nn = $('.pv-err-note', tmp);
      if (note && !nn) note.remove();
      paintBar();
    }
    tbody.addEventListener('input', function (e) {
      var inp = e.target.closest('.pv-cell'); if (!inp) return;
      var id = inp.getAttribute('data-row'), f = inp.getAttribute('data-f'), r = rowOf(id);
      draft[id] = draft[id] || {};
      var p = R.parseCell(f, inp.value);
      if (p.ok && p.v === r[f]) delete draft[id][f]; else draft[id][f] = inp.value;
      if (!Object.keys(draft[id]).length) delete draft[id];
      repaintRow(id);
    });
    tbody.addEventListener('change', function (e) {
      var c = e.target.closest('[data-sel]'); if (!c) return;
      if (c.checked) selected[c.getAttribute('data-sel')] = 1; else delete selected[c.getAttribute('data-sel')];
      paintBar();
    });
    all.addEventListener('change', function () { visible().forEach(function (r) { if (all.checked) selected[r.id] = 1; else delete selected[r.id]; }); render(); });
    chips.addEventListener('click', function (e) { var b = e.target.closest('[data-f]'); if (!b) return; filter = b.getAttribute('data-f'); render(); var nb = $('[data-f="' + filter + '"]', chips); if (nb) nb.focus(); });
    q.addEventListener('input', render);
    function batch(p) {
      var ids = Object.keys(selected);
      if (!ids.length) { toast('Сначала отметьте строки галочками'); return; }
      if (!isFinite(p) || p === 0 || p < -90 || p > 300) { toast('Процент — число от −90 до 300, не ноль'); pct.focus(); return; }
      var n = 0, skip = 0;
      ids.forEach(function (id) {
        var r = rowOf(id), e = eff(r);
        if (e.price == null) { skip++; return; }
        var v = Math.max(1, Math.round(e.price * (1 + p / 100)));
        draft[id] = draft[id] || {}; draft[id].price = String(v); n++;
      });
      render();
      toast('Цены ' + (p > 0 ? '+' : '−') + Math.abs(p) + '% для ' + n + ' поз.' + (skip ? ' · пропущено с ошибкой цены: ' + skip : '') + ' — не забудьте сохранить');
    }
    $$('[data-ven-batch]', pg).forEach(function (b) {
      b.addEventListener('click', function () {
        var sign = +b.getAttribute('data-ven-batch'), v = parseFloat(String(pct.value).replace(',', '.'));
        batch(sign * Math.abs(v));
      });
    });
    btnSave.addEventListener('click', function () {
      var bad = S.price.filter(function (r) { return draft[r.id] && Object.keys(eff(r).invalid).length; });
      if (bad.length) {
        filter = 'changed'; render();
        var first = $('.pv-cell.pv-invalid', tbody); if (first) first.focus();
        toast('Исправьте ошибки ввода: ' + bad.length + ' поз.'); return;
      }
      var n = 0;
      Object.keys(draft).forEach(function (id) {
        var r = rowOf(id), e = eff(r);
        ['price', 'stock', 'lead'].forEach(function (f) { if (f in draft[id]) { r[f] = e[f]; n++; } });
        r.source = 'ручная правка'; r.editedAt = nowIso();
        if (r.error && r.price != null && r.stock != null && r.lead != null) delete r.error;
      });
      var rows = Object.keys(draft).length; draft = {};
      save('price'); render(); paintCounts();
      toast('Сохранено: ' + n + ' знач. в ' + rows + ' поз. Правки держатся до следующей выгрузки фида');
    });
    btnCancel.addEventListener('click', function () { draft = {}; render(); toast('Несохранённые правки отменены'); });
    $('[data-ven-csv]', pg).addEventListener('click', function () {
      download('prajs-gidromash-' + todayIso() + '.csv', csv([['Код', 'Наименование', 'Цена поставщика, руб.', 'Остаток, шт.', 'Срок, дней', 'Источник', 'Статус']].concat(S.price.map(function (r) {
        return [r.sku, r.name, r.price == null ? '' : String(r.price).replace('.', ','), r.stock == null ? '' : r.stock, r.lead == null ? '' : r.lead, r.source, R.rowStatus(r)];
      }))));
    });
    window.addEventListener('beforeunload', function (e) { if (Object.keys(draft).length) { e.preventDefault(); e.returnValue = ''; } });
    render();
  }

  // ═════════ Выгрузка ═════════
  function pageFeed(pg) {
    var form = $('[data-ven-feedform]', pg), run = $('[data-ven-run]', pg), prog = $('[data-ven-progress]', pg), res = $('[data-ven-result]', pg), log = $('[data-ven-log]', pg), sum = $('[data-ven-feedsum]', pg);
    var SCHED = { 'каждый час': 60, 'каждые 2 часа': 120, 'каждые 4 часа': 240, 'раз в сутки': 1440 };
    function fill() {
      form.url.value = S.feed.url; form.schedule.value = S.feed.schedule;
      $$('input[name=format]', form).forEach(function (r) { r.checked = r.value === S.feed.format; });
      hint();
    }
    function hint() {
      var f = (form.querySelector('input[name=format]:checked') || {}).value;
      $('[data-ven-fhint]', pg).textContent = ({ XML: 'XML по схеме ПРОМКОНТУР: offer с полями code, name, price, stock, lead.', YML: 'Яндекс YML: берём offer id, price, count; срок — из param «Срок».', CSV: 'CSV с разделителем «;», первая строка — заголовки: код;наименование;цена;остаток;срок.', API: 'REST API: мы опрашиваем ваш эндпоинт; остатки и резерв — в реальном времени (уровень «Партнёр»).' })[f] || '';
    }
    function paint() {
      var last = S.feed.log[0] || {}, next = new Date(new Date(S.feed.last).getTime() + (SCHED[S.feed.schedule] || 120) * 60000);
      var nextIso = next.getFullYear() + '-' + String(next.getMonth() + 1).padStart(2, '0') + '-' + String(next.getDate()).padStart(2, '0') + 'T' + String(next.getHours()).padStart(2, '0') + ':' + String(next.getMinutes()).padStart(2, '0');
      sum.innerHTML = [[fmtDT(S.feed.last), 'последний обмен · ' + esc(S.feed.format)], [fmtDT(nextIso), 'следующий по расписанию'], [num(last.total || D.company.positionsTotal), 'строк в последнем файле'], [num(last.errors), 'строк с ошибками']]
        .map(function (x) { return '<div class="blueprint pv-stat"><div class="mono pv-stat-v">' + x[0] + '</div><div class="pv-stat-k">' + x[1] + '</div></div>'; }).join('');
      log.innerHTML = R.logRows(S.feed.log);
    }
    form.addEventListener('change', function (e) { if (e.target.name === 'format') hint(); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var u = form.url.value.trim(), err = $('[data-ven-urlerr]', pg);
      var ok = /^https?:\/\/[\w.-]+\.[a-zа-я]{2,}(\/[^\s]*)?$/i.test(u);
      form.url.classList.toggle('pk-invalid', !ok); err.hidden = ok;
      if (!ok) { form.url.setAttribute('aria-invalid', 'true'); form.url.focus(); return; }
      form.url.removeAttribute('aria-invalid');
      S.feed.url = u; S.feed.format = form.querySelector('input[name=format]:checked').value; S.feed.schedule = form.schedule.value;
      save('feed'); paint(); toast('Настройки выгрузки сохранены');
    });
    run.addEventListener('click', function () {
      run.disabled = true; res.hidden = true; prog.hidden = false;
      var bar = $('.pv-progress-fill', prog), label = $('[data-ven-stage]', prog), wrapper = $('[role=progressbar]', prog);
      var stages = [[0, 'Скачиваем файл ' + S.feed.url.replace(/^https?:\/\//, '')], [22, 'Разбираем ' + S.feed.format], [55, 'Сверяем цены и остатки с прайсом'], [85, 'Публикуем изменения на витрине']];
      var p = 0, t0 = Date.now();
      var timer = setInterval(function () {
        p = Math.min(100, p + 2 + Math.random() * 3);
        var st = stages.filter(function (s) { return p >= s[0]; }).pop();
        bar.style.width = p + '%'; wrapper.setAttribute('aria-valuenow', String(Math.round(p))); label.textContent = st[1] + ' · ' + Math.round(p) + '%';
        if (p < 100) return;
        clearInterval(timer);
        // строки, которые поставщик исправил вручную в прайсе, фид больше не помечает ошибкой
        var errs = S.feed.rowErrors.filter(function (e) { var row = S.price.filter(function (r) { return r.sku === e.sku; })[0]; return !row || row.error; });
        var total = D.company.positionsTotal + Math.floor(Math.random() * 7), upd = 10 + Math.floor(Math.random() * 380);
        var entry = { ts: nowIso(), dur: Math.max(1, Math.round((Date.now() - t0) / 1000)) + 44, total: total, updated: upd, errors: errs.length, result: errs.length ? 'С ошибками' : 'Успешно', note: 'Запущен вручную из кабинета' };
        S.feed.log.unshift(entry); S.feed.log = S.feed.log.slice(0, 30); S.feed.last = entry.ts; save('feed');
        prog.hidden = true; run.disabled = false; paint(); paintCounts();
        res.hidden = false;
        res.innerHTML = '<div class="pv-result-head">' + tag(entry.result) + '<strong>Обработано ' + num(total) + ' строк · обновлено цен и остатков: ' + num(upd) + ' · ошибок: ' + errs.length + '</strong></div>' +
          (errs.length ? '<p class="pv-sub">Строки с ошибками не опубликованы, на витрине остались прошлые значения. Исправьте в файле или вручную в прайсе.</p><div class="pv-scroll"><table class="table pv-table pv-cards"><thead><tr><th>Строка</th><th>Код</th><th>Поле</th><th>Значение</th><th>Ошибка</th></tr></thead><tbody>' + R.errRows(errs) + '</tbody></table></div>' +
            '<div class="pv-actrow"><button type="button" class="btn btn-secondary" data-ven-errcsv>' + ico('ui-download', 'color:currentColor') + ' Ошибки в CSV</button><a class="btn btn-secondary" href="' + BASE + 'kabinet-postavshchika/prajs/">Открыть прайс-редактор</a></div>' : '<p class="pv-sub">Все строки разобраны без ошибок.</p>');
        res.focus();
        var eb = $('[data-ven-errcsv]', res);
        if (eb) eb.addEventListener('click', function () { download('oshibki-obmena-' + todayIso() + '.csv', csv([['Строка', 'Код', 'Поле', 'Значение', 'Ошибка']].concat(errs.map(function (e) { return [e.line, e.sku, e.field, e.value, e.msg]; })))); });
        toast('Обмен завершён: ' + num(total) + ' строк, ошибок ' + errs.length);
      }, window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches ? 20 : 70);
    });
    fill(); paint();
  }

  function plural(n) { var m = n % 10, h = n % 100; return n + ' ' + (m === 1 && h !== 11 ? 'заявка' : m >= 2 && m <= 4 && (h < 12 || h > 14) ? 'заявки' : 'заявок'); }
  // ═════════ Расчёты ═════════
  function pageSettle(pg) {
    var stats = $('[data-ven-stats]', pg), body = $('[data-ven-payouts]', pg), acts = $('[data-ven-acts]', pg);
    function render() {
      var c = S.orders, toPay = c.filter(function (o) { return o.status === 'К расчёту'; }), wait = c.filter(function (o) { return o.status === 'Доставлена'; });
      var s = function (l) { return l.reduce(function (a, o) { return a + orderSum(o); }, 0); };
      var plans = toPay.map(function (o) { return o.payPlan; }).filter(Boolean).sort();
      stats.innerHTML = [[rub(s(toPay)), 'к оплате · ' + plural(toPay.length)], [rub(s(wait)), 'ждут УПД · ' + plural(wait.length)], [rub(D.settlements.paidMonth), 'оплачено в сентябре'], [plans[0] ? fmtD(plans[0]) : '—', 'ближайшая выплата']]
        .map(function (x) { return '<div class="blueprint pv-stat"><div class="mono pv-stat-v">' + x[0] + '</div><div class="pv-stat-k">' + x[1] + '</div></div>'; }).join('');
      body.innerHTML = R.payoutRows(R.payouts(c, D), BASE);
    }
    acts.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act-id]'); if (!b) return;
      var a = D.settlements.acts.filter(function (x) { return x.id === b.getAttribute('data-act-id'); })[0];
      download('akt-sverki-' + a.id.replace('act-', '') + '.csv', csv([['Акт сверки взаиморасчётов (демо)'], ['Период', a.period], ['Стороны', 'ПРОМКОНТУР', D.company.name], ['Статус', a.status], [], ['Показатель', 'Сумма, руб.'], ['Отгружено поставщиком', a.sum], ['Оплачено площадкой', a.sum], ['Сальдо на конец периода', 0]]));
    });
    refreshers.push(render); render();
  }

  // ═════════ Настройки ═════════
  function pageSettings(pg) {
    var form = $('[data-ven-settings]', pg), mgr = $('[data-ven-managers]', pg), dirty = $('[data-ven-dirty]', pg);
    var W = JSON.parse(JSON.stringify(S.settings)), changed = false;
    function mark(v) { changed = v; dirty.textContent = v ? 'Есть несохранённые изменения' : 'Все изменения сохранены'; dirty.classList.toggle('pv-dirty', v); }
    function renderManagers() {
      mgr.innerHTML = W.managers.map(function (m) {
        return '<li class="pv-mgr"><span class="pv-ava" aria-hidden="true">' + esc(m.name.split(' ').map(function (x) { return x[0]; }).join('').slice(0, 2)) + '</span><div><strong>' + esc(m.name) + '</strong><div class="pv-sub">' + esc(m.role) + '</div><div class="pv-sub mono">' + esc(m.phone) + ' · ' + esc(m.email) + '</div></div>' +
          '<button type="button" class="pk-del" data-del="' + esc(m.id) + '" aria-label="Удалить: ' + esc(m.name) + '">×</button></li>';
      }).join('');
    }
    function fill() {
      form.minSum.value = W.minSum; form.hideZero.checked = !!W.hideZero;
      $$('[data-reg]', form).forEach(function (c) { c.checked = W.regions[+c.getAttribute('data-reg')].on; });
      $$('[data-cat]', form).forEach(function (c) { c.checked = W.categories[+c.getAttribute('data-cat')].on; });
      $$('[data-nt]', form).forEach(function (c) { var p = c.getAttribute('data-nt').split(':'); c.checked = !!W.notify[+p[0]][p[1]]; });
      renderManagers(); mark(false);
    }
    form.addEventListener('change', function (e) {
      var t = e.target;
      if (t.hasAttribute('data-reg')) W.regions[+t.getAttribute('data-reg')].on = t.checked;
      else if (t.hasAttribute('data-cat')) W.categories[+t.getAttribute('data-cat')].on = t.checked;
      else if (t.hasAttribute('data-nt')) { var p = t.getAttribute('data-nt').split(':'); W.notify[+p[0]][p[1]] = t.checked; }
      else if (t.name === 'hideZero') W.hideZero = t.checked;
      else if (!t.closest('[data-ven-addmgr]')) { /* minSum — при сохранении */ }
      if (!t.closest('[data-ven-addmgr]')) mark(true);
    });
    form.minSum.addEventListener('input', function () { mark(true); });
    mgr.addEventListener('click', function (e) {
      var b = e.target.closest('[data-del]'); if (!b) return;
      if (W.managers.length < 2) { toast('Нужен хотя бы один контакт для заявок'); return; }
      var m = W.managers.filter(function (x) { return x.id === b.getAttribute('data-del'); })[0];
      W.managers = W.managers.filter(function (x) { return x !== m; }); renderManagers(); mark(true);
      toast('Удалён контакт: ' + m.name + ' — сохраните настройки'); var f = $('[data-del]', mgr); if (f) f.focus();
    });
    $('[data-ven-addmgr]', pg).addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); $('[data-ven-addbtn]', pg).click(); } });
    $('[data-ven-addbtn]', pg).addEventListener('click', function () {
      var box = $('[data-ven-addmgr]', pg), f = function (n) { return $('[name=' + n + ']', box); };
      var bad = null;
      $$('.input', box).forEach(function (i) { i.classList.remove('pk-invalid'); i.removeAttribute('aria-invalid'); });
      var name = f('mName').value.trim(), role = f('mRole').value.trim(), phone = f('mPhone').value.trim(), email = f('mEmail').value.trim();
      if (name.length < 3) bad = [f('mName'), 'Имя и фамилия — от 3 символов'];
      else if (!/^\+?[\d\s()\-]{10,20}$/.test(phone) || phone.replace(/\D/g, '').length < 10) bad = [f('mPhone'), 'Телефон: 10–11 цифр, например +7 (495) 000-00-00'];
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) bad = [f('mEmail'), 'Проверьте адрес почты'];
      var err = $('[data-ven-mgrerr]', pg);
      if (bad) { bad[0].classList.add('pk-invalid'); bad[0].setAttribute('aria-invalid', 'true'); bad[0].focus(); err.textContent = bad[1]; err.hidden = false; return; }
      err.hidden = true;
      W.managers.push({ id: 'm' + Date.now(), name: name, role: role || 'Менеджер', phone: phone, email: email });
      $$('.input', box).forEach(function (i) { i.value = ''; });
      renderManagers(); mark(true); toast('Контакт добавлен — сохраните настройки');
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var raw = String(form.minSum.value).replace(/[\s ]/g, ''), err = $('[data-ven-minerr]', pg);
      if (!/^\d{1,8}$/.test(raw)) { form.minSum.classList.add('pk-invalid'); form.minSum.setAttribute('aria-invalid', 'true'); err.hidden = false; form.minSum.focus(); toast('Проверьте минимальную сумму заказа'); return; }
      form.minSum.classList.remove('pk-invalid'); form.minSum.removeAttribute('aria-invalid'); err.hidden = true;
      if (!W.regions.some(function (r) { return r.on; })) { toast('Отметьте хотя бы один регион отгрузки'); return; }
      if (!W.categories.some(function (r) { return r.on; })) { toast('Отметьте хотя бы одно направление'); return; }
      W.minSum = parseInt(raw, 10);
      S.settings = JSON.parse(JSON.stringify(W)); save('settings'); fill();
      toast('Настройки сохранены · минимальная сумма ' + num(W.minSum) + ' ₽');
    });
    $('[data-ven-undo]', pg).addEventListener('click', function () { W = JSON.parse(JSON.stringify(S.settings)); fill(); toast('Изменения отменены'); });
    $('[data-ven-reset]', pg).addEventListener('click', function () {
      modal({ title: 'Сбросить демо-данные кабинета?', lead: 'Заявки, прайс, журнал обменов и настройки вернутся к исходному состоянию демо.', ok: 'Сбросить', danger: true, body: '',
        onOk: function () { try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf(LS) === 0) localStorage.removeItem(k); }); } catch (e) {} location.reload(); } });
    });
    window.addEventListener('beforeunload', function (e) { if (changed) { e.preventDefault(); e.returnValue = ''; } });
    fill();
  }

  // ═════════ Экран из макета: /kabinet-postavshchika/ ═════════
  function pageMockup(scr) {
    var V = BASE + 'kabinet-postavshchika/';
    var NAV = { 'Заявки': ['zayavki/', 'new'], 'Прайс и остатки': ['prajs/', 'err'], 'Отгрузки': ['zayavki/?st=' + encodeURIComponent('Собрана'), 'work'], 'Расчёты': ['raschety/', 'pay'], 'Направления': ['nastrojki/#napravleniya', ''], 'Договор и реквизиты': ['nastrojki/', ''] };
    $$('nav.blueprint a.row-hover', scr).forEach(function (a) {
      var label = txt(a.querySelector('span')), m = NAV[label.replace(/ /g, ' ')]; if (!m) return;
      a.href = V + m[0]; a.removeAttribute('data-demo');
      var c = a.querySelector('.mono'); if (c && m[1]) c.setAttribute('data-ven-count', m[1]);
    });
    $$('button', scr).forEach(function (b) {
      var t = txt(b), to = /^Настроить выгрузку$/.test(t) ? 'vygruzka/' : /^Загрузить прайс$/.test(t) ? 'prajs/' : null;
      if (!to) return;
      var a = document.createElement('a'); a.className = b.className; a.href = V + to; a.innerHTML = b.innerHTML; a.style.cssText = b.getAttribute('style') || ''; a.style.textDecoration = 'none';
      b.replaceWith(a);
    });
    // показатели
    var st = $$('.mono', scr).filter(function (el) { var k = el.nextElementSibling; return k && /новая заявка|новых заяв/.test(txt(k)); })[0];
    if (st) refreshers.push(function () { var n = R.counts(S.orders)['Новая'] || 0; st.textContent = n; st.nextElementSibling.textContent = n === 1 ? 'новая заявка' : 'новых заявок'; });

    // таблица прайса: живые поля, чекбоксы, пакет −5%, сохранение
    var priceTable = $$('table', scr).filter(function (t) { return /Остаток/.test(txt(t.querySelector('thead'))); })[0];
    if (priceTable) {
      var pdraft = {}, psel = {};
      var heads = $$('thead th', priceTable).map(txt), col = function (re) { for (var i = 0; i < heads.length; i++) if (re.test(heads[i])) return i; return -1; };
      var cPos = col(/Позиция/), cSrc = col(/Источник/), cSt = col(/Статус/);
      $$('tbody tr', priceTable).forEach(function (tr) {
        var posCell = tr.children[cPos], skuEl = posCell && $$('.mono', posCell).pop(), sku = txt(skuEl), row = S.price.filter(function (r) { return r.sku === sku; })[0]; if (!row) return;
        tr.setAttribute('data-sku', sku);
        var inputs = $$('input.input', tr), fields = ['price', 'stock', 'lead'];
        inputs.forEach(function (inp, i) {
          var f = fields[i]; inp.setAttribute('data-f', f); inp.setAttribute('aria-label', ({ price: 'Цена, ₽', stock: 'Остаток', lead: 'Срок, дней' })[f] + ': ' + row.name);
          inp.value = row[f] == null ? '' : num(row[f]).replace(/ /g, ' ');
          inp.addEventListener('input', function () {
            var p = R.parseCell(f, inp.value);
            inp.classList.toggle('pv-invalid', !p.ok); inp.title = p.ok ? '' : p.msg; inp.classList.toggle('pv-changed', true);
            pdraft[sku] = pdraft[sku] || {}; pdraft[sku][f] = inp.value;
          });
        });
        var box = tr.querySelector('td:first-child > span[style*="width: 14px"]');
        if (box) {
          box.setAttribute('role', 'checkbox'); box.setAttribute('tabindex', '0'); box.setAttribute('aria-label', 'Выбрать: ' + row.name); box.style.cursor = 'pointer';
          var on = /accent/.test(box.getAttribute('style') || ''); if (on) psel[sku] = 1; box.setAttribute('aria-checked', String(on));
          var toggle = function () { var v = !psel[sku]; if (v) psel[sku] = 1; else delete psel[sku]; box.style.background = v ? 'var(--color-accent)' : 'transparent'; box.setAttribute('aria-checked', String(v)); };
          box.addEventListener('click', toggle);
          box.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); } });
        }
        var paintRow = function () {
          var cells = tr.children;
          if (cells[cSrc]) cells[cSrc].textContent = row.source === 'ручная правка' ? 'правка вручную' : 'XML фид';
          if (cells[cSt]) cells[cSt].innerHTML = tag(R.rowStatus(row));
        };
        paintRow(); tr._pv = { row: row, inputs: inputs, paint: paintRow };
      });
      var card = priceTable.closest('.blueprint');
      $$('button', card).forEach(function (b) {
        var t = txt(b);
        if (/^Изменить цены на/.test(t)) b.addEventListener('click', function () {
          var ids = Object.keys(psel); if (!ids.length) { toast('Отметьте строки квадратиками слева'); return; }
          ids.forEach(function (sku) {
            var tr = $('tr[data-sku="' + CSS.escape(sku) + '"]', priceTable); if (!tr) return;
            var inp = tr._pv.inputs[0], p = R.parseCell('price', inp.value); if (!p.ok) return;
            inp.value = String(Math.max(1, Math.round(p.v * 0.95))); inp.classList.add('pv-changed');
            pdraft[sku] = pdraft[sku] || {}; pdraft[sku].price = inp.value;
          });
          toast('Цены −5% для ' + ids.length + ' поз. — нажмите «Сохранить правки»');
        });
        if (/^Сохранить правки$/.test(t)) b.addEventListener('click', function () {
          var skus = Object.keys(pdraft); if (!skus.length) { toast('Правок нет'); return; }
          var bad = $('.pv-invalid', priceTable); if (bad) { bad.focus(); toast('Исправьте значение: ' + (bad.title || 'нужно число')); return; }
          skus.forEach(function (sku) {
            var tr = $('tr[data-sku="' + CSS.escape(sku) + '"]', priceTable), row = tr._pv.row;
            Object.keys(pdraft[sku]).forEach(function (f) { row[f] = R.parseCell(f, pdraft[sku][f]).v; });
            row.source = 'ручная правка'; if (row.error && row.price != null && row.stock != null && row.lead != null) delete row.error;
            tr._pv.inputs.forEach(function (i) { i.classList.remove('pv-changed'); }); tr._pv.paint();
          });
          pdraft = {}; save('price'); paintCounts(); toast('Прайс сохранён: ' + skus.length + ' поз.');
        });
      });
      var inp = $('input[placeholder]', card);
      if (inp) { inp.setAttribute('aria-label', 'Поиск по прайсу'); inp.placeholder = 'Код или наименование'; inp.addEventListener('input', function () { var s = inp.value.trim().toLowerCase(); $$('tbody tr', priceTable).forEach(function (tr) { tr.hidden = !!s && txt(tr).toLowerCase().indexOf(s) < 0; }); }); }
    }

    // таблица заявок: статусы и действия из состояния
    var ordTable = $$('table', scr).filter(function (t) { return /Сумма отгрузки/.test(txt(t.querySelector('thead'))); })[0];
    if (ordTable) {
      var paintOrders = function () {
        $$('tbody tr', ordTable).forEach(function (tr) {
          var c00 = tr.children[0], lnk = c00.querySelector('a'), id = txt(lnk || c00.firstChild), o = byId(id); if (!o) return;
          tr.setAttribute('data-href', V + 'zayavka/' + slug(o.id) + '/');
          var tagEl = tr.querySelector('.tag'); if (tagEl) tagEl.outerHTML = tag(o.status);
          var cell = tr.lastElementChild, a = R.actions(o)[0], c0 = tr.children[0];
          if (!c0.querySelector('a')) { if (c0.firstChild && c0.firstChild.nodeType === 3) c0.firstChild.nodeValue = ''; c0.insertAdjacentHTML('afterbegin', '<a class="pv-link mono" href="' + V + 'zayavka/' + slug(o.id) + '/">' + esc(o.id) + '</a>'); }
          cell.innerHTML = a ? '<button type="button" class="btn ' + (a.primary ? 'btn-primary' : 'btn-secondary') + '" style="font-size:13px" data-ven-act="' + a.act + '" data-id="' + esc(o.id) + '">' + esc(a.label) + '</button>'
            : '<a class="btn btn-secondary" style="font-size:13px;text-decoration:none" href="' + V + 'zayavka/' + slug(o.id) + '/">Открыть</a>';
        });
      };
      refreshers.push(paintOrders);
    }
    refresh();
  }

  // ── запуск: данные в странице или (на экране макета) из страницы заявок ──
  function start() {
    var el = document.getElementById('pk-ven-data');
    if (el) { try { return boot(JSON.parse(el.textContent)); } catch (e) { console.warn('pk-ven: данные не читаются', e); return; } }
    fetch(BASE + 'kabinet-postavshchika/zayavki/', { credentials: 'same-origin' }).then(function (r) { return r.text(); }).then(function (html) {
      var m = html.match(/<script type="application\/json" id="pk-ven-data">([\s\S]*?)<\/script>/);
      if (m) boot(JSON.parse(m[1]));
    }).catch(function (e) { console.warn('pk-ven: кабинет не запущен', e); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

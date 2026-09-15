// ПРОМКОНТУР — кабинет закупщика: заказы, согласование, автозакупка, запросы КП, документы, спецификации,
// сотрудники, реквизиты, обзор и уведомления. Все страницы — шаблоны tools/gen_cabinet.js (экранов макета больше нет).
// Состояние — localStorage с префиксом pk:cab: (демо-компания) или pk:cab:<ключ компании>: (компания, зарегистрированная
// на /vhod/ — стартует пустой), начальное — JSON из страницы (#pk-cab-data).
// Весь вывод — через textContent/атрибуты, без вставки строк в innerHTML.
(function () {
  'use strict';
  var BASE = (document.querySelector('link[rel="manifest"]') || { getAttribute: function () { return '/site.webmanifest'; } }).getAttribute('href').replace('site.webmanifest', '');
  var PATH = location.pathname.slice(BASE.length - 1).replace(/^\//, '');
  var PREFIX = 'pk:cab:';
  var SEED = null, AUTH = null, IS_NEW = false, CAB_KEY = 'seed';

  // ═════════ утилиты ═════════
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || document).querySelectorAll(s)); }
  function txt(el) { return el ? (el.textContent || '').replace(/[\s  ]+/g, ' ').trim() : ''; }
  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function h(tag, a, kids) {
    var e = document.createElement(tag);
    if (a) for (var k in a) {
      var v = a[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'style') e.setAttribute('style', v);
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (k === 'value' || k === 'checked' || k === 'selected' || k === 'disabled') e[k] = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    add(e, kids);
    return e;
  }
  function add(e, kids) {
    if (kids == null) return;
    if (!Array.isArray(kids)) kids = [kids];
    kids.forEach(function (c) {
      if (c == null || c === false) return;
      if (Array.isArray(c)) add(e, c);
      else e.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
    });
  }
  function ico(id, size) { return h('span', { class: 'ico ico-' + (size || 16) + ' ' + id, 'aria-hidden': 'true' }); }
  function money(n) { return n == null ? 'по запросу' : String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽'; }
  function num(s) { var d = String(s == null ? '' : s).replace(/[^\d]/g, ''); return d ? +d : 0; }
  var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  function pd(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function fdate(s, withYear) { var d = pd(s); if (!d) return '—'; return d.getDate() + ' ' + MONTHS[d.getMonth()] + (withYear || d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''); }
  function today() { return iso(new Date()); }
  function addDays(s, n) { var d = pd(s) || new Date(); d.setDate(d.getDate() + n); return iso(d); }
  function plural(n, a, b, c) { var m = n % 10, mm = n % 100; return m === 1 && mm !== 11 ? a : m >= 2 && m <= 4 && (mm < 10 || mm >= 20) ? b : c; }
  function uid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

  // ═════════ тост ═════════
  var toastEl;
  function toast(text) {
    if (!toastEl) {
      toastEl = h('div', { class: 'pk-toast pk-cab-toast', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = text; toastEl.classList.add('on');
    clearTimeout(toastEl._t); toastEl._t = setTimeout(function () { toastEl.classList.remove('on'); }, 3800);
  }

  // ═════════ состояние ═════════
  var KEYS = ['orders', 'approvals', 'regular', 'autobuy', 'quotes', 'documents', 'specs', 'employees', 'company', 'addresses', 'deferral', 'notify'];
  var ST = {};
  function lsGet(k) { try { var v = localStorage.getItem(PREFIX + k); return v == null ? undefined : JSON.parse(v); } catch (e) { return undefined; } }
  function lsSet(k, v) { try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch (e) {} }
  function hash(str) { var x = 5381; for (var i = 0; i < str.length; i++) x = (x * 33 + str.charCodeAt(i)) >>> 0; return x.toString(36); }
  // чей кабинет: демо-компания из данных или новая компания из регистрации (1.6)
  function pickCompany() {
    var s = AUTH || {};
    if (s.cabKey) CAB_KEY = s.cabKey;
    else if (s.newCompany || (s.inn && s.inn !== SEED.company.inn) || (s.company && s.company !== SEED.company.name)) CAB_KEY = 'c' + hash(String(s.inn || '') + '|' + String(s.company || s.name || ''));
    IS_NEW = CAB_KEY !== 'seed';
    PREFIX = IS_NEW ? 'pk:cab:' + CAB_KEY + ':' : 'pk:cab:';
  }
  function baseState(k) {
    if (k === 'notify') return clone(SEED.notifications);
    if (!IS_NEW) return clone(SEED[k]);
    var s = AUTH || {};
    switch (k) {
      case 'orders': case 'approvals': case 'regular': case 'quotes': case 'documents': case 'specs': case 'addresses': return [];
      case 'deferral': return { limit: 0, used: 0, days: 0 };
      case 'company': return { name: s.company || 'Новая компания', inn: s.inn || '', kpp: '', ogrn: '', address: '', director: s.name || '', bank: '', bik: '', ks: '', rs: '', email: s.email || '', phone: s.phone || '' };
      case 'employees': return [{ id: 'e1', name: s.name || 'Закупщик', position: 'Закупщик', role: 'Закупщик', limit: 300000, phone: s.phone || '', email: s.email || '', you: true }];
      default: return clone(SEED[k]);
    }
  }
  function loadState() {
    pickCompany();
    var ver = String(SEED.orders.length) + ':' + JSON.stringify(SEED).length;
    if (lsGet('seed') !== ver) { KEYS.forEach(function (k) { try { localStorage.removeItem(PREFIX + k); } catch (e) {} }); lsSet('seed', ver); }
    KEYS.forEach(function (k) { var v = lsGet(k); ST[k] = v === undefined || (k === 'notify' && (!v || Array.isArray(v))) ? baseState(k) : v; });
  }
  // название и ИНН компании — в сессию, чтобы шапка сайта показывала то же, что кабинет (3.8)
  function syncSession(force) {
    if (!window.PK_AUTH || !PK_AUTH.get || !PK_AUTH.login) return;
    var s = PK_AUTH.get(); if (!s || s.role !== 'buyer') return;
    if (s.company === ST.company.name && (s.inn || '') === (ST.company.inn || '') && s.cabKey === CAB_KEY) return;
    if (!force && s.company === ST.company.name && (!IS_NEW || s.cabKey === CAB_KEY)) return; // при открытии — только если есть что поправить
    var x = {}; for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) x[k] = s[k];
    x.company = ST.company.name; x.inn = ST.company.inn; x.cabKey = CAB_KEY;
    try { AUTH = PK_AUTH.login('buyer', s.phone, x) || AUTH; } catch (e) {}
  }
  function save() { for (var i = 0; i < arguments.length; i++) lsSet(arguments[i], ST[arguments[i]]); paintCounts(); }
  function prod(slug) { return SEED.products[slug] || { name: slug, sku: '', price: 0, img: '', href: '' }; }
  function imgUrl(id) { return id ? BASE + 'img/' + id + '.jpg' : ''; }
  function orderHref(id) { var p = SEED.orderPaths && SEED.orderPaths[id]; return p ? BASE + p : BASE + 'kabinet/zakaz/?n=' + encodeURIComponent(id); }
  function findOrder(id) { return ST.orders.filter(function (o) { return o.id === id; })[0]; }
  function lineSum(items) { return items.reduce(function (a, x) { return a + x.price * x.qty; }, 0); }
  function empByRole(role) { return ST.employees.filter(function (e) { return e.role === role; })[0]; }
  function userName() { return AUTH && AUTH.name ? AUTH.name : SEED.user.short; }

  var COUNTS = {
    orders: function () { return ST.orders.length; },
    approvals: function () { return ST.approvals.filter(function (a) { return a.status === 'wait' || a.status === 'returned'; }).length; },
    regular: function () { return ST.regular.length; },
    quotes: function () { return ST.quotes.filter(function (q) { return !/Принято|Отозван/.test(q.status); }).length; },
    documents: function () { return ST.documents.length; },
    specs: function () { return ST.specs.length; },
    employees: function () { return ST.employees.length; }
  };
  function paintCounts() {
    $$('[data-cab-count]').forEach(function (el) { var f = COUNTS[el.getAttribute('data-cab-count')]; if (f) el.textContent = f(); });
    $$('[data-cab-company]').forEach(function (el) { el.textContent = ST.company.name; });
    $$('[data-cab-inn]').forEach(function (el) { el.textContent = ST.company.inn ? 'ИНН ' + ST.company.inn : 'ИНН не указан'; });
  }

  // ── корзина сайта: pk:cart2 = [{sku, name, note, img, price, qty}] ──
  function addToCart(lines, silent) {
    var cart; try { cart = JSON.parse(localStorage.getItem('pk:cart2') || 'null'); } catch (e) { cart = null; }
    if (!Array.isArray(cart)) cart = [];
    var n = 0;
    lines.forEach(function (l) {
      var p = prod(l.slug); if (!p.price) return;
      var ex = cart.filter(function (c) { return c.sku && p.sku ? c.sku === p.sku : c.name === p.name; })[0];
      if (ex) ex.qty = (+ex.qty || 0) + (+l.qty || 1);
      else cart.push({ sku: p.sku, name: p.name, note: p.stock || '', img: imgUrl(p.img), price: p.price, qty: +l.qty || 1 });
      n++;
    });
    try { localStorage.setItem('pk:cart2', JSON.stringify(cart)); } catch (e) {}
    $$('header a[href$="korzina/"] .mono').forEach(function (el) { el.textContent = cart.length; });
    $$('header a[href$="korzina/"]').forEach(function (a) { if (a.hasAttribute('aria-label')) a.setAttribute('aria-label', 'Корзина: ' + cart.length); });
    if (!silent) toast(n ? 'В корзину добавлено позиций: ' + n + '. Всего в корзине: ' + cart.length : 'Позиции без цены — запросите КП');
    return n;
  }
  function readCart() { try { var c = JSON.parse(localStorage.getItem('pk:cart2') || 'null'); return Array.isArray(c) ? c : []; } catch (e) { return []; } }

  // ── новые сущности ──
  function nextNum(list, re) { return list.reduce(function (m, x) { var r = re.exec(x.id); return r ? Math.max(m, +r[1]) : m; }, 0) + 1; }
  function createOrder(items, meta) {
    var id = 'ПК-' + nextNum(ST.orders, /^ПК-(\d+)/);
    var lines = items.map(function (l) { var p = prod(l.slug); return { slug: l.slug, qty: +l.qty || 1, price: l.price != null ? l.price : p.price, vendor: l.vendor || 'Гидромаш' }; });
    var def = ST.deferral && ST.deferral.limit > 0;
    var o = Object.assign({ id: id, date: today(), status: 'Счёт', items: lines, total: lineSum(lines), payment: def ? 'Отсрочка ' + (ST.deferral.days || 30) + ' дней' : 'Оплата по счёту', payDue: def ? addDays(today(), ST.deferral.days || 30) : addDays(today(), 5), author: userName() }, meta || {});
    ST.orders.unshift(o);
    ST.documents.unshift({ id: 'СЧ-' + nextNum(ST.documents, /^СЧ-(\d+)/), type: 'Счёт', title: 'Счёт на оплату', order: id, date: today(), total: o.total, edo: o.payment.indexOf('Отсрочка') === 0 ? 'Отсрочка' : 'Ожидает оплаты' });
    save('orders', 'documents');
    return o;
  }

  // ═════════ общие элементы ═════════
  // единая шкала статусов (4.7): tag-accent — новое/в работе, tag-outline — ждёт действия, tag-neutral — завершено, tag-danger — отмена/отказ
  var STATUS_TAG = { 'Оформлен': 'tag-accent', 'Счёт': 'tag-outline', 'Оплачен': 'tag-accent', 'Отгружен': 'tag-accent', 'В пути': 'tag-accent', 'Доставлен': 'tag-outline', 'Закрыт': 'tag-neutral', 'Отменён': 'tag-danger' };
  function tag(t, cls) { return h('span', { class: 'tag ' + (cls || 'tag-neutral') + ' pk-cab-tag', text: t }); }
  function btn(text, cls, onclick, extra) { return h('button', Object.assign({ type: 'button', class: 'btn ' + (cls || 'btn-secondary'), onclick: onclick }, extra || {}), text); }
  function thumb(img, alt) { var s = h('span', { class: 'thumb pk-cab-thumb', 'aria-hidden': 'true' }); if (img) s.style.backgroundImage = 'url("' + imgUrl(img) + '")'; return s; }
  function card(kids, cls) { return h('section', { class: 'blueprint pk-cab-card' + (cls ? ' ' + cls : '') }, kids); }
  var fid = 0;
  function field(label, control, hint) {
    var id = control.id || (control.id = 'pk-cab-f' + (++fid));
    return h('div', { class: 'field pk-cab-field' }, [h('label', { for: id, text: label }), control, hint ? h('span', { class: 'pk-cab-hint', text: hint }) : null]);
  }
  function input(a) { return h('input', Object.assign({ class: 'input', type: 'text' }, a)); }
  function select(opts, value, a) {
    var s = h('select', Object.assign({ class: 'input pk-cab-select' }, a), opts.map(function (o) { var v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o; return h('option', { value: v, selected: String(v) === String(value), text: t }); }));
    s.value = String(value == null ? '' : value); return s;
  }
  function setErr(inp, msg) {
    var f = inp.closest('.field'), e = f && $('.pk-err', f);
    if (!msg) { inp.classList.remove('pk-invalid'); inp.removeAttribute('aria-invalid'); if (e) e.remove(); return true; }
    inp.classList.add('pk-invalid'); inp.setAttribute('aria-invalid', 'true');
    if (!e) { e = h('span', { class: 'pk-err', id: inp.id + '-err' }); inp.insertAdjacentElement('afterend', e); inp.setAttribute('aria-describedby', e.id); }
    e.textContent = msg; return false;
  }
  function chips(label, list, cur, onpick) {
    return h('div', { class: 'pk-cab-chips', role: 'group', 'aria-label': label }, list.map(function (c) {
      var v = Array.isArray(c) ? c[0] : c, t = Array.isArray(c) ? c[1] : c;
      return h('button', { type: 'button', class: 'pk-cab-chip' + (v === cur ? ' is-on' : ''), 'aria-pressed': String(v === cur), onclick: function () { onpick(v); } }, t);
    }));
  }
  function table(cols, rows, cls) {
    return h('div', { class: 'pk-cab-tablewrap' }, h('table', { class: 'table pk-cab-table' + (cls ? ' ' + cls : '') }, [
      h('thead', null, h('tr', null, cols.map(function (c) { return h('th', { scope: 'col', class: c.cls || null }, c.hidden ? h('span', { class: 'pk-vh', text: c.t }) : c.t); }))),
      h('tbody', null, rows.map(function (r) {
        var tr = h('tr', r.attrs || null, r.cells.map(function (cell, i) { return h('td', { 'data-label': cols[i].t, class: cols[i].cls || null }, typeof cell === 'string' || typeof cell === 'number' ? h('span', { class: 'pk-cab-cellt', text: String(cell) }) : cell); }));
        return tr;
      }))
    ]));
  }
  function empty(text, action) { return h('div', { class: 'blueprint pk-cab-empty' }, [ico('i-ui-history', 24), h('p', { text: text }), Array.isArray(action) ? h('div', { class: 'pk-cab-actions pk-cab-empty-a' }, action) : action || null]); }
  // пустой кабинет новой компании: куда идти за первой закупкой
  function startLinks(kp) {
    return [
      h('a', { class: 'btn btn-primary', href: BASE + 'napravleniya/', text: 'Найти в каталоге' }),
      h('a', { class: 'btn btn-secondary', href: BASE + 'zayavka-spiskom/', text: 'Загрузить заявку списком' }),
      kp === false ? null : h('a', { class: 'btn btn-secondary', href: BASE + 'kabinet/zaprosy-kp/#new', text: 'Запросить КП' })
    ];
  }

  // ═════════ файлы: CSV и счёт (2.1, 2.2) ═════════
  function csvCell(v) { v = v == null ? '' : String(v); return /[;"\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function saveFile(name, text, type) {
    var blob = new Blob([text], { type: type });
    var url = URL.createObjectURL(blob);
    var a = h('a', { href: url, download: name, style: 'display:none' });
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }
  function downloadCsv(name, rows) { saveFile(name, '\ufeff' + rows.map(function (r) { return r.map(csvCell).join(';'); }).join('\r\n'), 'text/csv;charset=utf-8'); }
  function vendorsOf(o) { return o.items.map(function (i) { return i.vendor; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', '); }
  function exportOrders() {
    if (!ST.orders.length) { toast('Заказов пока нет — реестр пуст.'); return; }
    var rows = [['Номер', 'Дата', 'Статус', 'Позиции', 'Поставщики', 'Оплата', 'Автор', 'Сумма с НДС, ₽']];
    ST.orders.forEach(function (o) { rows.push([o.id, o.date, o.status, o.items.map(function (i) { return prod(i.slug).name + ' × ' + i.qty; }).join(', '), vendorsOf(o), o.payment || '', o.author || '', o.total]); });
    rows.push(['Итого', '', '', '', '', '', '', ST.orders.reduce(function (a, o) { return a + o.total; }, 0)]);
    downloadCsv('reestr-zakazov-' + today() + '.csv', rows);
    toast('Реестр заказов выгружен: ' + ST.orders.length + ' ' + plural(ST.orders.length, 'заказ', 'заказа', 'заказов') + ' (CSV).');
  }
  function exportDocs() {
    if (!ST.documents.length) { toast('Документов пока нет — реестр пуст.'); return; }
    var rows = [['Документ', 'Номер', 'Тип', 'Заказ', 'Дата', 'Сумма, ₽', 'ЭДО']];
    ST.documents.forEach(function (d) { rows.push([d.title, d.id, d.type, d.order || '', d.date, d.total == null ? '' : d.total, d.edo]); });
    downloadCsv('reestr-dokumentov-' + today() + '.csv', rows);
    toast('Реестр документов выгружен: ' + ST.documents.length + ' шт. (CSV).');
  }
  function fileSlug(id) { return String(id).replace(/[^\wА-Яа-яЁё-]+/g, '-'); }
  function escHtml(v) { return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function invoiceHtml(o, d) {
    var C = ST.company, vat = Math.round(o.total * 20 / 120);
    var rows = o.items.map(function (i, n) { var p = prod(i.slug); return '<tr><td>' + (n + 1) + '</td><td>' + escHtml(p.name) + (p.sku ? '<br><small>арт. ' + escHtml(p.sku) + '</small>' : '') + '</td><td class="r">' + i.qty + ' шт.</td><td class="r">' + escHtml(money(i.price)) + '</td><td class="r">' + escHtml(money(i.price * i.qty)) + '</td></tr>'; }).join('');
    return '<!doctype html><html lang="ru"><head><meta charset="utf-8"><link rel="icon" href="data:,"><title>' + escHtml('Счёт ' + d.id + ' — демо') + '</title><style>' +
      'body{font:14px/1.45 Arial,sans-serif;color:#1d1f20;max-width:820px;margin:24px auto;padding:0 16px}h1{font-size:22px;margin:0 0 4px}table{width:100%;border-collapse:collapse;margin:14px 0}td,th{border:1px solid #bbb;padding:6px 8px;text-align:left;vertical-align:top}.r{text-align:right;white-space:nowrap}.demo{background:#fff4e5;border:1px solid #f3c98b;padding:8px 12px;margin:0 0 16px}.bar{display:flex;gap:10px;margin:0 0 16px}button{font:inherit;padding:8px 14px;cursor:pointer}dl{display:grid;grid-template-columns:160px 1fr;gap:4px 12px;margin:10px 0}dt{color:#666}dd{margin:0}@media print{.bar,.demo{display:none}}' +
      '</style></head><body><div class="bar"><button type="button" onclick="window.print()">Печать</button><button type="button" onclick="window.close()">Закрыть</button></div>' +
      '<p class="demo">Счёт на оплату (демо). Документ сформирован в демо-версии ПРОМКОНТУРА и не является основанием для платежа.</p>' +
      '<h1>Счёт на оплату № ' + escHtml(d.id) + ' от ' + escHtml(fdate(d.date, true)) + '</h1><p>К заказу ' + escHtml(o.id) + '</p>' +
      '<dl><dt>Поставщик</dt><dd>ПРОМКОНТУР (демо-реквизиты)</dd><dt>Покупатель</dt><dd>' + escHtml(C.name) + (C.inn ? ', ИНН ' + escHtml(C.inn) : '') + (C.kpp ? ', КПП ' + escHtml(C.kpp) : '') + '</dd>' +
      (C.address ? '<dt>Адрес</dt><dd>' + escHtml(C.address) + '</dd>' : '') + '<dt>Условия оплаты</dt><dd>' + escHtml(o.payment || 'по счёту') + (o.payDue ? ', до ' + escHtml(fdate(o.payDue, true)) : '') + '</dd></dl>' +
      '<table><thead><tr><th>№</th><th>Товар</th><th class="r">Кол-во</th><th class="r">Цена</th><th class="r">Сумма</th></tr></thead><tbody>' + rows + '</tbody>' +
      '<tfoot><tr><th colspan="4" class="r">Итого с НДС</th><th class="r">' + escHtml(money(o.total)) + '</th></tr><tr><td colspan="4" class="r">в т. ч. НДС 20%</td><td class="r">' + escHtml(money(vat)) + '</td></tr></tfoot></table>' +
      '<p>Всего наименований ' + o.items.length + ', на сумму ' + escHtml(money(o.total)) + '.</p></body></html>';
  }
  function openInvoice(o, d) {
    d = d || ST.documents.filter(function (x) { return x.order === o.id && x.type === 'Счёт'; })[0] || { id: 'СЧ-' + o.id.replace(/\D/g, ''), date: o.date, total: o.total };
    var html = invoiceHtml(o, d), w = null;
    try { w = window.open('', '_blank'); } catch (e) { w = null; }
    if (w && w.document) { w.document.open(); w.document.write(html); w.document.close(); toast('Счёт ' + d.id + ' открыт в новой вкладке — его можно распечатать.'); }
    else { saveFile('schet-' + fileSlug(d.id) + '.html', html, 'text/html;charset=utf-8'); toast('Счёт ' + d.id + ' скачан файлом (браузер не дал открыть вкладку).'); }
  }
  function downloadDoc(d) {
    var o = d.order ? findOrder(d.order) : null;
    if (d.type === 'Счёт' && o) { openInvoice(o, d); return; }
    var C = ST.company, rows = [[d.title + ' ' + d.id + ' (демо)'], ['Дата', d.date], ['Покупатель', C.name + (C.inn ? ', ИНН ' + C.inn : '')], ['Статус ЭДО', d.edo]];
    if (o) {
      rows.push(['Заказ', o.id], [], ['Позиция', 'Артикул', 'Кол-во', 'Цена, ₽', 'Сумма, ₽', 'Поставщик']);
      o.items.forEach(function (i) { var p = prod(i.slug); rows.push([p.name, p.sku, i.qty, i.price, i.price * i.qty, i.vendor]); });
      rows.push(['Итого с НДС', '', '', '', o.total, '']);
    } else if (d.type === 'Акт сверки') {
      rows.push([], ['Заказ', 'Дата', 'Статус', 'Сумма, ₽']);
      ST.orders.forEach(function (x) { rows.push([x.id, x.date, x.status, x.total]); });
    } else if (d.total != null) rows.push(['Сумма, ₽', d.total]);
    downloadCsv(fileSlug(d.id) + '.csv', rows);
    toast(d.title + ' ' + d.id + ' скачан (CSV).');
  }

  // перерисовка с сохранением фокуса
  function mount(view, render) {
    function run() {
      var a = document.activeElement, key = a && a.getAttribute && a.getAttribute('data-k'), sel = null;
      if (key && typeof a.selectionStart === 'number') try { sel = [a.selectionStart, a.selectionEnd]; } catch (e) {}
      view.textContent = '';
      add(view, render(run));
      if (key) { var n = view.querySelector('[data-k="' + key + '"]'); if (n) { n.focus(); if (sel) try { n.setSelectionRange(sel[0], sel[1]); } catch (e) {} } }
    }
    run();
    return run;
  }

  // ═════════ Заказы ═════════
  var STEPS = ['Оформлен', 'Счёт', 'Оплачен', 'Отгружен', 'В пути', 'Доставлен', 'Закрыт'];
  function viewOrders(view) {
    var q = new URLSearchParams(location.search);
    var F = { q: q.get('q') || '', status: q.get('status') || 'all', sort: 'date-desc' };
    return mount(view, function (rerender) {
      if (!ST.orders.length) return empty('Заказов пока нет. Найдите позиции в каталоге, загрузите заявку цеха списком или запросите КП — заказ со счётом появится здесь.', startLinks());
      var list = ST.orders.filter(function (o) {
        if (F.status !== 'all' && o.status !== F.status) return false;
        if (!F.q) return true;
        var hay = (o.id + ' ' + o.items.map(function (i) { var p = prod(i.slug); return p.name + ' ' + p.sku; }).join(' ') + ' ' + o.items.map(function (i) { return i.vendor; }).join(' ')).toLowerCase();
        return F.q.toLowerCase().split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; });
      });
      var srt = { 'date-desc': function (a, b) { return b.date.localeCompare(a.date) || b.id.localeCompare(a.id); }, 'date-asc': function (a, b) { return a.date.localeCompare(b.date) || a.id.localeCompare(b.id); }, 'sum-desc': function (a, b) { return b.total - a.total; }, 'sum-asc': function (a, b) { return a.total - b.total; } };
      list.sort(srt[F.sort]);
      var counts = {}; ST.orders.forEach(function (o) { counts[o.status] = (counts[o.status] || 0) + 1; });
      var statuses = [['all', 'Все · ' + ST.orders.length]].concat(STEPS.concat(['Отменён']).filter(function (s) { return counts[s]; }).map(function (s) { return [s, s + ' · ' + counts[s]]; }));
      var total = list.reduce(function (a, o) { return a + o.total; }, 0);
      var search = input({ type: 'search', value: F.q, placeholder: 'Номер заказа, модель, артикул или поставщик', 'data-k': 'orders-q', oninput: function (e) { F.q = e.target.value; rerender(); } });
      var sort = select([['date-desc', 'Сначала новые'], ['date-asc', 'Сначала старые'], ['sum-desc', 'Сумма: по убыванию'], ['sum-asc', 'Сумма: по возрастанию']], F.sort, { 'data-k': 'orders-sort', onchange: function (e) { F.sort = e.target.value; rerender(); } });
      return [
        card([
          h('div', { class: 'pk-cab-toolbar' }, [field('Поиск по номеру или позиции', search), field('Сортировка', sort)]),
          chips('Фильтр по статусу', statuses, F.status, function (v) { F.status = v; rerender(); }),
          h('p', { class: 'pk-cab-summary mono', role: 'status' }, 'Найдено ' + list.length + ' ' + plural(list.length, 'заказ', 'заказа', 'заказов') + ' на ' + money(total))
        ], 'pk-cab-filters'),
        list.length ? card(table(
          [{ t: 'Номер' }, { t: 'Дата' }, { t: 'Позиции' }, { t: 'Поставщики' }, { t: 'Статус' }, { t: 'Сумма', cls: 'pk-num' }],
          list.map(function (o) {
            var first = prod(o.items[0].slug);
            var vendors = o.items.map(function (i) { return i.vendor; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', ');
            return { attrs: { class: 'row-hover pk-cab-rowlink', 'data-href': orderHref(o.id) }, cells: [
              h('a', { href: orderHref(o.id), class: 'mono pk-cab-idlink', text: o.id }),
              fdate(o.date),
              h('div', { class: 'pk-cab-item' }, [thumb(first.img), h('div', null, [h('span', { class: 'pk-cab-item-name', text: first.name + ' · ' + o.items[0].qty + ' шт.' }), o.items.length > 1 ? h('span', { class: 'pk-cab-muted', text: '+ ещё ' + (o.items.length - 1) + ' ' + plural(o.items.length - 1, 'позиция', 'позиции', 'позиций') }) : null])]),
              h('span', { class: 'pk-cab-muted', text: vendors }),
              h('div', { class: 'pk-cab-stcell' }, [tag(o.status, STATUS_TAG[o.status]), o.busNote ? h('span', { class: 'pk-cab-muted', text: o.busNote }) : null]), // bus
              h('span', { class: 'mono', text: money(o.total) })
            ] };
          }), 'pk-cab-orders'), 'pk-cab-tablecard') : empty('По этим условиям заказов нет.', btn('Сбросить фильтры', 'btn-secondary', function () { F.q = ''; F.status = 'all'; rerender(); }))
      ];
    });
  }

  function viewOrder(view) {
    var id = view.getAttribute('data-order') || new URLSearchParams(location.search).get('n') || '';
    return mount(view, function (rerender) {
      var o = findOrder(id);
      var h1 = $('[data-cab-h1]');
      if (!o) {
        if (h1) h1.textContent = 'Заказ не найден';
        return empty('Заказа ' + (id || '') + ' нет в истории этого браузера.', h('a', { class: 'btn btn-primary', href: BASE + 'kabinet/zakazy/', text: 'Все заказы' }));
      }
      if (h1) h1.textContent = 'Заказ ' + o.id;
      document.title = 'Заказ ' + o.id + ' — кабинет закупщика ПРОМКОНТУР';
      var cur = $('.pk-cab-crumbs [aria-current]'); if (cur) cur.textContent = 'Заказ ' + o.id;
      var sub = $('[data-cab-sub]'); if (sub) sub.textContent = 'Оформлен ' + fdate(o.date) + ' · ' + o.author + ' · ' + o.payment + (o.approval ? ' · по заявке ' + o.approval : '');
      var si = STEPS.indexOf(o.status);
      var deferral = /^Отсрочка/.test(o.payment || '');
      var steps = [
        ['Оформлен', 'i-order-created', fdate(o.date), 'заявка принята'],
        ['Счёт', 'i-pay-invoice', fdate(o.date), 'счёт выставлен за 15 минут'],
        ['Оплачен', 'i-order-paid', o.paid ? fdate(o.paid) : si >= 6 ? 'оплачено' : deferral && o.payDue ? 'до ' + fdate(o.payDue) : si >= 2 ? 'оплачено' : 'ожидается', deferral ? 'отсрочка ' + (ST.deferral.days || 30) + ' дней' : 'по счёту'],
        ['Отгружен', 'i-order-shipped', o.shipped ? fdate(o.shipped) : 'ожидается', o.carrier ? o.carrier : 'сборка у поставщиков'],
        ['В пути', 'i-order-delivery', o.eta ? 'прибытие ' + fdate(o.eta) : o.delivered ? 'прибыл ' + fdate(o.delivered) : o.shipped ? 'в дороге' : 'ожидается', o.terminal || 'доставка'],
        ['Доставлен', 'i-ui-approval', o.delivered ? fdate(o.delivered) : 'ожидается', o.status === 'Закрыт' ? 'УПД подписан, заказ закрыт' : 'приёмка и подпись УПД']
      ];
      if (deferral && si >= 3 && si < 6) steps[2][0] = 'Отсрочка';
      var stepper = h('ol', { class: 'pk-cab-stepper', 'aria-label': 'Этапы заказа' }, steps.map(function (s, i) {
        var state = o.status === 'Отменён' ? 'fut' : si >= 6 || i < si || (i === si && i === 5) ? 'done' : i === si ? 'cur' : 'fut';
        if (deferral && i === 2 && si >= 3 && !o.paid) state = si >= 6 ? 'done' : 'cur';
        return h('li', { class: 'pk-cab-step is-' + state, 'aria-current': state === 'cur' ? 'step' : null }, [
          h('span', { class: 'pk-cab-step-dot' }, ico(s[1])),
          h('span', { class: 'pk-cab-step-t', text: s[0] }),
          h('span', { class: 'pk-cab-step-d', text: s[2] }),
          h('span', { class: 'pk-cab-step-d', text: s[3] }),
          h('span', { class: 'pk-vh', text: state === 'done' ? 'выполнено' : state === 'cur' ? 'текущий этап' : 'впереди' })
        ]);
      }));
      var docs = ST.documents.filter(function (d) { return d.order === o.id; });
      var actions = [
        btn('Повторить заказ', 'btn-primary', function () { addToCart(o.items); }, { 'data-cab-act': 'repeat' }),
        btn('Скачать счёт', 'btn-secondary', function () { openInvoice(o); }, { 'data-cab-act': 'invoice' }),
        h('a', { class: 'btn btn-secondary', href: BASE + 'chat/', text: 'Написать в MAX' })
      ];
      if (o.status === 'Счёт') actions.push(btn('Отметить оплату (демо)', 'btn-secondary', function () { o.status = 'Оплачен'; o.paid = today(); o.eta = addDays(today(), 5); ST.documents.forEach(function (d) { if (d.order === o.id && d.type === 'Счёт') d.edo = 'Оплачен'; }); save('orders', 'documents'); toast('Оплата отмечена. Заказ передан поставщикам.'); rerender(); }));
      if (o.status === 'Доставлен') actions.push(btn('Подписать УПД и закрыть', 'btn-secondary', function () { o.status = 'Закрыт'; ST.documents.forEach(function (d) { if (d.order === o.id && d.type === 'УПД') d.edo = 'Подписан'; }); save('orders', 'documents'); toast('УПД подписан, заказ ' + o.id + ' закрыт.'); rerender(); }));
      if (o.status === 'Оформлен' || o.status === 'Счёт') actions.push(btn('Отменить заказ', 'btn-secondary pk-cab-danger', function () { o.status = 'Отменён'; save('orders'); toast('Заказ ' + o.id + ' отменён.'); rerender(); }));
      var vat = Math.round(o.total * 20 / 120);
      return [
        h('div', { class: 'pk-cab-actions pk-cab-actions-row' }, actions),
        card([
          h('div', { class: 'pk-cab-orderhead' }, [tag(o.status, STATUS_TAG[o.status]), o.busNote ? tag(o.busNote, 'tag-outline') : null /* bus */, o.track && o.track !== '—' ? h('span', { class: 'mono pk-cab-muted' }, 'Трек ' + o.track + ' · ' + o.carrier + (o.terminal ? ' · ' + o.terminal : '')) : o.carrier ? h('span', { class: 'pk-cab-muted', text: o.carrier }) : h('span', { class: 'pk-cab-muted', text: 'Трек-номер появится после отгрузки' })]),
          stepper
        ]),
        h('div', { class: 'pk-cab-split' }, [
          card([h('h2', { class: 'pk-cab-h2', text: 'Позиции' }), table(
            [{ t: 'Позиция' }, { t: 'Кол-во', cls: 'pk-num' }, { t: 'Цена', cls: 'pk-num' }, { t: 'Поставщик' }, { t: 'Сумма', cls: 'pk-num' }],
            o.items.map(function (i) {
              var p = prod(i.slug);
              return { cells: [
                h('div', { class: 'pk-cab-item' }, [thumb(p.img), h('div', null, [p.href ? h('a', { href: BASE + p.href, class: 'pk-cab-item-name', text: p.name }) : h('span', { class: 'pk-cab-item-name', text: p.name }), h('span', { class: 'mono pk-cab-muted', text: p.sku })])]),
                h('span', { class: 'mono', text: i.qty + ' шт.' }), h('span', { class: 'mono', text: money(i.price) }), i.vendor, h('span', { class: 'mono', text: money(i.price * i.qty) })
              ] };
            }), 'pk-cab-items')]),
          card([
            h('h2', { class: 'pk-cab-h2' }, [ico('i-doc-generic', 20), 'Документы']),
            docs.length ? h('ul', { class: 'pk-cab-doclist' }, docs.map(function (d) {
              return h('li', null, [h('span', null, [h('span', { class: 'pk-cab-doc-t', text: d.title }), h('span', { class: 'mono pk-cab-muted', text: d.id + ' · ' + fdate(d.date) + ' · ' + d.edo })]),
                h('button', { type: 'button', class: 'btn btn-ghost pk-cab-iconbtn', 'aria-label': 'Скачать ' + d.title + ' ' + d.id, title: d.type === 'Счёт' ? 'Открыть счёт' : 'Скачать CSV', onclick: function () { downloadDoc(d); } }, ico('i-ui-download'))]);
            })) : h('p', { class: 'pk-cab-muted', text: 'Документы появятся после выставления счёта.' }),
            h('div', { class: 'pk-cab-total' }, [h('span', { text: 'Итого с НДС' }), h('span', { class: 'mono', text: money(o.total) })]),
            h('p', { class: 'pk-cab-muted', text: 'в т. ч. НДС 20% — ' + money(vat) + (deferral && o.payDue && o.status !== 'Закрыт' ? ' · оплата до ' + fdate(o.payDue) : '') })
          ])
        ])
      ];
    });
  }

  // ═════════ Согласование ═════════
  var ROUTE = ['Цех', 'Бюджет', 'Закупка'];
  var ROUTE_ROLE = { 'Цех': 'Цех', 'Бюджет': 'Согласующий', 'Закупка': 'Закупщик' };
  function approvalItems(a) { if (a.items) return a.items; var s = ST.specs.filter(function (x) { return x.id === a.spec; })[0] || SEED.specs.filter(function (x) { return x.id === a.spec; })[0]; return s ? s.items : []; }
  function stepState(a, i) {
    if (a.status === 'done') return 'done';
    if (a.status === 'rejected') return i < a.stage ? 'done' : i === a.stage ? 'rejected' : 'idle';
    if (a.status === 'returned') return i === 0 ? 'returned' : 'idle';
    return i < a.stage ? 'done' : i === a.stage ? 'wait' : 'idle';
  }
  function ownerText(a) {
    if (a.status === 'done') return a.order ? 'Заказ ' + a.order : 'Завершена';
    if (a.status === 'rejected') return 'Отклонена';
    if (a.status === 'returned') return 'Возвращена на уточнение';
    var role = ROUTE[a.stage], e = empByRole(ROUTE_ROLE[role]);
    return role + ' · ' + (role === 'Закупка' ? 'вы' : e ? e.name.split(' ').slice(0, 1).join(' ') + ' ' + e.name.split(' ').slice(1).map(function (x) { return x.charAt(0) + '.'; }).join(' ') : '—');
  }
  function decide(a, ok, comment) {
    var role = ROUTE[a.stage];
    var who = role === 'Закупка' || !empByRole(ROUTE_ROLE[role]) ? userName() : empByRole(ROUTE_ROLE[role]).name;
    var stamp = today() + ' ' + new Date().toTimeString().slice(0, 5);
    if (a.status === 'returned') {
      a.status = 'wait'; a.stage = 1;
      a.history.push({ step: 'Цех', who: userName(), decision: 'Уточнена и отправлена повторно', date: stamp, comment: comment || '' });
      save('approvals'); toast('Заявка ' + a.id + ' снова на согласовании бюджета.'); return;
    }
    if (!ok) {
      a.status = 'rejected';
      a.history.push({ step: role, who: who, decision: 'Отклонено', date: stamp, comment: comment });
      busEmit('approval.rejected', { id: a.id, name: a.name, total: a.total, stage: role, comment: comment, company: ST.company.name }); // bus
      save('approvals'); toast('Заявка ' + a.id + ' отклонена.'); return;
    }
    if (a.stage < 2) {
      a.history.push({ step: role, who: who, decision: 'Согласовано', date: stamp, comment: comment || '' });
      a.stage += 1; save('approvals'); toast('Согласовано: ' + a.id + ' передана на этап «' + ROUTE[a.stage] + '».'); return;
    }
    var items = approvalItems(a);
    var o = items.length ? createOrder(items.map(function (i) { return { slug: i.slug, qty: i.qty, vendor: i.vendor }; }), { approval: a.id, author: userName() }) : null;
    a.status = 'done'; a.stage = 3; if (o) a.order = o.id;
    busEmit('approval.done', { id: a.id, name: a.name, total: o ? o.total : a.total, order: o ? o.id : null, company: ST.company.name, author: userName(), items: o ? o.items.map(function (i) { return { slug: i.slug, name: prod(i.slug).name, qty: i.qty, price: i.price }; }) : [] }); // bus
    a.history.push({ step: role, who: who, decision: o ? 'Оформлен заказ ' + o.id : 'Согласовано', date: stamp, comment: comment || '' });
    save('approvals'); toast(o ? 'Заявка ' + a.id + ' согласована, оформлен заказ ' + o.id + ' со счётом.' : 'Заявка ' + a.id + ' согласована.');
  }
  function routeEl(a, small) {
    return h('ol', { class: 'pk-cab-route' + (small ? ' is-small' : ''), 'aria-label': 'Маршрут согласования' }, ROUTE.map(function (r, i) {
      var s = stepState(a, i);
      var lab = { done: 'пройден', wait: 'ждёт решения', idle: 'впереди', rejected: 'отклонено', returned: 'на уточнении' }[s];
      return h('li', { class: 'pk-cab-route-step is-' + s }, [h('span', { class: 'pk-cab-route-dot', 'aria-hidden': 'true' }, s === 'done' ? '✓' : s === 'rejected' ? '×' : String(i + 1)), h('span', { class: 'pk-cab-route-t', text: r }), h('span', { class: 'pk-vh', text: ' — ' + lab })]);
    }));
  }
  function viewApprovals(view) {
    var F = { f: 'active' };
    return mount(view, function (rerender) {
      var list = ST.approvals.filter(function (a) { return F.f === 'all' || (F.f === 'active' ? a.status === 'wait' || a.status === 'returned' : a.status === 'done' || a.status === 'rejected'); });
      var act = COUNTS.approvals();
      return [
        h('div', { class: 'pk-cab-kpis' }, [
          kpi(act, 'заявок ждут решения'),
          kpi(money(ST.approvals.filter(function (a) { return a.status === 'wait'; }).reduce(function (s, a) { return s + a.total; }, 0)), 'на согласовании'),
          kpi(ST.approvals.filter(function (a) { return a.status === 'done'; }).length, 'согласовано и оформлено'),
          kpi('Цех → Бюджет → Закупка', 'маршрут', true)
        ]),
        chips('Показать заявки', [['active', 'Ждут решения · ' + act], ['closed', 'Завершённые'], ['all', 'Все · ' + ST.approvals.length]], F.f, function (v) { F.f = v; rerender(); }),
        list.length ? list.map(function (a) { return approvalCard(a, rerender); }) : !ST.approvals.length ? empty('Заявок на согласование пока нет. Заявка цеха появится здесь и пройдёт маршрут Цех → Бюджет → Закупка.', [h('a', { class: 'btn btn-primary', href: BASE + 'zayavka-spiskom/', text: 'Загрузить заявку списком' }), h('a', { class: 'btn btn-secondary', href: BASE + 'kabinet/sotrudniki/', text: 'Настроить роли и лимиты' })]) : empty(F.f === 'active' ? 'Все заявки согласованы — решений не ждёт ни одна.' : 'Здесь пока пусто.')
      ];
    });
  }
  function kpi(v, k, small) { return h('div', { class: 'blueprint pk-cab-kpi' }, [h('div', { class: 'mono pk-cab-kpi-v' + (small ? ' is-small' : ''), text: String(v) }), h('div', { class: 'pk-cab-kpi-k', text: k })]); }
  function approvalCard(a, rerender) {
    var role = ROUTE[a.stage], e = empByRole(ROUTE_ROLE[role] || '');
    var over = a.status === 'wait' && e && e.limit && a.total > e.limit;
    var items = approvalItems(a);
    var cid = 'pk-cab-c-' + a.id;
    var comment = h('textarea', { class: 'input pk-cab-comment', id: cid, rows: '2', placeholder: a.status === 'returned' ? 'Что уточнили' : 'Комментарий к решению (для отклонения — обязательно)', 'data-k': 'c-' + a.id, oninput: function (e) { var f = e.target.closest('.field'), hint = f && $('.pk-cab-hint', f); if (hint) hint.textContent = e.target.value.trim() ? 'Комментарий: ' + e.target.value.trim().length + ' зн. — сохранится в истории решений' : 'Попадёт в историю решений по заявке'; } });
    var controls = null;
    if (a.status === 'wait' || a.status === 'returned') {
      controls = h('div', { class: 'pk-cab-decide' }, [
        field('Комментарий', comment, 'Попадёт в историю решений по заявке'),
        h('div', { class: 'pk-cab-actions' }, a.status === 'returned' ? [
          btn('Уточнить и отправить заново', 'btn-primary', function () { decide(a, true, comment.value.trim()); rerender(); })
        ] : [
          btn(a.stage === 2 ? 'Согласовать и оформить заказ' : 'Согласовать', 'btn-primary', function () { decide(a, true, comment.value.trim()); rerender(); }, { 'aria-label': 'Согласовать заявку ' + a.id }),
          btn('Отклонить', 'btn-secondary', function () { if (!setErr(comment, comment.value.trim() ? '' : 'Укажите причину отклонения')) { comment.focus(); return; } decide(a, false, comment.value.trim()); rerender(); }, { 'aria-label': 'Отклонить заявку ' + a.id })
        ])
      ]);
    }
    return card([
      h('div', { class: 'pk-cab-appr-head' }, [
        h('div', null, [h('div', { class: 'mono pk-cab-muted', text: a.id + ' · ' + fdate(a.date) + ' · ' + a.author }), h('h2', { class: 'pk-cab-h2', text: a.name })]),
        h('div', { class: 'pk-cab-appr-sum' }, [h('span', { class: 'mono pk-cab-big', text: money(a.total) }), h('span', { class: 'pk-cab-muted', text: items.length ? items.length + ' ' + plural(items.length, 'позиция', 'позиции', 'позиций') : '' })])
      ]),
      h('div', { class: 'pk-cab-appr-route' }, [routeEl(a), h('span', { class: 'pk-cab-owner' }, [h('span', { class: 'pk-cab-muted', text: 'Сейчас: ' }), ownerText(a)])]),
      a.status === 'wait' && e ? h('p', { class: 'pk-cab-muted pk-cab-limit' + (over ? ' is-warn' : '') }, over ? 'Сумма выше лимита роли «' + e.role + '» (' + money(e.limit) + ') — после согласования нужна подпись директора.' : 'Лимит роли «' + e.role + '»: ' + money(e.limit) + ' — сумма в пределах.') : null,
      a.order ? h('p', null, h('a', { href: orderHref(a.order), class: 'pk-cab-link-inline', text: 'Открыть заказ ' + a.order })) : null,
      a.quote ? h('p', null, h('a', { href: BASE + 'kabinet/zaprosy-kp/', class: 'pk-cab-link-inline', text: 'По заявке есть ' + a.quote })) : null,
      controls,
      h('details', { class: 'pk-cab-history' }, [h('summary', { text: 'История решений · ' + a.history.length }), h('ol', null, a.history.slice().reverse().map(function (x) {
        return h('li', null, [h('span', { class: 'mono pk-cab-muted', text: x.date.replace(/^(\d{4}-\d{2}-\d{2})/, function (m) { return fdate(m); }) }), h('span', null, [h('b', { text: x.step + ': ' + x.decision }), ' — ' + x.who]), x.comment ? h('span', { class: 'pk-cab-muted', text: '«' + x.comment + '»' }) : null]);
      }))])
    ], 'pk-cab-appr is-' + a.status);
  }

  // ═════════ Регулярные закупки ═════════
  var PERIODS = [[14, 'каждые 2 недели'], [21, 'каждые 3 недели'], [28, 'каждые 4 недели'], [30, 'ежемесячно'], [42, 'каждые 6 недель'], [60, 'раз в 2 месяца'], [91, 'раз в квартал']];
  function priceDelta(r) { var p = prod(r.slug).price; return r.lastPrice ? (p - r.lastPrice) / r.lastPrice * 100 : 0; }
  function viewRegular(view) {
    return mount(view, function (rerender) {
      var A = ST.autobuy;
      var on = ST.regular.filter(function (r) { return r.on; });
      var month = on.reduce(function (s, r) { return s + prod(r.slug).price * r.qty * 30 / (r.periodDays || 30); }, 0);
      function setting(label, key, suffix, hint) {
        var inp = input({ inputmode: 'numeric', value: String(A[key]).replace(/\B(?=(\d{3})+(?!\d))/g, ' '), 'data-k': 'ab-' + key, onchange: function (e) { var v = num(e.target.value); if (!v && key !== 'warnDays') { setErr(e.target, 'Введите число'); return; } setErr(e.target, ''); A[key] = v; save('autobuy'); toast('Сохранено: ' + label.toLowerCase() + ' — ' + v + ' ' + suffix); rerender(); } });
        return field(label + ', ' + suffix, inp, hint);
      }
      return [
        h('div', { class: 'pk-cab-kpis' }, [
          kpi(on.length + ' из ' + ST.regular.length, 'позиций на автозакупке'),
          kpi(money(month), 'прогноз в месяц'),
          kpi(A.quarterInvoices + ' счетов', 'за квартал на ' + money(A.quarterSum).replace(/ ₽$/, ' ₽')),
          kpi(A.priceGrowth + '%', 'порог роста цены')
        ]),
        card([
          h('h2', { class: 'pk-cab-h2', text: 'Правила автозакупки' }),
          h('p', { class: 'pk-cab-muted', text: 'Счёт внутри лимита формируется без подтверждения, выше — придёт кнопка в MAX. Если цена выросла больше порога, система спросит перед счётом.' }),
          h('div', { class: 'pk-cab-grid4' }, [
            setting('Лимит без подтверждения', 'limitNoConfirm', '₽'),
            setting('Лимит в месяц', 'limitMonth', '₽'),
            setting('Предупреждать за', 'warnDays', 'дн.'),
            setting('Спросить, если цена выросла более', 'priceGrowth', '%')
          ])
        ]),
        ST.regular.length ? null : empty('Регулярных позиций пока нет. Система предложит автозакупку, когда одну и ту же позицию закажут хотя бы дважды.', startLinks(false)),
        ST.regular.map(function (r, idx) {
          var p = prod(r.slug), d = priceDelta(r), warn = d > A.priceGrowth, sum = p.price * r.qty;
          var mode = !r.on ? 'выключена' : sum <= A.limitNoConfirm ? 'без подтверждения' : 'выше лимита — подтверждение в MAX';
          var sw = h('input', { type: 'checkbox', role: 'switch', checked: !!r.on, 'data-k': 'sw-' + idx, 'aria-label': 'Автозакупка: ' + p.name, onchange: function (e) {
            r.on = e.target.checked; r.next = r.on ? addDays(today(), r.periodDays || 30) : null; save('regular');
            toast((r.on ? 'Автозакупка включена: ' : 'Автозакупка выключена: ') + p.name); rerender();
          } });
          var qty = input({ type: 'number', min: '1', value: String(r.qty), inputmode: 'numeric', 'data-k': 'qty-' + idx, onchange: function (e) { var v = Math.max(1, num(e.target.value)); r.qty = v; save('regular'); toast('Количество: ' + p.name + ' — ' + v + ' шт.'); rerender(); } });
          var per = select(PERIODS.some(function (x) { return x[0] === r.periodDays; }) ? PERIODS : PERIODS.concat([[r.periodDays, r.period]]), r.periodDays, { 'data-k': 'per-' + idx, onchange: function (e) {
            var v = +e.target.value; r.periodDays = v; r.period = (PERIODS.filter(function (x) { return x[0] === v; })[0] || [0, r.period])[1]; if (r.on) r.next = addDays(r.last || today(), v); save('regular'); toast('Периодичность: ' + r.period); rerender();
          } });
          return card([
            h('div', { class: 'pk-cab-reg-head' }, [
              h('div', { class: 'pk-cab-item' }, [thumb(p.img), h('div', null, [h('a', { href: BASE + p.href, class: 'pk-cab-item-name', text: p.name }), h('span', { class: 'mono pk-cab-muted', text: p.sku + ' · закупок ' + r.times + ' · последняя ' + fdate(r.last) })])]),
              h('label', { class: 'pk-cab-switch' }, [sw, h('span', { class: 'pk-cab-switch-ui', 'aria-hidden': 'true' }), h('span', { text: r.on ? 'Включена' : 'Выключена' })])
            ]),
            h('div', { class: 'pk-cab-grid4' }, [
              field('Периодичность', per),
              field('Количество, шт.', qty),
              h('div', { class: 'pk-cab-fact' }, [h('span', { class: 'pk-cab-muted', text: 'Следующий счёт' }), r.on && r.next ? tag(fdate(r.next), 'tag-accent') : tag('пауза', 'tag-outline')]),
              h('div', { class: 'pk-cab-fact' }, [h('span', { class: 'pk-cab-muted', text: 'Цена сейчас · сумма' }), h('span', { class: 'mono', text: money(p.price) + ' · ' + money(sum) }), h('span', { class: 'pk-cab-delta' + (d > 0.05 ? ' is-up' : d < -0.05 ? ' is-down' : ''), text: Math.abs(d) < 0.05 ? 'без изменений' : (d > 0 ? '+' : '−') + Math.abs(d).toFixed(1).replace('.', ',') + '% к прошлой закупке' })])
            ]),
            warn ? h('div', { class: 'pk-cab-warn', role: 'alert' }, [ico('i-state-warning', 20), h('div', null, [h('b', { text: 'Цена выросла на ' + d.toFixed(1).replace('.', ',') + '% — выше порога ' + A.priceGrowth + '%.' }), h('span', { text: ' Было ' + money(r.lastPrice) + ', стало ' + money(p.price) + '. Автосчёт не сформируется, пока вы не подтвердите цену.' })]),
              btn('Подтвердить новую цену', 'btn-secondary', function () { r.lastPrice = p.price; save('regular'); toast('Новая цена принята: ' + p.name); rerender(); })]) : null,
            h('div', { class: 'pk-cab-reg-foot' }, [
              h('span', { class: 'pk-cab-muted', text: 'Режим: ' + mode }),
              btn('Сформировать счёт сейчас', 'btn-primary', function () {
                if (warn) { toast('Сначала подтвердите новую цену: рост ' + d.toFixed(1).replace('.', ',') + '% выше порога.'); return; }
                var o = createOrder([{ slug: r.slug, qty: r.qty, vendor: /skf|manzheta/.test(r.slug) ? 'Подшипник-Трейд' : 'Гидромаш' }], { author: 'Автозакупка', status: sum <= A.limitNoConfirm ? 'Счёт' : 'Оформлен' });
                r.last = today(); r.times += 1; r.lastPrice = p.price; if (r.on) r.next = addDays(today(), r.periodDays || 30); save('regular');
                toast('Сформирован ' + (o.status === 'Счёт' ? 'счёт' : 'заказ на подтверждение') + ': ' + o.id + ' на ' + money(o.total)); rerender();
              }, { 'aria-label': 'Сформировать счёт сейчас: ' + p.name }),
              h('button', { type: 'button', class: 'btn btn-ghost', onclick: function () { addToCart([{ slug: r.slug, qty: r.qty }]); } }, 'Добавить в корзину')
            ])
          ], 'pk-cab-reg' + (r.on ? '' : ' is-off'));
        })
      ];
    });
  }

  // ═════════ Запросы КП ═════════
  var QUOTE_TAG = { 'В работе': 'tag-accent', 'Ждёт КП': 'tag-accent', 'КП получено': 'tag-outline', 'Принято': 'tag-neutral', 'Отозван': 'tag-danger' };
  function viewQuotes(view) {
    var S = { form: location.hash === '#new', open: {} };
    function openForm() { S.form = true; rer(); var f = $('#pk-cab-q-name'); if (f) f.focus(); }
    document.addEventListener('click', function (e) { var b = e.target.closest('[data-cab-act="quote-new"]'); if (b) openForm(); });
    window.addEventListener('hashchange', function () { if (location.hash === '#new') openForm(); });
    var rer = mount(view, function (rerender) {
      var form = null;
      if (S.form) {
        var name = input({ id: 'pk-cab-q-name', required: true, placeholder: 'Например: насосная станция 2×CR 45-3 с обвязкой', 'data-k': 'q-name' });
        var desc = h('textarea', { class: 'input', rows: '3', placeholder: 'Параметры, количество, условия монтажа, ссылка на спецификацию', 'data-k': 'q-desc' });
        var due = input({ type: 'date', value: addDays(today(), 14), 'data-k': 'q-due' });
        var spec = select([['', 'Без спецификации']].concat(ST.specs.map(function (s) { return [s.id, s.name]; })), '', { 'data-k': 'q-spec' });
        form = card(h('form', { class: 'pk-cab-form', novalidate: true, onsubmit: function (e) {
          e.preventDefault();
          if (!setErr(name, name.value.trim().length >= 3 ? '' : 'Опишите, что нужно рассчитать')) { name.focus(); return; }
          var id = 'КП-' + nextNum(ST.quotes, /^КП-(\d+)/);
          ST.quotes.unshift({ id: id, name: name.value.trim(), created: today(), due: addDays(today(), 1), status: 'В работе', engineer: 'Назначается инженер', spec: spec.value || null, note: desc.value.trim() || 'Желаемый срок поставки — ' + fdate(due.value), wanted: due.value });
          busEmit('quote.requested', { id: id, name: ST.quotes[0].name, note: ST.quotes[0].note, spec: ST.quotes[0].spec, specTotal: (ST.specs.filter(function (x) { return x.id === ST.quotes[0].spec; })[0] || { items: [] }).items.reduce(function (a2, i) { return a2 + (i.price || prod(i.slug).price) * i.qty; }, 0), wanted: due.value, company: ST.company.name, author: userName() }); // bus
          save('quotes'); S.form = false; toast('Запрос ' + id + ' создан. Инженер ответит в течение 2 рабочих часов.'); rerender();
        } }, [
          h('h2', { class: 'pk-cab-h2', text: 'Новый запрос КП' }),
          h('div', { class: 'pk-cab-grid2' }, [field('Что нужно рассчитать *', name), field('Спецификация', spec)]),
          field('Подробности', desc),
          h('div', { class: 'pk-cab-grid2' }, [field('Желаемый срок поставки', due), h('div', { class: 'pk-cab-fact' }, [h('span', { class: 'pk-cab-muted', text: 'Ответ инженера' }), h('span', { text: 'до 2 рабочих часов' })])]),
          h('div', { class: 'pk-cab-actions' }, [h('button', { type: 'submit', class: 'btn btn-primary' }, 'Создать запрос'), btn('Отмена', 'btn-secondary', function () { S.form = false; rerender(); })])
        ]), 'pk-cab-formcard');
      }
      return [form, ST.quotes.length || S.form ? null : empty('Запросов КП пока нет. Опишите задачу — инженер рассчитает предложение за 2 рабочих часа.', [btn('Новый запрос КП', 'btn-primary', function () { S.form = true; rerender(); var f = $('#pk-cab-q-name'); if (f) f.focus(); }), h('a', { class: 'btn btn-secondary', href: BASE + 'napravleniya/', text: 'Найти в каталоге' })]), ST.quotes.map(function (q) {
        var spec = ST.specs.filter(function (s) { return s.id === q.spec; })[0];
        var total = q.total || (spec ? lineSum(spec.items) : null);
        var ready = q.status === 'КП получено';
        var acts = [];
        if (ready) {
          acts.push(btn(S.open[q.id] ? 'Скрыть КП' : 'Открыть КП', 'btn-secondary', function () { S.open[q.id] = !S.open[q.id]; rerender(); }, { 'aria-expanded': String(!!S.open[q.id]) }));
          acts.push(btn('Принять КП', 'btn-primary', function () {
            var items = spec ? spec.items : [];
            if (!items.length) { toast('В КП нет позиций с ценой — свяжитесь с инженером.'); return; }
            var o = createOrder(items.map(function (i) { return { slug: i.slug, qty: i.qty, price: i.price, vendor: i.vendor }; }), { quote: q.id, author: userName() });
            q.status = 'Принято'; q.order = o.id; save('quotes'); toast('КП ' + q.id + ' принято — оформлен заказ ' + o.id + ' на ' + money(o.total)); rerender();
          }, { 'aria-label': 'Принять ' + q.id }));
        } else if (q.status === 'В работе' || q.status === 'Ждёт КП') {
          acts.push(btn('Напомнить инженеру', 'btn-secondary', function () { toast('Напоминание отправлено инженеру по ' + q.id + ' (демо).'); }));
          acts.push(btn('Отозвать', 'btn-ghost', function () { q.status = 'Отозван'; save('quotes'); toast('Запрос ' + q.id + ' отозван.'); rerender(); }));
        } else if (q.order) acts.push(h('a', { class: 'btn btn-secondary', href: orderHref(q.order), text: 'Открыть заказ ' + q.order }));
        var overdue = !ready && /В работе|Ждёт/.test(q.status) && q.due < today();
        return card([
          h('div', { class: 'pk-cab-appr-head' }, [
            h('div', null, [h('div', { class: 'mono pk-cab-muted', text: q.id + ' · создан ' + fdate(q.created) + ' · ' + q.engineer }), h('h2', { class: 'pk-cab-h2', text: q.name }), h('p', { class: 'pk-cab-muted', text: q.note || '' })]),
            h('div', { class: 'pk-cab-appr-sum' }, [tag(q.status, QUOTE_TAG[q.status]), h('span', { class: 'mono pk-cab-big', text: ready || q.status === 'Принято' ? money(total) : 'расчёт' })])
          ]),
          h('div', { class: 'pk-cab-qmeta' }, [
            h('span', null, [h('span', { class: 'pk-cab-muted', text: ready || q.status === 'Принято' ? 'Ответ получен: ' : 'Срок ответа: ' }), h('span', { class: overdue ? 'pk-cab-warn-t' : '', text: fdate(q.due) + (overdue ? ' — просрочено' : '') })]),
            q.validUntil && ready ? h('span', null, [h('span', { class: 'pk-cab-muted', text: 'КП действует до: ' }), fdate(q.validUntil)]) : null
          ]),
          ready && S.open[q.id] && spec ? table([{ t: 'Позиция' }, { t: 'Кол-во', cls: 'pk-num' }, { t: 'Цена', cls: 'pk-num' }, { t: 'Сумма', cls: 'pk-num' }], spec.items.map(function (i) {
            var p = prod(i.slug);
            return { cells: [h('div', { class: 'pk-cab-item' }, [thumb(p.img), h('a', { href: BASE + p.href, class: 'pk-cab-item-name', text: p.name })]), h('span', { class: 'mono', text: i.qty + ' шт.' }), h('span', { class: 'mono', text: money(i.price) }), h('span', { class: 'mono', text: money(i.price * i.qty) })] };
          })) : null,
          h('div', { class: 'pk-cab-actions' }, acts)
        ], 'pk-cab-quote');
      })];
    });
    return rer;
  }

  // ═════════ Документы ═════════
  var EDO_TAG = { 'Подписан': 'tag-neutral', 'Оплачен': 'tag-neutral', 'Отправлен': 'tag-accent', 'Ожидает подписи': 'tag-outline', 'Ожидает оплаты': 'tag-outline', 'Отсрочка': 'tag-accent' };
  function viewDocuments(view) {
    var q = new URLSearchParams(location.search);
    var F = { type: 'all', period: 'all', q: q.get('order') || '' };
    return mount(view, function (rerender) {
      if (!ST.documents.length) return empty('Документов пока нет. Счёт появится сразу после оформления первого заказа, УПД — после отгрузки.', startLinks());
      var months = {}; ST.documents.forEach(function (d) { months[d.date.slice(0, 7)] = 1; });
      var periods = [['all', 'Всё время']].concat(Object.keys(months).sort().reverse().map(function (m) { var d = pd(m + '-01'); return [m, ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'][d.getMonth()] + ' ' + d.getFullYear()]; }));
      var list = ST.documents.filter(function (d) {
        return (F.type === 'all' || d.type === F.type) && (F.period === 'all' || d.date.indexOf(F.period) === 0) &&
          (!F.q || (d.id + ' ' + d.title + ' ' + (d.order || '')).toLowerCase().indexOf(F.q.toLowerCase()) >= 0);
      });
      var types = ['Счёт', 'УПД', 'Акт сверки', 'Договор'];
      var inv = list.filter(function (d) { return d.type === 'Счёт'; }).reduce(function (s, d) { return s + (d.total || 0); }, 0);
      var waiting = ST.documents.filter(function (d) { return d.edo === 'Ожидает подписи'; }).length;
      return [
        card([
          h('div', { class: 'pk-cab-toolbar' }, [
            field('Номер документа или заказа', input({ type: 'search', value: F.q, placeholder: 'СЧ-5111, ПК-10428…', 'data-k': 'doc-q', oninput: function (e) { F.q = e.target.value; rerender(); } })),
            field('Период', select(periods, F.period, { 'data-k': 'doc-period', onchange: function (e) { F.period = e.target.value; rerender(); } }))
          ]),
          chips('Тип документа', [['all', 'Все']].concat(types.map(function (t) { return [t, t + ' · ' + ST.documents.filter(function (d) { return d.type === t; }).length]; })), F.type, function (v) { F.type = v; rerender(); }),
          h('p', { class: 'pk-cab-summary mono', role: 'status' }, 'Документов: ' + list.length + ' · счета за период на ' + money(inv) + (waiting ? ' · ждут подписи: ' + waiting : ''))
        ], 'pk-cab-filters'),
        list.length ? card(table([{ t: 'Документ' }, { t: 'Заказ' }, { t: 'Дата' }, { t: 'Сумма', cls: 'pk-num' }, { t: 'ЭДО' }, { t: 'Действия', hidden: true, cls: 'pk-num' }], list.map(function (d) {
          return { cells: [
            h('div', null, [h('span', { class: 'pk-cab-item-name', text: d.title }), h('span', { class: 'mono pk-cab-muted', text: d.id })]),
            d.order ? h('a', { href: orderHref(d.order), class: 'mono pk-cab-idlink', text: d.order }) : h('span', { class: 'pk-cab-muted', text: '—' }),
            fdate(d.date), h('span', { class: 'mono', text: d.total == null ? '—' : money(d.total) }), tag(d.edo, EDO_TAG[d.edo]),
            h('div', { class: 'pk-cab-rowacts' }, [
              d.edo === 'Ожидает подписи' ? btn('Подписать', 'btn-secondary', function () { d.edo = 'Подписан'; save('documents'); toast(d.title + ' ' + d.id + ' подписан в ЭДО (демо).'); rerender(); }, { 'aria-label': 'Подписать ' + d.id }) : null,
              h('button', { type: 'button', class: 'btn btn-ghost', 'aria-label': 'Скачать ' + d.title + ' ' + d.id, onclick: function () { downloadDoc(d); } }, [ico('i-ui-download'), d.type === 'Счёт' ? 'Счёт' : 'CSV'])
            ])
          ] };
        }), 'pk-cab-docs'), 'pk-cab-tablecard') : empty('Документов по фильтру нет.', btn('Сбросить фильтры', 'btn-secondary', function () { F.type = 'all'; F.period = 'all'; F.q = ''; rerender(); }))
      ];
    });
  }

  // ═════════ Спецификации ═════════
  function viewSpecs(view) {
    var S = { open: {} };
    var rer = mount(view, function (rerender) {
      if (!ST.specs.length) return empty('Спецификаций нет. Соберите корзину и сохраните её как спецификацию.');
      return ST.specs.map(function (s) {
        var cur = s.items.reduce(function (a, i) { return a + prod(i.slug).price * i.qty; }, 0);
        var open = !!S.open[s.id];
        var bid = 'pk-cab-spec-' + s.id;
        return card([
          h('div', { class: 'pk-cab-appr-head' }, [
            h('div', null, [h('div', { class: 'mono pk-cab-muted', text: s.id + ' · ' + fdate(s.date) + (s.note ? ' · ' + s.note : '') }), h('h2', { class: 'pk-cab-h2', text: s.name })]),
            h('div', { class: 'pk-cab-appr-sum' }, [h('span', { class: 'mono pk-cab-big', text: money(cur) }), h('span', { class: 'pk-cab-muted', text: s.items.length + ' ' + plural(s.items.length, 'позиция', 'позиции', 'позиций') + ' · ' + s.items.reduce(function (a, i) { return a + i.qty; }, 0) + ' шт.' })])
          ]),
          h('div', { class: 'pk-cab-actions' }, [
            btn(open ? 'Скрыть позиции' : 'Показать позиции', 'btn-secondary', function () { S.open[s.id] = !open; rerender(); }, { 'aria-expanded': String(open), 'aria-controls': bid, 'data-k': 'open-' + s.id }),
            btn('Вся спецификация в корзину', 'btn-primary', function () { addToCart(s.items); }, { 'aria-label': 'Вся спецификация «' + s.name + '» в корзину' }),
            btn('Дублировать', 'btn-secondary', function () {
              var c = clone(s); c.id = 'SP-' + nextNum(ST.specs, /^SP-(\d+)/); c.name = s.name + ' (копия)'; c.date = today(); c.note = 'копия ' + s.id; c.copy = true;
              ST.specs.unshift(c); save('specs'); toast('Создана копия: ' + c.id); rerender();
            }, { 'aria-label': 'Дублировать ' + s.name }),
            s.copy || s.fromCart ? btn('Удалить', 'btn-ghost pk-cab-danger', function () { ST.specs = ST.specs.filter(function (x) { return x !== s; }); save('specs'); toast('Спецификация ' + s.id + ' удалена.'); rerender(); }, { 'aria-label': 'Удалить ' + s.name }) : null
          ]),
          open ? h('div', { id: bid }, table([{ t: 'Позиция' }, { t: 'Кол-во', cls: 'pk-num' }, { t: 'Цена сейчас', cls: 'pk-num' }, { t: 'Сумма', cls: 'pk-num' }], s.items.map(function (i) {
            var p = prod(i.slug);
            return { cells: [h('div', { class: 'pk-cab-item' }, [thumb(p.img), h('div', null, [h('a', { href: BASE + p.href, class: 'pk-cab-item-name', text: p.name }), h('span', { class: 'mono pk-cab-muted', text: p.sku + (i.vendor ? ' · ' + i.vendor : '') })])]), h('span', { class: 'mono', text: i.qty + ' шт.' }), h('span', { class: 'mono', text: money(p.price) }), h('span', { class: 'mono', text: money(p.price * i.qty) })] };
          }))) : null
        ], 'pk-cab-spec');
      });
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('[data-cab-act="spec-from-cart"]')) return;
      var cart = readCart(), bySku = {};
      Object.keys(SEED.products).forEach(function (k) { bySku[SEED.products[k].sku] = k; });
      var items = cart.map(function (c) { var slug = bySku[c.sku]; return slug ? { slug: slug, qty: +c.qty || 1, price: prod(slug).price } : null; }).filter(Boolean);
      if (!items.length) { toast(cart.length ? 'В корзине нет позиций каталога с артикулом.' : 'Корзина пуста — добавьте позиции из каталога.'); return; }
      var sp = { id: 'SP-' + nextNum(ST.specs, /^SP-(\d+)/), name: 'Из корзины от ' + fdate(today()), date: today(), note: 'создана из корзины', items: items, fromCart: true };
      ST.specs.unshift(sp); save('specs'); toast('Спецификация ' + sp.id + ' создана: ' + items.length + ' ' + plural(items.length, 'позиция', 'позиции', 'позиций')); rer();
    });
    return rer;
  }

  // ═════════ Сотрудники ═════════
  var ROLES = ['Закупщик', 'Согласующий', 'Бухгалтер', 'Цех'];
  function viewEmployees(view) {
    var S = { form: false };
    var rer = mount(view, function (rerender) {
      var form = null;
      if (S.form) {
        var fio = input({ id: 'pk-cab-e-name', required: true, autocomplete: 'name', placeholder: 'Фамилия Имя Отчество', 'data-k': 'e-name' });
        var pos = input({ placeholder: 'Например: мастер участка', 'data-k': 'e-pos' });
        var phone = input({ type: 'tel', autocomplete: 'tel', placeholder: '+7 ___ ___-__-__', 'data-k': 'e-phone' });
        var mail = input({ type: 'email', autocomplete: 'email', placeholder: 'name@company.ru', 'data-k': 'e-mail' });
        var role = select(ROLES, 'Цех', { 'data-k': 'e-role' });
        var limit = input({ inputmode: 'numeric', value: '50000', 'data-k': 'e-limit' });
        form = card(h('form', { class: 'pk-cab-form', novalidate: true, onsubmit: function (e) {
          e.preventDefault();
          var ok = setErr(fio, fio.value.trim().split(/\s+/).length >= 2 ? '' : 'Укажите фамилию и имя');
          ok = setErr(phone, !phone.value.trim() || num(phone.value).toString().length >= 10 ? '' : 'Телефон — не меньше 10 цифр') && ok;
          ok = setErr(mail, !mail.value.trim() || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail.value.trim()) ? '' : 'Проверьте адрес почты') && ok;
          if (!ok) { var bad = $('.pk-invalid', view); if (bad) bad.focus(); return; }
          ST.employees.push({ id: uid('e'), name: fio.value.trim(), position: pos.value.trim() || '—', role: role.value, limit: num(limit.value), phone: phone.value.trim(), email: mail.value.trim() });
          save('employees'); S.form = false; toast('Сотрудник добавлен: ' + fio.value.trim() + '. Приглашение уйдёт в MAX (демо).'); rerender();
        } }, [
          h('h2', { class: 'pk-cab-h2', text: 'Новый сотрудник' }),
          h('div', { class: 'pk-cab-grid2' }, [field('ФИО *', fio), field('Должность', pos), field('Телефон', phone), field('Почта', mail), field('Роль', role), field('Лимит, ₽', limit, 'Сумма, которую сотрудник решает без согласования')]),
          h('div', { class: 'pk-cab-actions' }, [h('button', { type: 'submit', class: 'btn btn-primary' }, 'Добавить'), btn('Отмена', 'btn-secondary', function () { S.form = false; rerender(); })])
        ]), 'pk-cab-formcard');
      }
      return [
        form,
        card(table([{ t: 'Сотрудник' }, { t: 'Контакты' }, { t: 'Роль' }, { t: 'Лимит, ₽' }, { t: 'Действия', hidden: true, cls: 'pk-num' }], ST.employees.map(function (e, i) {
          var roleSel = select(ROLES, e.role, { 'aria-label': 'Роль: ' + e.name, 'data-k': 'role-' + e.id, onchange: function (ev) { e.role = ev.target.value; save('employees'); toast('Роль изменена: ' + e.name + ' — ' + e.role); rerender(); } });
          var lim = input({ inputmode: 'numeric', value: String(e.limit), 'aria-label': 'Лимит: ' + e.name, 'data-k': 'lim-' + e.id, class: 'input mono pk-cab-limit-inp', onchange: function (ev) { e.limit = num(ev.target.value); save('employees'); toast('Лимит изменён: ' + e.name + ' — ' + money(e.limit)); rerender(); } });
          return { cells: [
            h('div', null, [h('span', { class: 'pk-cab-item-name', text: e.name + (e.you ? ' (вы)' : '') }), h('span', { class: 'pk-cab-muted', text: e.position })]),
            h('div', null, [h('span', { class: 'mono', text: e.phone || '—' }), h('span', { class: 'pk-cab-muted', text: e.email || '' })]),
            roleSel, lim,
            e.you ? h('span', { class: 'pk-cab-muted', text: 'владелец' }) : h('button', { type: 'button', class: 'btn btn-ghost pk-cab-danger', 'aria-label': 'Удалить сотрудника ' + e.name, onclick: function () { ST.employees.splice(i, 1); save('employees'); toast('Сотрудник удалён: ' + e.name); rerender(); } }, 'Удалить')
          ] };
        }), 'pk-cab-emps'), 'pk-cab-tablecard'),
        card([h('h2', { class: 'pk-cab-h2', text: 'Роли в маршруте согласования' }), h('ul', { class: 'pk-cab-roles' }, ROLES.map(function (r) {
          var n = ST.employees.filter(function (e) { return e.role === r; }).length;
          return h('li', null, [h('b', { text: r }), h('span', { class: 'pk-cab-muted', text: ' — ' + (SEED.roles[r] || '') + ' · ' + n + ' ' + plural(n, 'сотрудник', 'сотрудника', 'сотрудников') })]);
        }))])
      ];
    });
    document.addEventListener('click', function (e) { if (e.target.closest('[data-cab-act="emp-new"]')) { S.form = true; rer(); var f = $('#pk-cab-e-name'); if (f) f.focus(); } });
    return rer;
  }

  // ═════════ Реквизиты ═════════
  function checkInn(v) {
    if (!/^\d{10}$|^\d{12}$/.test(v)) return 'ИНН — 10 цифр для организации или 12 для ИП';
    var d = v.split('').map(Number), c = function (w) { return w.reduce(function (s, k, i) { return s + k * d[i]; }, 0) % 11 % 10; };
    if (v.length === 10 && c([2, 4, 10, 3, 5, 9, 4, 6, 8]) !== d[9]) return 'Контрольная цифра ИНН не сходится — проверьте номер';
    if (v.length === 12 && (c([7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) !== d[10] || c([3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) !== d[11])) return 'Контрольная цифра ИНН не сходится — проверьте номер';
    return '';
  }
  function viewRequisites(view) {
    return mount(view, function (rerender) {
      var C = ST.company, def = ST.deferral;
      var F = {};
      function f(key, label, a, hint) { F[key] = input(Object.assign({ value: C[key] || '', 'data-k': 'rq-' + key }, a || {})); return field(label, F[key], hint); }
      var innHint = C.inn && checkInn(C.inn) ? 'контрольная цифра не сходится — проверьте номер' : '';
      function dirty(e) {
        var f = e.target.closest('form'), st = f && $('[data-cab-dirty]', f); if (!st) return;
        var changed = Object.keys(F).some(function (k) { return F[k].value.trim() !== String(C[k] || ''); });
        st.textContent = changed ? 'Есть несохранённые изменения — нажмите «Сохранить реквизиты».' : '';
      }
      var form = h('form', { class: 'pk-cab-form', novalidate: true, oninput: dirty, onchange: dirty, onsubmit: function (e) {
        e.preventDefault();
        var v = {}; Object.keys(F).forEach(function (k) { v[k] = F[k].value.trim(); });
        var ok = true;
        ok = setErr(F.name, v.name.length >= 3 ? '' : 'Укажите название организации') && ok;
        var innErr = /^\d{10}$|^\d{12}$/.test(v.inn) ? '' : 'ИНН — 10 цифр для организации или 12 для ИП';
        ok = setErr(F.inn, innErr) && ok;
        ok = setErr(F.kpp, v.inn.length === 12 ? (v.kpp && !/^\d{9}$/.test(v.kpp) ? 'КПП — 9 цифр' : '') : /^\d{4}[\dA-Z]{2}\d{3}$/.test(v.kpp) ? '' : 'КПП — 9 знаков, обязателен для организации') && ok;
        ok = setErr(F.bik, !v.bik || /^\d{9}$/.test(v.bik) ? '' : 'БИК — 9 цифр') && ok;
        ok = setErr(F.rs, !v.rs || /^\d{20}$/.test(v.rs.replace(/\s/g, '')) ? '' : 'Расчётный счёт — 20 цифр') && ok;
        ok = setErr(F.ks, !v.ks || /^\d{20}$/.test(v.ks.replace(/\s/g, '')) ? '' : 'Корр. счёт — 20 цифр') && ok;
        ok = setErr(F.email, !v.email || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email) ? '' : 'Проверьте адрес почты') && ok;
        ok = setErr(F.address, v.address.length >= 5 ? '' : 'Укажите юридический адрес') && ok;
        if (!ok) { var bad = $('.pk-invalid', view); if (bad) bad.focus(); toast('Проверьте выделенные поля'); return; }
        var warn = checkInn(v.inn);
        v.rs = v.rs.replace(/\s/g, ''); v.ks = v.ks.replace(/\s/g, '');
        Object.assign(C, v); save('company'); syncSession(true);
        toast('Реквизиты сохранены' + (warn ? '. Внимание: ' + warn.toLowerCase() : '') + '.'); rerender();
      } }, [
        h('h2', { class: 'pk-cab-h2', text: 'Реквизиты компании' }),
        h('div', { class: 'pk-cab-grid2' }, [
          f('name', 'Название организации *', { autocomplete: 'organization' }),
          f('director', 'Руководитель'),
          f('inn', 'ИНН *', { inputmode: 'numeric', maxlength: '12' }, innHint),
          f('kpp', 'КПП', { inputmode: 'numeric', maxlength: '9' }, 'Для ИП не нужен'),
          f('ogrn', 'ОГРН / ОГРНИП', { inputmode: 'numeric', maxlength: '15' }),
          f('address', 'Юридический адрес *', { autocomplete: 'street-address' }),
          f('bank', 'Банк'), f('bik', 'БИК', { inputmode: 'numeric', maxlength: '9' }),
          f('rs', 'Расчётный счёт', { inputmode: 'numeric', maxlength: '24' }, C.rsNote ? 'Номер условный: ' + C.rsNote : ''),
          f('ks', 'Корр. счёт', { inputmode: 'numeric', maxlength: '24' }),
          f('email', 'Почта для документов', { type: 'email', autocomplete: 'email' }),
          f('phone', 'Телефон', { type: 'tel', autocomplete: 'tel' })
        ]),
        h('p', { class: 'pk-cab-muted pk-cab-dirty', role: 'status', 'data-cab-dirty': '' }),
        h('div', { class: 'pk-cab-actions' }, [h('button', { type: 'submit', class: 'btn btn-primary' }, 'Сохранить реквизиты'), btn('Вернуть исходные', 'btn-secondary', function () { ST.company = baseState('company'); save('company'); syncSession(true); toast('Реквизиты сброшены к исходным.'); rerender(); })])
      ]);
      var used = def.limit > 0 ? Math.round(def.used / def.limit * 100) : 0;
      var an = input({ id: 'pk-cab-a-name', placeholder: 'Например: склад № 2', 'data-k': 'a-name' });
      var aa = input({ placeholder: 'Город, улица, дом, склад', autocomplete: 'street-address', 'data-k': 'a-addr' });
      var ac = input({ placeholder: 'ФИО и телефон на приёмке', 'data-k': 'a-contact' });
      var ah = input({ placeholder: 'пн–пт 8:00–17:00', 'data-k': 'a-hours' });
      return [
        def.limit > 0 ? h('div', { class: 'pk-cab-kpis' }, [kpi(money(def.limit), 'лимит отсрочки'), kpi(used + '%', 'использовано · ' + money(def.used)), kpi(def.days + ' дней', 'срок отсрочки'), kpi('ЭДО', 'подключено: Диадок', true)])
          : h('div', { class: 'pk-cab-kpis' }, [kpi('нет', 'отсрочка платежа', true), kpi('по счёту', 'оплата заказов', true), kpi('ЭДО', 'подключается после проверки реквизитов', true)]),
        h('div', { class: 'blueprint pk-cab-card' }, [def.limit > 0 ? h('div', { class: 'pk-cab-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(used), 'aria-label': 'Использование лимита отсрочки' }, h('span', { style: 'width:' + used + '%' })) : h('p', { class: 'pk-cab-muted', text: 'Отсрочку до 30 дней открываем после проверки реквизитов и первых заказов.' }), form]),
        card([
          h('h2', { class: 'pk-cab-h2', text: 'Адреса доставки' }),
          h('ul', { class: 'pk-cab-addrs' }, ST.addresses.map(function (a) {
            return h('li', { class: 'pk-cab-addr' + (a.main ? ' is-main' : '') }, [
              h('div', null, [h('span', { class: 'pk-cab-item-name' }, [a.name, a.main ? ' ' : null, a.main ? tag('основной', 'tag-accent') : null]), h('span', { text: a.address }), h('span', { class: 'pk-cab-muted', text: [a.contact, a.hours].filter(Boolean).join(' · ') })]),
              h('div', { class: 'pk-cab-rowacts' }, [
                a.main ? null : btn('Сделать основным', 'btn-secondary', function () { ST.addresses.forEach(function (x) { x.main = x === a; }); save('addresses'); toast('Основной адрес: ' + a.name); rerender(); }),
                a.main ? null : h('button', { type: 'button', class: 'btn btn-ghost pk-cab-danger', 'aria-label': 'Удалить адрес ' + a.name, onclick: function () { ST.addresses = ST.addresses.filter(function (x) { return x !== a; }); save('addresses'); toast('Адрес удалён: ' + a.name); rerender(); } }, 'Удалить')
              ])
            ]);
          })),
          h('form', { class: 'pk-cab-form pk-cab-addform', novalidate: true, oninput: function (e) { var st = $('[data-cab-dirty]', e.currentTarget); if (st) st.textContent = [an, aa, ac, ah].some(function (x) { return x.value.trim(); }) ? 'Адрес ещё не добавлен — нажмите «Добавить адрес».' : ''; }, onsubmit: function (e) {
            e.preventDefault();
            var ok = setErr(an, an.value.trim() ? '' : 'Назовите адрес');
            ok = setErr(aa, aa.value.trim().length >= 8 ? '' : 'Укажите адрес полностью') && ok;
            if (!ok) { ($('.pk-invalid', view) || an).focus(); return; }
            ST.addresses.push({ id: uid('a'), name: an.value.trim(), address: aa.value.trim(), contact: ac.value.trim(), hours: ah.value.trim(), main: !ST.addresses.length });
            save('addresses'); toast('Адрес добавлен: ' + an.value.trim()); rerender();
          } }, [
            h('h3', { class: 'pk-cab-h3', text: 'Добавить адрес' }),
            h('div', { class: 'pk-cab-grid2' }, [field('Название *', an), field('Адрес *', aa), field('Контакт на приёмке', ac), field('Часы приёмки', ah)]),
            h('p', { class: 'pk-cab-muted pk-cab-dirty', role: 'status', 'data-cab-dirty': '' }),
            h('div', { class: 'pk-cab-actions' }, h('button', { type: 'submit', class: 'btn btn-secondary' }, 'Добавить адрес'))
          ])
        ])
      ];
    });
  }

  // ═════════ Обзор ═════════
  function regMode(r) { var sum = prod(r.slug).price * r.qty; return !r.on ? 'выключена' : sum <= ST.autobuy.limitNoConfirm ? 'без подтверждения' : 'выше лимита — подтверждение в MAX'; }
  function viewOverview(view) {
    return mount(view, function (rerender) {
      var C = ST.company, def = ST.deferral;
      var qn = COUNTS.quotes(), tr = ST.orders.filter(function (o) { return o.status === 'В пути'; }).length, an = COUNTS.approvals();
      var onN = ST.regular.filter(function (r) { return r.on; }).length;
      var out = [];
      if (IS_NEW) out.push(card([
        h('h2', { class: 'pk-cab-h2' }, [ico('i-ui-account', 20), 'Кабинет компании ' + C.name + ' создан']),
        h('p', { text: 'Здравствуйте, ' + userName() + '! Вы — администратор кабинета: можно пригласить коллег в разделе «Сотрудники».' }),
        h('p', { class: 'pk-cab-muted', text: 'Заказов, заявок и документов пока нет. Начните с первой закупки — счёт за 15 минут, КП инженера за 2 рабочих часа. Реквизиты для счетов проверьте в разделе «Реквизиты».' }),
        h('div', { class: 'pk-cab-actions' }, startLinks().concat([h('a', { class: 'btn btn-ghost', href: BASE + 'kabinet/rekvizity/', text: 'Заполнить реквизиты' })]))
      ], 'pk-cab-welcome'));
      out.push(h('div', { class: 'pk-cab-kpis' }, [
        kpi(qn, plural(qn, 'запрос', 'запроса', 'запросов') + ' КП в работе'),
        kpi(tr, plural(tr, 'заказ', 'заказа', 'заказов') + ' в пути'),
        kpi(an, plural(an, 'заявка ждёт', 'заявки ждут', 'заявок ждут') + ' решения'),
        def.limit > 0 ? kpi(money(def.limit - def.used), 'доступно по отсрочке ' + def.days + ' дн.') : kpi('по счёту', 'отсрочка не подключена', true)
      ]));
      // последние заказы и запросы КП
      var rows = ST.orders.map(function (o) { return { d: o.date, id: o.id, o: o }; })
        .concat(ST.quotes.filter(function (q) { return !/Принято/.test(q.status); }).map(function (q) { return { d: q.created, id: q.id, q: q }; }))
        .sort(function (a, b) { return b.d.localeCompare(a.d) || b.id.localeCompare(a.id); }).slice(0, 6);
      out.push(card([
        h('div', { class: 'pk-cab-cardhead' }, [h('h2', { class: 'pk-cab-h2', text: 'Последние заказы и запросы КП' }), h('div', { class: 'pk-cab-actions' }, [h('a', { class: 'pk-cab-link-inline', href: BASE + 'kabinet/zakazy/', text: 'Все заказы' }), h('a', { class: 'pk-cab-link-inline', href: BASE + 'kabinet/zaprosy-kp/', text: 'Все запросы КП' })])]),
        rows.length ? table([{ t: 'Номер' }, { t: 'Позиции' }, { t: 'Статус' }, { t: 'Дата' }, { t: 'Сумма', cls: 'pk-num' }], rows.map(function (r) {
          if (r.o) {
            var o = r.o, first = prod(o.items[0].slug);
            return { cells: [h('a', { href: orderHref(o.id), class: 'mono pk-cab-idlink', text: o.id }),
              h('div', { class: 'pk-cab-item' }, [thumb(first.img), h('div', null, [h('span', { class: 'pk-cab-item-name', text: first.name + ' · ' + o.items[0].qty + ' шт.' }), o.items.length > 1 ? h('span', { class: 'pk-cab-muted', text: '+ ещё ' + (o.items.length - 1) + ' ' + plural(o.items.length - 1, 'позиция', 'позиции', 'позиций') }) : null])]),
              h('div', { class: 'pk-cab-stcell' }, [tag(o.status, STATUS_TAG[o.status]), o.busNote ? h('span', { class: 'pk-cab-muted', text: o.busNote }) : null]), // bus
              fdate(o.date), h('span', { class: 'mono', text: money(o.total) })] };
          }
          var q = r.q, spec = ST.specs.filter(function (s) { return s.id === q.spec; })[0], total = q.total || (q.status === 'КП получено' && spec ? lineSum(spec.items) : null);
          return { cells: [h('a', { href: BASE + 'kabinet/zaprosy-kp/', class: 'mono pk-cab-idlink', text: q.id }),
            h('div', null, [h('span', { class: 'pk-cab-item-name', text: q.name }), h('span', { class: 'pk-cab-muted', text: 'запрос КП · ' + q.engineer })]),
            tag(q.status, QUOTE_TAG[q.status]), fdate(q.created), h('span', { class: 'mono', text: total ? money(total) : 'расчёт' })] };
        }), 'pk-cab-recent') : empty('Заказов и запросов пока нет.', startLinks())
      ], 'pk-cab-tablecard pk-cab-ovcard'));
      // согласование
      var act = ST.approvals.filter(function (a) { return a.status === 'wait' || a.status === 'returned'; });
      out.push(card([
        h('div', { class: 'pk-cab-cardhead' }, [h('div', null, [h('h2', { class: 'pk-cab-h2', text: 'Согласование заявок' }), h('p', { class: 'pk-cab-muted', text: 'Заявка цеха проходит бюджет и закупку. Роли и лимиты — в разделе «Сотрудники».' })]), h('div', { class: 'pk-cab-actions' }, [h('a', { class: 'pk-cab-link-inline', href: BASE + 'kabinet/soglasovanie/', text: 'Все заявки' }), h('a', { class: 'pk-cab-link-inline', href: BASE + 'kabinet/sotrudniki/', text: 'Настроить маршрут' })])]),
        act.length ? table([{ t: 'Заявка' }, { t: 'Маршрут' }, { t: 'На ком' }, { t: 'Сумма', cls: 'pk-num' }, { t: 'Действие', cls: 'pk-num' }], act.slice(0, 5).map(function (a) {
          var label = a.status === 'returned' ? 'Уточнить' : a.stage === 2 ? 'Оформить заказ' : 'Согласовать';
          return { cells: [
            h('div', null, [h('span', { class: 'pk-cab-item-name', text: a.name }), h('span', { class: 'mono pk-cab-muted', text: a.id + ' · ' + a.author })]),
            routeEl(a, true), h('span', { text: ownerText(a) }), h('span', { class: 'mono', text: money(a.total) }),
            a.status === 'returned' ? h('a', { class: 'btn btn-secondary', href: BASE + 'kabinet/soglasovanie/', text: label, 'aria-label': label + ': ' + a.id })
              : btn(label, 'btn-primary', function () { decide(a, true, ''); rerender(); }, { 'aria-label': label + ': ' + a.id })
          ] };
        }), 'pk-cab-ovappr') : h('p', { class: 'pk-cab-muted pk-cab-pad', text: ST.approvals.length ? 'Все заявки согласованы — решений не ждёт ни одна.' : 'Заявок на согласование пока нет.' })
      ], 'pk-cab-tablecard pk-cab-ovcard'));
      // автозакупка
      out.push(card([
        h('div', { class: 'pk-cab-cardhead' }, [h('div', null, [h('h2', { class: 'pk-cab-h2' }, ['Автозакупка регулярных позиций ', tag(onN ? 'Включена · ' + onN + ' ' + plural(onN, 'позиция', 'позиции', 'позиций') : 'Выключена', onN ? 'tag-accent' : 'tag-neutral')]), h('p', { class: 'pk-cab-muted', text: 'Счёт формируется при наступлении срока: внутри лимита ' + money(ST.autobuy.limitNoConfirm) + ' — без подтверждения, выше — кнопка в MAX.' })]), h('div', { class: 'pk-cab-actions' }, [h('a', { class: 'pk-cab-link-inline', href: BASE + 'kabinet/regulyarnye-zakupki/', text: 'Правила и лимиты' })])]),
        ST.regular.length ? table([{ t: 'Позиция' }, { t: 'Периодичность' }, { t: 'Количество' }, { t: 'Следующий счёт' }, { t: 'Режим' }, { t: 'Вкл', cls: 'pk-num' }], ST.regular.map(function (r, idx) {
          var p = prod(r.slug);
          var qty = input({ type: 'number', min: '1', inputmode: 'numeric', value: String(r.qty), class: 'input mono pk-cab-qty', 'aria-label': 'Количество: ' + p.name, 'data-k': 'ov-qty-' + idx, onchange: function (e) { r.qty = Math.max(1, num(e.target.value)); save('regular'); toast('Количество: ' + p.name + ' — ' + r.qty + ' шт.'); rerender(); } });
          var sw = h('label', { class: 'pk-cab-switch' }, [h('input', { type: 'checkbox', role: 'switch', checked: !!r.on, 'data-k': 'ov-sw-' + idx, 'aria-label': 'Автозакупка: ' + p.name, onchange: function (e) { r.on = e.target.checked; r.next = r.on ? addDays(today(), r.periodDays || 30) : null; save('regular'); toast((r.on ? 'Автозакупка включена: ' : 'Автозакупка выключена: ') + p.name); rerender(); } }), h('span', { class: 'pk-cab-switch-ui', 'aria-hidden': 'true' })]);
          return { cells: [
            h('div', { class: 'pk-cab-item' }, [thumb(p.img), h('div', null, [p.href ? h('a', { href: BASE + p.href, class: 'pk-cab-item-name', text: p.name }) : h('span', { class: 'pk-cab-item-name', text: p.name }), h('span', { class: 'mono pk-cab-muted', text: p.sku + ' · ' + money(p.price) })])]),
            r.period, qty, r.on && r.next ? tag(fdate(r.next), 'tag-accent') : tag('пауза', 'tag-outline'), h('span', { class: 'pk-cab-muted', text: regMode(r) }), sw
          ] };
        }), 'pk-cab-ovreg') : h('p', { class: 'pk-cab-muted pk-cab-pad', text: 'Регулярных позиций пока нет — система предложит автозакупку, когда позицию закажут хотя бы дважды.' }),
        ST.regular.length ? h('p', { class: 'pk-cab-muted pk-cab-pad', text: 'За квартал автозакупка оформила ' + ST.autobuy.quarterInvoices + ' ' + plural(ST.autobuy.quarterInvoices, 'счёт', 'счёта', 'счетов') + ' на ' + money(ST.autobuy.quarterSum) + '.' }) : null
      ], 'pk-cab-tablecard pk-cab-ovcard'));
      // быстрые действия
      var docsWait = ST.documents.filter(function (d) { return d.edo === 'Ожидает подписи' || d.edo === 'Ожидает оплаты'; }).length;
      out.push(h('section', { class: 'pk-cab-quick', 'aria-label': 'Быстрые действия' }, [
        ['i-ui-quote', 'Новый запрос КП', 'Инженер ответит за 2 рабочих часа', 'kabinet/zaprosy-kp/#new'],
        ['i-ui-orders', 'Найти в каталоге', '115 000+ моделей с ценой и сроком', 'napravleniya/'],
        ['i-ui-specs', 'Загрузить заявку списком', 'Excel цеха → спецификация с ценами', 'zayavka-spiskom/'],
        ['i-pay-invoice', 'Счета и УПД', docsWait ? 'ждут подписи или оплаты: ' + docsWait : 'все документы в порядке', 'kabinet/dokumenty/'],
        ['i-ui-notify', 'Уведомления', 'MAX, почта, SMS и тихие часы', 'kabinet/uvedomleniya/']
      ].map(function (x) { return h('a', { class: 'blueprint pk-cab-qa', href: BASE + x[3] }, [ico(x[0], 20), h('span', { class: 'pk-cab-qa-t', text: x[1] }), h('span', { class: 'pk-cab-muted', text: x[2] })]); })));
      return out;
    });
  }

  // ═════════ Уведомления ═════════
  var QUIET = [['', 'не задавать'], ['20:00–08:00', '20:00–08:00'], ['21:00–08:00', '21:00–08:00'], ['22:00–08:00', '22:00–08:00'], ['23:00–07:00', '23:00–07:00']];
  function viewNotify(view) {
    return mount(view, function (rerender) {
      var N = ST.notify;
      N.watch = N.watch || { stock: true, drop: true, eol: false };
      function ok(inp) { var v = inp.value.trim(); return setErr(inp, !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? '' : 'Проверьте адрес почты'); }
      var quiet = select(QUIET.some(function (q) { return q[0] === N.quietHours; }) ? QUIET : QUIET.concat([[N.quietHours, N.quietHours]]), N.quietHours || '', { 'data-k': 'n-quiet', onchange: function (e) { N.quietHours = e.target.value; save('notify'); toast(N.quietHours ? 'Тихие часы: ' + N.quietHours + ' — ночью только срочное' : 'Тихие часы отключены'); rerender(); } });
      var max = select([['on', 'Привязан: ' + (N.maxBot || '@promkontur_bot')], ['off', 'Не присылать в MAX']], N.maxLinked === false ? 'off' : 'on', { 'data-k': 'n-max', onchange: function (e) { N.maxLinked = e.target.value === 'on'; save('notify'); toast(N.maxLinked ? 'Уведомления в MAX включены' : 'MAX отключён — события придут на почту и SMS'); rerender(); } });
      var mail = input({ type: 'email', value: N.email || '', autocomplete: 'email', placeholder: 'zakupki@company.ru', 'data-k': 'n-mail', class: 'input mono', onchange: function (e) { if (!ok(e.target)) return; N.email = e.target.value.trim(); save('notify'); toast('Рабочая почта: ' + (N.email || 'не указана')); } });
      var buh = input({ type: 'email', value: N.buhEmail || '', placeholder: 'buh@company.ru', 'data-k': 'n-buh', class: 'input mono', onchange: function (e) { if (!ok(e.target)) return; N.buhEmail = e.target.value.trim(); save('notify'); toast(N.buhEmail ? 'Копия документов бухгалтерии: ' + N.buhEmail : 'Копия бухгалтерии отключена'); } });
      var thr = input({ type: 'number', min: '1', max: '50', inputmode: 'numeric', value: String(N.priceWatch), 'data-k': 'n-thr', class: 'input mono', onchange: function (e) { var v = Math.min(50, Math.max(1, num(e.target.value) || 1)); N.priceWatch = v; save('notify'); toast('Порог изменения цены: ' + v + '%'); rerender(); } });
      function check(key, label) { return h('label', { class: 'pk-cab-check' }, [h('input', { type: 'checkbox', checked: !!N.watch[key], 'data-k': 'n-w-' + key, onchange: function (e) { N.watch[key] = e.target.checked; save('notify'); toast((e.target.checked ? 'Сообщим: ' : 'Не сообщать: ') + label.toLowerCase()); } }), h('span', { text: label })]); }
      return [
        card([
          h('h2', { class: 'pk-cab-h2', text: 'Куда и когда отправлять' }),
          h('div', { class: 'pk-cab-grid2' }, [
            field('Тихие часы', quiet, 'Ночью приходят только срочные события: отгрузка и срок оплаты'),
            field('Мессенджер MAX', max),
            field('Рабочая почта', mail, 'Счета, УПД и ответы на запросы КП'),
            field('Копия бухгалтерии', buh, 'Копия закрывающих документов')
          ]),
          h('div', { class: 'pk-cab-actions' }, [btn('Сохранить', 'btn-primary', function () {
            var good = ok(mail) && ok(buh);
            if (!good) { var bad = $('.pk-invalid', view); if (bad) bad.focus(); toast('Проверьте адреса почты'); return; }
            N.email = mail.value.trim(); N.buhEmail = buh.value.trim(); N.quietHours = quiet.value; N.maxLinked = max.value === 'on'; save('notify');
            toast('Настройки уведомлений сохранены');
          })])
        ]),
        card([
          h('h2', { class: 'pk-cab-h2', text: 'События и каналы' }),
          table([{ t: 'Событие' }, { t: 'MAX' }, { t: 'Почта' }, { t: 'SMS' }, { t: 'Когда' }], N.rows.map(function (r, i) {
            function box(ch, name) {
              var off = ch === 'max' && N.maxLinked === false;
              return h('input', { type: 'checkbox', class: 'pk-cab-box' + (off ? ' is-off' : ''), checked: !!r[ch], title: off ? 'MAX отключён в настройках выше' : null, 'aria-label': name + ': ' + r.event, 'data-k': 'n-' + ch + '-' + i, onchange: function (e) {
                r[ch] = e.target.checked; save('notify');
                var any = r.max && N.maxLinked !== false || r.mail || r.sms;
                toast((e.target.checked ? name + ' включён' : name + ' выключен') + ': ' + r.event.toLowerCase() + (off && e.target.checked ? ' — но канал MAX сейчас отключён, включите его в «Мессенджер MAX»' : any ? '' : ' — событие не придёт ни в один канал'));
              } });
            }
            return { cells: [h('div', null, [h('span', { class: 'pk-cab-item-name', text: r.event }), h('span', { class: 'pk-cab-muted', text: r.note })]), box('max', 'MAX'), box('mail', 'Почта'), box('sms', 'SMS'), h('span', { class: 'pk-cab-muted', text: r.when })] };
          }), 'pk-cab-notify')
        ], 'pk-cab-tablecard'),
        card([
          h('h2', { class: 'pk-cab-h2', text: 'Следить за ценами' }),
          h('p', { class: 'pk-cab-muted', text: 'Сообщим, если цена на позицию из регулярных закупок изменится больше порога или позиция появится в наличии.' }),
          h('div', { class: 'pk-cab-grid2' }, [field('Порог изменения, %', thr), h('div', { class: 'pk-cab-fact' }, [h('span', { class: 'pk-cab-muted', text: 'Отслеживается позиций' }), h('a', { class: 'pk-cab-link-inline mono', href: BASE + 'kabinet/regulyarnye-zakupki/', text: String(ST.regular.length) })])]),
          h('div', { class: 'pk-cab-checks' }, [check('stock', 'Появление в наличии'), check('drop', 'Снижение цены'), check('eol', 'Снятие с производства')])
        ])
      ];
    });
  }

  // ═════════ bus: события других кабинетов ═════════
  var RERENDER = null, BUS = null;
  function busEmit(type, payload) { try { if (window.PK_BUS) PK_BUS.emit(type, payload); } catch (e) {} }
  var VSTATE = { 'Подтверждена': 'Передан поставщику', 'Собрана': 'Собран у поставщика', 'Отгружена': 'Отгружен поставщиком', 'Доставлена': 'Доставлен', 'К расчёту': 'Доставлен', 'Оплачена': 'Доставлен', 'Отклонена': 'Поставщик отказал — подбираем замену' };
  function busApply(ev) {
    var p = ev.payload || {};
    if (ev.type === 'order.created') {
      if (findOrder(p.order)) return { dup: true };
      var bySku = {}; Object.keys(SEED.products).forEach(function (k) { bySku[SEED.products[k].sku] = k; });
      var extra = lsGet('busprod') || {};
      var lines = (p.items || []).map(function (i) {
        var slug = bySku[i.sku];
        if (!slug) { slug = 'bus-' + (i.sku || i.name); extra[slug] = { name: i.name, sku: i.sku || '', price: i.price, img: '', href: '' }; SEED.products[slug] = extra[slug]; }
        return { slug: slug, qty: +i.qty || 1, price: +i.price || 0, vendor: 'назначается' };
      });
      lsSet('busprod', extra);
      var deferral = /отсроч/i.test(p.payment || '');
      var o = { id: p.order, date: today(), status: 'Счёт', busNote: 'Счёт выставлен', items: lines, total: lineSum(lines), payment: deferral ? 'Отсрочка 30 дней' : (p.payment || 'Счёт для юрлица'), payDue: deferral ? addDays(today(), 30) : null, author: ev.author && ev.author.name || userName(), address: p.address || '', fromBus: ev.id };
      ST.orders.unshift(o);
      ST.documents.unshift({ id: 'СЧ-' + nextNum(ST.documents, /^СЧ-(\d+)/), type: 'Счёт', title: 'Счёт на оплату', order: o.id, date: today(), total: o.total, edo: deferral ? 'Отсрочка' : 'Ожидает оплаты' });
      save('orders', 'documents');
      return { order: o.id };
    }
    if (ev.type === 'vendor.order.status') {
      var ord = p.order && findOrder(p.order); if (!ord) return { skipped: true };
      var map = { 'Отгружена': 'Отгружен', 'Доставлена': 'Доставлен' }, idx = STEPS.indexOf(ord.status);
      if (map[p.status] && STEPS.indexOf(map[p.status]) > idx) ord.status = map[p.status];
      if (p.status === 'Отгружена') { ord.shipped = today(); ord.eta = p.eta || addDays(today(), 3); ord.carrier = p.carrier || ''; ord.track = p.track || '—'; ord.busNote = 'В пути' + (p.track ? ' · трек ' + p.track : ''); }
      else if (p.status === 'Доставлена') { ord.delivered = today(); ord.eta = null; ord.busNote = 'Доставлен'; }
      else if (VSTATE[p.status]) ord.busNote = VSTATE[p.status] + (p.confirmedShip ? ' · отгрузка ' + fdate(p.confirmedShip) : '');
      if (p.skus && p.vendor) ord.items.forEach(function (i) { if (p.skus.indexOf(prod(i.slug).sku) >= 0) i.vendor = p.vendor; });
      save('orders');
      return { order: ord.id, status: ord.status };
    }
    if (ev.type === 'quote.answered') {
      var q = ST.quotes.filter(function (x) { return x.id === p.id; })[0]; if (!q) return { skipped: true };
      if (/Принято|Отозван/.test(q.status)) return { skipped: true };
      q.status = 'КП получено'; q.total = +p.total || q.total || null; q.due = today(); q.validUntil = p.validUntil || addDays(today(), 14); q.engineer = p.by ? 'Ответил ' + p.by : q.engineer;
      save('quotes');
      return { quote: q.id };
    }
    return { ignored: true };
  }
  function busConnect(B) {
    BUS = B;
    function run(list) {
      var n = 0;
      list.forEach(function (ev) { var r = busApply(ev); B.ack(ev.id, 'buyer', r); if (!r.ignored && !r.skipped && !r.dup) n++; });
      if (n) { if (RERENDER) RERENDER(); paintCounts(); }
      return n;
    }
    var extra = lsGet('busprod'); if (extra) Object.keys(extra).forEach(function (k) { if (!SEED.products[k]) SEED.products[k] = extra[k]; });
    var n = run(B.pending('buyer'));
    if (n) toast('Новых событий из других кабинетов: ' + n);
    B.on('*', function (ev) { if (ev.to.indexOf('buyer') < 0) return; var k = run([ev]); if (k) toast(B.describe(ev, 'buyer').t); });
  }

  // ═════════ старт ═════════
  var VIEWS = { overview: viewOverview, notify: viewNotify, orders: viewOrders, order: viewOrder, approvals: viewApprovals, regular: viewRegular, quotes: viewQuotes, documents: viewDocuments, specs: viewSpecs, employees: viewEmployees, requisites: viewRequisites };
  function start() {
    loadState();
    if (AUTH && !IS_NEW) { var e1 = ST.employees.filter(function (e) { return e.you; })[0]; if (e1 && AUTH.name && e1.name.indexOf(AUTH.name) !== 0) { e1.name = AUTH.name; } }
    var view = $('[data-cab-view]');
    if (view && VIEWS[view.getAttribute('data-cab-view')]) {
      try { RERENDER = VIEWS[view.getAttribute('data-cab-view')](view); } // bus: RERENDER
      catch (err) { view.textContent = ''; add(view, empty('Не удалось показать раздел: ' + err.message)); if (window.console) console.warn(err); }
    }
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-cab-act="export-orders"], [data-cab-act="export-docs"]'); if (!b) return;
      e.preventDefault(); if (b.getAttribute('data-cab-act') === 'export-orders') exportOrders(); else exportDocs();
    });
    paintCounts();
    syncSession();
    window.addEventListener('storage', function (e) { if (e.key && e.key.indexOf(PREFIX) === 0) { KEYS.forEach(function (k) { var v = lsGet(k); if (v !== undefined) ST[k] = v; }); paintCounts(); if (RERENDER && !(document.activeElement && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))) RERENDER(); } });
    if (window.PK_BUS_READY) PK_BUS_READY(busConnect); // bus
  }
  function boot() {
    if (window.PK_AUTH && typeof PK_AUTH.require === 'function') { AUTH = PK_AUTH.require('buyer'); if (!AUTH) return; }
    else if (window.PK_AUTH && PK_AUTH.get) AUTH = PK_AUTH.get();
    var el = document.getElementById('pk-cab-data');
    if (el) { try { SEED = JSON.parse(el.textContent); } catch (e) { SEED = null; } }
    if (SEED) start();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

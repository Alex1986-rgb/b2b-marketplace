// ПРОМКОНТУР — шина событий между кабинетами (честный демо-режим: только в пределах одного браузера).
// Очередь — localStorage 'pk:bus' = { events: [{ id, type, ts, author, to, payload, ack: {роль: {at, result}}, seen: {роль: ts} }] }.
// Другие вкладки узнают о событии через штатное 'storage', текущая — через CustomEvent 'pk:bus' на document.
// API: window.PK_BUS = { emit, on, off, pending, ack, feed, unread, markSeen, nextOrderId, describe, NOTE }.
// Подпись NOTE — одна строка внутри поповера «Что нового» (и в меню пользователя auth.js), не под заголовками страниц.
// Подключается из site.js (загрузчик + PK_BUS_READY) на витрине /korzina/ и в разделах кабинетов.
// Сброс: auth.js «Сбросить демо-данные» удаляет все ключи pk:* кроме корзины — вместе с ними и pk:bus.
(function () {
  'use strict';
  if (window.PK_BUS) return;
  var KEY = 'pk:bus', MAX = 150;
  var BASE = (document.querySelector('link[rel="manifest"]') || { getAttribute: function () { return '/site.webmanifest'; } }).getAttribute('href').replace('site.webmanifest', '');
  var NOTE = 'Демо: события передаются между кабинетами только в этом браузере';
  var ROLES = ['buyer', 'vendor', 'operator'];
  // кому адресовано событие по умолчанию
  var ROUTE = {
    'order.created': ['buyer', 'vendor', 'operator'],
    'vendor.order.status': ['buyer', 'operator'],
    'approval.done': ['operator'],
    'approval.rejected': ['operator'],
    'quote.requested': ['operator'],
    'quote.answered': ['buyer'],
    'price.rule.changed': ['vendor'],
    'vendor.suspended': ['vendor'],
    'vendor.resumed': ['vendor']
  };

  // ═════════ хранилище ═════════
  function read() {
    try { var s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && Array.isArray(s.events)) return s; } catch (e) {}
    return { events: [] };
  }
  function write(s) {
    if (s.events.length > MAX) s.events = s.events.slice(-MAX);
    try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch (e) { return false; }
  }
  function session() { try { return window.PK_AUTH && PK_AUTH.get ? PK_AUTH.get() : null; } catch (e) { return null; } }

  // ═════════ подписки ═════════
  var subs = [];
  var known = {};
  read().events.forEach(function (e) { known[e.id] = 1; });
  function fire(ev, local) {
    subs.slice().forEach(function (s) {
      if (s.type !== '*' && s.type !== ev.type) return;
      try { s.fn(ev, { local: !!local }); } catch (err) { if (window.console) console.warn('pk-bus: обработчик', ev.type, err); }
    });
  }
  function on(type, fn) { subs.push({ type: type, fn: fn }); return function () { off(type, fn); }; }
  function off(type, fn) { subs = subs.filter(function (s) { return !(s.type === type && s.fn === fn); }); }

  function emit(type, payload, opts) {
    opts = opts || {};
    var s = session();
    var ev = {
      id: 'ev' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      type: type, ts: Date.now(),
      author: s ? { role: s.role, name: s.name, company: s.company } : { role: 'guest', name: 'Гость витрины', company: '' },
      to: (opts.to || ROUTE[type] || []).slice(),
      payload: payload || {}, ack: {}, seen: {}
    };
    var st = read(); st.events.push(ev);
    if (!write(st)) return null;
    known[ev.id] = 1;
    try { document.dispatchEvent(new CustomEvent('pk:bus', { detail: ev })); } catch (e) {}
    fire(ev, true);
    paintBell();
    return ev;
  }
  // другие вкладки: новые id → обработчики; любые изменения → перерисовать колокольчик
  window.addEventListener('storage', function (e) {
    if (e.key !== KEY && e.key !== null) return;
    var fresh = read().events.filter(function (ev) { return !known[ev.id]; });
    fresh.forEach(function (ev) { known[ev.id] = 1; fire(ev, false); });
    paintBell();
  });

  function forRole(ev, role) { return ev.to.indexOf(role) >= 0; }
  function pending(role) { return read().events.filter(function (ev) { return forRole(ev, role) && !ev.ack[role]; }); }
  // ack: событие применено в кабинете роли; result — что получилось (номер заявки, «пропущено» и т. п.)
  function ack(id, role, result) {
    var st = read(), ev = st.events.filter(function (x) { return x.id === id; })[0];
    if (!ev) return false;
    ev.ack[role] = { at: Date.now(), result: result || null };
    write(st); paintBell();
    return true;
  }
  function feed(role, n) { return read().events.filter(function (ev) { return forRole(ev, role); }).reverse().slice(0, n || 10); }
  function unread(role) { return read().events.filter(function (ev) { return forRole(ev, role) && !ev.seen[role]; }).length; }
  function markSeen(role) {
    var st = read(), ch = false;
    st.events.forEach(function (ev) { if (forRole(ev, role) && !ev.seen[role]) { ev.seen[role] = Date.now(); ch = true; } });
    if (ch) write(st);
    paintBell();
  }
  // номер заказа витрины: больше всех, что уже есть в кабинете закупщика и в шине
  function nextOrderId() {
    var max = 10440;
    function scan(id) { var m = /^ПК-(\d+)/.exec(id || ''); if (m) max = Math.max(max, +m[1]); }
    try { (JSON.parse(localStorage.getItem('pk:cab:orders') || '[]') || []).forEach(function (o) { scan(o.id); }); } catch (e) {}
    read().events.forEach(function (ev) { scan(ev.payload && ev.payload.order); });
    return 'ПК-' + (max + 1);
  }

  // ═════════ тексты ленты ═════════
  function money(n) { return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽'; }
  function describe(ev, role) {
    if (!ev.ack[role]) ev = read().events.filter(function (x) { return x.id === ev.id; })[0] || ev; // результат ack мог появиться позже
    var p = ev.payload || {}, r = ev.ack[role] && ev.ack[role].result || {};
    switch (ev.type) {
      case 'order.created':
        if (role === 'buyer') return { t: 'Заказ ' + p.order + ' оформлен, счёт выставлен', d: (p.items || []).length + ' поз. на ' + money(p.total) + ' · ' + (p.payment || ''), href: 'kabinet/zakaz/?n=' + encodeURIComponent(p.order) };
        if (role === 'vendor') return r.request ? { t: 'Новая заявка ' + r.request + ' по заказу ' + p.order, d: 'Позиций из вашего прайса: ' + r.lines + ' · ' + (p.city || p.address || ''), href: 'kabinet-postavshchika/zayavki/?q=' + encodeURIComponent(r.request) } : { t: 'Заказ ' + p.order + ' на витрине', d: r.skipped ? 'Позиций из вашего прайса нет — заявка не создана' : 'Откройте кабинет, чтобы получить заявку', href: 'kabinet-postavshchika/zayavki/' };
        return { t: 'Новый заказ ' + p.order + (p.company ? ' · ' + p.company : ''), d: 'Счёт выставлен на ' + money(p.total) + ' · сделка в колонке «Счёт выставлен»', href: 'panel/crm/' };
      case 'vendor.order.status':
        return { t: (p.vendor || 'Поставщик') + ': заявка ' + p.request + ' — ' + String(p.status).toLowerCase(), d: (p.order ? 'Заказ ' + p.order : 'Без связанного заказа') + (p.track ? ' · трек ' + p.track : '') + (p.carrier ? ' · ' + p.carrier : ''), href: role === 'buyer' && p.order ? 'kabinet/zakaz/?n=' + encodeURIComponent(p.order) : 'panel/crm/' };
      case 'approval.done':
        return { t: 'Заявка цеха ' + p.id + ' согласована', d: (p.name || '') + ' · ' + money(p.total) + (p.order ? ' · заказ ' + p.order : ''), href: 'panel/crm/' };
      case 'approval.rejected':
        return { t: 'Заявка цеха ' + p.id + ' отклонена', d: (p.name || '') + (p.comment ? ' · «' + p.comment + '»' : ''), href: 'panel/zhurnal/' };
      case 'quote.requested':
        return { t: 'Запрос КП ' + p.id + ' от ' + (p.company || 'закупщика'), d: p.name || '', href: 'panel/avtopilot/' };
      case 'quote.answered':
        return { t: 'КП получено по ' + p.id, d: (p.name ? p.name + ' · ' : '') + money(p.total), href: 'kabinet/zaprosy-kp/' };
      case 'price.rule.changed':
        return { t: 'Сервис изменил условия: правила наценки', d: p.what || '', href: 'kabinet-postavshchika/zayavki/' };
      case 'vendor.suspended':
        return { t: 'Сервис приостановил приём заявок', d: 'Причина: ' + (p.why || 'не указана'), href: 'kabinet-postavshchika/zayavki/' };
      case 'vendor.resumed':
        return { t: 'Приём заявок возобновлён', d: 'Позиции снова участвуют в выборе предложения', href: 'kabinet-postavshchika/zayavki/' };
    }
    return { t: ev.type, d: '', href: '' };
  }
  function when(ts) {
    var d = new Date(ts), n = new Date(), p = function (x) { return (x < 10 ? '0' : '') + x; };
    var hm = p(d.getHours()) + ':' + p(d.getMinutes());
    return d.toDateString() === n.toDateString() ? 'сегодня, ' + hm : d.getDate() + '.' + p(d.getMonth() + 1) + ', ' + hm;
  }

  // ═════════ колокольчик и лента «Что нового» ═════════
  function pageRole() {
    var p = location.pathname, r = p.indexOf(BASE) === 0 ? p.slice(BASE.length) : p.replace(/^\//, '');
    if (r.indexOf('kabinet-postavshchika/') === 0) return 'vendor';
    if (r.indexOf('kabinet/') === 0) return 'buyer';
    if (r.indexOf('panel/') === 0) return 'operator';
    return null;
  }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function css() {
    if (document.getElementById('pk-bus-css')) return;
    var s = el('style'); s.id = 'pk-bus-css';
    s.textContent =
      '.pk-uslot{display:inline-flex;align-items:center;gap:8px}' +
      '.pk-bus-bell{position:relative;display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 10px;border:1px solid rgba(255,255,255,.28);border-radius:var(--radius-sm,6px);background:transparent;color:inherit;font:inherit;font-size:13px;cursor:pointer;white-space:nowrap}' +
      '.pk-bus-bell:hover{border-color:rgba(255,255,255,.6)}.pk-bus-bell:focus-visible{outline:2px solid var(--color-accent,#e8590c);outline-offset:2px}' +
      '.pk-bus-bell .ico{width:16px;height:16px}' +
      // витрина: колокольчик — такой же пункт строки иконок, как «Корзина» (иконка 22px, подпись 12px под ней)
      '.pk-bus-bell.pk-bus-bell-store{flex-direction:column;justify-content:flex-start;gap:0;min-height:0;padding:0;border:0;border-radius:0;color:var(--color-neutral-700,#555);font-size:12px;line-height:inherit;text-align:center}' +
      '.pk-bus-bell-store .pk-bus-ico{position:relative;height:24px;display:flex;align-items:center;justify-content:center;color:var(--color-text,#1a1a1a)}' +
      '.pk-bus-bell-store .pk-bus-ico .ico{width:22px;height:22px}' +
      '.pk-bus-bell-store .pk-bus-badge{position:absolute;top:-5px;left:calc(50% + 5px);min-width:16px;height:16px;padding:0 4px;border-radius:0;font-size:10px;line-height:16px}' +
      '.pk-bus-bell-store:hover{color:var(--color-text,#1a1a1a)}' +
      '.pk-bus-badge{min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:var(--color-accent,#e8590c);color:#fff;font-family:var(--font-mono,monospace);font-size:11px;line-height:18px;text-align:center}' +
      '.pk-bus-badge[hidden]{display:none}' +
      '.pk-bus-pop{position:fixed;z-index:1200;width:min(380px,calc(100vw - 24px));max-height:min(70vh,560px);overflow:auto;background:var(--color-surface,#fff);color:var(--color-neutral-900,#1a1a1a);border:1px solid var(--color-divider,#d9d9d9);border-radius:var(--radius-md,8px);box-shadow:0 12px 32px rgba(0,0,0,.18);padding:14px 16px}' +
      '.pk-bus-pop h2{margin:0 0 4px;font-family:var(--font-heading,inherit);font-size:17px;font-weight:600}' +
      '.pk-bus-pop ol{list-style:none;margin:10px 0 0;padding:0}' +
      '.pk-bus-pop li{border-top:1px solid var(--color-divider,#e5e5e5);padding:9px 0}' +
      '.pk-bus-pop li.is-new{box-shadow:inset 3px 0 0 var(--color-accent,#e8590c);padding-left:10px}' +
      '.pk-bus-pop a{color:inherit;text-decoration:none;display:block}.pk-bus-pop a:hover .pk-bus-t{text-decoration:underline}' +
      '.pk-bus-t{display:block;font-size:14px;font-weight:500}.pk-bus-d{display:block;font-size:12px;color:var(--color-neutral-700,#555);margin-top:2px}' +
      '.pk-bus-w{display:block;font-family:var(--font-mono,monospace);font-size:11px;color:var(--color-neutral-600,#777);margin-top:3px}' +
      '.pk-bus-empty{font-size:13px;color:var(--color-neutral-700,#555);margin:10px 0 0}' +
      '.pk-bus-note{margin:6px 0 12px;font-size:12px;color:var(--color-neutral-600,#6b6b6b)}' +
      '.pk-bus-banner{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;margin:0 0 16px;padding:12px 16px;border:1px solid var(--color-accent,#e8590c);border-left-width:4px;border-radius:var(--radius-sm,6px);background:var(--color-surface,#fff);font-size:14px}' +
      '.pk-bus-banner b{display:block;margin-bottom:2px}.pk-bus-banner span{color:var(--color-neutral-700,#555);font-size:13px}' +
      '.pk-bus-pop:focus{outline:none}.pk-bus-pop h2:focus{outline:none}' +
      '.pk-bus-pop .pk-bus-note{margin:2px 0 8px;font-size:11px}' +
      '@media (max-width:760px){.pk-bus-bell .pk-bus-lbl{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}' +
      '.pk-bus-bell{min-width:40px;min-height:40px;justify-content:center;padding:0 8px}' +
      '.pk-bus-bell.pk-bus-bell-store{min-width:40px;min-height:44px;display:grid;place-items:center;padding:0}}';
    document.head.appendChild(s);
  }
  var bell = null, badge = null, pop = null, role = null;
  function paintBell() {
    if (!bell) return;
    var n = unread(role);
    badge.textContent = n > 99 ? '99+' : String(n); badge.hidden = !n;
    bell.setAttribute('aria-label', 'Что нового' + (n ? ': непрочитанных ' + n : ': новых событий нет'));
  }
  function closePop(refocus) { if (!pop) return; pop.remove(); pop = null; bell.setAttribute('aria-expanded', 'false'); if (refocus) bell.focus(); }
  function openPop() {
    closePop();
    var list = feed(role, 10);
    pop = el('div', 'pk-bus-pop'); pop.id = 'pk-bus-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-labelledby', 'pk-bus-pop-h'); pop.tabIndex = -1;
    var h = el('h2', null, 'Что нового'); h.id = 'pk-bus-pop-h'; h.tabIndex = -1;
    pop.appendChild(h);
    pop.appendChild(el('p', 'pk-bus-note', NOTE));
    if (!list.length) pop.appendChild(el('p', 'pk-bus-empty', 'Событий пока нет. Здесь появятся заказы, статусы и решения из других кабинетов.'));
    else {
      var ol = el('ol');
      list.forEach(function (ev) {
        var d = describe(ev, role), li = el('li', ev.seen[role] ? '' : 'is-new');
        var a = el(d.href ? 'a' : 'div'); if (d.href) a.href = BASE + d.href;
        a.appendChild(el('span', 'pk-bus-t', d.t));
        if (d.d) a.appendChild(el('span', 'pk-bus-d', d.d));
        a.appendChild(el('span', 'pk-bus-w', when(ev.ts) + ' · ' + (ev.author && ev.author.name ? ev.author.name : '')));
        li.appendChild(a); ol.appendChild(li);
      });
      pop.appendChild(ol);
    }
    document.body.appendChild(pop);
    var r = bell.getBoundingClientRect(), vw = document.documentElement.clientWidth, w = pop.offsetWidth;
    pop.style.top = Math.round(r.bottom + 8) + 'px';
    pop.style.left = Math.max(12, Math.min(r.right - w, vw - w - 12)) + 'px';
    bell.setAttribute('aria-expanded', 'true');
    markSeen(role);
    // фокус внутрь: первая ссылка ленты или заголовок; ушёл фокус наружу — закрываем
    var f = pop.querySelector('a') || h;
    try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); }
    pop.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePop(true); return; }
      if (e.key !== 'Tab') return;
      var items = [].slice.call(pop.querySelectorAll('a[href]'));
      if (!items.length) { e.preventDefault(); closePop(true); return; }
      // Shift+Tab с первого пункта — обратно на колокольчик
      if (e.shiftKey && (document.activeElement === items[0] || document.activeElement === h)) { e.preventDefault(); closePop(true); }
    });
    pop.addEventListener('focusout', function (e) {
      var to = e.relatedTarget;
      if (pop && to && !pop.contains(to) && to !== bell) closePop();
    });
  }
  // строка иконок витрины («Чат · Запросы КП · Сравнение · Корзина»)
  function storeIconRow() {
    var cart = [].slice.call(document.querySelectorAll('header a')).filter(function (a) { return a.querySelector('.i-ui-cart'); })[0];
    return cart ? cart.parentElement : null;
  }
  function mountBell() {
    role = pageRole();
    var s = session();
    if (!role || !s || s.role !== role) return false;
    // витрина — в строку иконок рядом с «Корзиной»; служебные шапки — рядом с кнопкой пользователя
    var row = storeIconRow();
    var slot = !row && [].slice.call(document.querySelectorAll('.pk-uslot-ops')).filter(function (x) { return x.querySelector('.pk-ubtn'); })[0];
    if (!row && !slot) return false;
    css();
    bell = el('button', 'pk-bus-bell' + (row ? ' pk-bus-bell-store' : '')); bell.type = 'button';
    bell.setAttribute('aria-haspopup', 'dialog'); bell.setAttribute('aria-expanded', 'false'); bell.setAttribute('aria-controls', 'pk-bus-pop');
    var ic = el('span', 'ico ico-16 i-ui-notify'); ic.setAttribute('aria-hidden', 'true');
    badge = el('span', 'pk-bus-badge'); badge.setAttribute('aria-hidden', 'true');
    if (row) {
      var box = el('span', 'pk-bus-ico'); box.appendChild(ic); box.appendChild(badge);
      bell.appendChild(box); bell.appendChild(el('span', 'pk-bus-lbl', 'Что нового'));
      var acc = row.querySelector('.pk-uacc');
      if (acc) row.insertBefore(bell, acc); else row.appendChild(bell);
    } else {
      bell.appendChild(ic); bell.appendChild(el('span', 'pk-bus-lbl', 'Что нового')); bell.appendChild(badge);
      slot.insertBefore(bell, slot.firstChild);
    }
    bell.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); if (pop) closePop(); else openPop(); });
    document.addEventListener('click', function (e) { if (pop && !pop.contains(e.target) && !bell.contains(e.target)) closePop(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && pop) closePop(true); });
    window.addEventListener('resize', function () { closePop(); });
    paintBell();
    return true;
  }
  function boot() {
    var tries = 0;
    (function t() { if (mountBell() || ++tries > 20) return; setTimeout(t, 150); })();
  }

  window.PK_BUS = { emit: emit, on: on, off: off, pending: pending, ack: ack, feed: feed, unread: unread, markSeen: markSeen, nextOrderId: nextOrderId, describe: describe, css: css, NOTE: NOTE, ROLES: ROLES };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  try { document.dispatchEvent(new CustomEvent('pk:bus:ready')); } catch (e) {}
})();

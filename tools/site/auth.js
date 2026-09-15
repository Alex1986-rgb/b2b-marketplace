// ПРОМКОНТУР — демо-вход без сервера: сессия в localStorage (ключ pk:session), роли, меню пользователя, защита разделов.
// API: window.PK_AUTH = { get, login, logout, require, profiles, reset }; событие document 'pk:auth' (detail = сессия или null).
(function () {
  'use strict';
  var BASE = (document.querySelector('link[rel="manifest"]') || { getAttribute: function () { return '/site.webmanifest'; } }).getAttribute('href').replace('site.webmanifest', '');
  var KEY = 'pk:session';
  var DEMO_CODE = '4815';
  var DEMO_NOTE = 'Демо-режим: данные хранятся только в этом браузере';

  var PROFILES = {
    buyer: { role: 'buyer', name: 'Кузнецов Андрей', company: 'ООО «Метизный завод»', phone: '+7 910 000-00-14', initials: 'КА', title: 'закупщик' },
    vendor: { role: 'vendor', name: 'Семёнова Ольга', company: 'ООО «Гидромаш»', phone: '+7 916 000-00-27', initials: 'ГМ', title: 'поставщик' },
    operator: { role: 'operator', name: 'Петров А.', company: 'ПРОМКОНТУР', phone: '+7 495 000-00-01', initials: 'ПА', title: 'админ' }
  };
  var ROLE_LABEL = { buyer: 'Закупщик', vendor: 'Поставщик', operator: 'Оператор' };
  var HOME = { buyer: 'kabinet/', vendor: 'kabinet-postavshchika/', operator: 'panel/avtopilot/' };
  // закрытые разделы: префикс пути после BASE → роль
  var GUARDS = [['kabinet-postavshchika/', 'vendor'], ['kabinet/', 'buyer'], ['panel/', 'operator']];

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function txt(e) { return (e && e.textContent || '').replace(/\s+/g, ' ').trim(); }
  function isRole(r) { return Object.prototype.hasOwnProperty.call(PROFILES, r); }
  function copy(o) { var r = {}; for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = o[k]; return r; }
  function initialsOf(s) {
    var w = String(s || '').replace(/[«»"']/g, '').replace(/^(ООО|АО|ПАО|ЗАО|ИП)\s+/i, '').split(/[\s.-]+/).filter(Boolean);
    return ((w[0] || '?').charAt(0) + (w[1] ? w[1].charAt(0) : '')).toUpperCase();
  }

  // ═════════ Сессия ═════════
  function get() {
    try { var s = JSON.parse(localStorage.getItem(KEY) || 'null'); return s && isRole(s.role) ? s : null; } catch (e) { return null; }
  }
  function save(s) {
    try { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); } catch (e) {}
    document.dispatchEvent(new CustomEvent('pk:auth', { detail: s }));
    renderHeaders();
  }
  function login(role, phone, extra) {
    if (!isRole(role)) role = 'buyer';
    var s = copy(PROFILES[role]);
    if (phone) s.phone = formatPhone(phone);
    if (extra) for (var k in extra) if (extra[k]) s[k] = extra[k];
    if (extra && extra.name && !extra.initials) s.initials = initialsOf(extra.name);
    s.since = new Date().toISOString();
    save(s);
    return s;
  }
  function logout() { save(null); }
  function reset() {
    // все демо-ключи pk:* кроме корзины
    try {
      var ks = [];
      for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf('pk:') === 0 && !/^pk:cart/.test(k)) ks.push(k); }
      ks.forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) {}
    save(null);
  }
  function vhodUrl(roles) {
    return BASE + 'vhod/?next=' + encodeURIComponent(location.pathname + location.search) + '&role=' + encodeURIComponent(roles[0]);
  }
  function require(role) {
    var roles = Array.isArray(role) ? role : [role];
    var s = get();
    if (s && roles.indexOf(s.role) >= 0) { document.documentElement.classList.remove('pk-guard'); return s; }
    showGate(s, roles);
    location.replace(vhodUrl(roles));
    return null;
  }
  function showGate(s, roles) {
    document.documentElement.classList.add('pk-guard');
    if ($('.pk-gate')) return;
    var box = el('div', 'pk-gate'); box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite');
    box.appendChild(el('strong', null, s ? 'Раздел для роли «' + ROLE_LABEL[roles[0]] + '»' : 'Нужен вход'));
    box.appendChild(el('span', null, 'Переходим на страницу входа…'));
    var a = el('a', 'btn btn-primary', 'Войти'); a.href = vhodUrl(roles);
    box.appendChild(a);
    document.body.appendChild(box);
  }

  // ═════════ Телефон: маска +7 (___) ___-__-__ ═════════
  function digits(v) {
    var raw = String(v || '').trim(), d = raw.replace(/\D/g, '');
    if (/^\+7/.test(raw)) d = d.slice(1);                                  // уже с кодом страны
    else if (d.length === 11 && (d[0] === '7' || d[0] === '8')) d = d.slice(1); // вставили 8XXXXXXXXXX
    return d.slice(0, 10);
  }
  function formatPhone(v) {
    var d = digits(v), r = '+7';
    if (!d.length) return r + ' ';
    r += ' (' + d.slice(0, 3);
    if (d.length >= 3) r += ')';
    if (d.length > 3) r += ' ' + d.slice(3, 6);
    if (d.length > 6) r += '-' + d.slice(6, 8);
    if (d.length > 8) r += '-' + d.slice(8, 10);
    return r;
  }

  // ═════════ Меню пользователя ═════════
  var menu = null, menuBtn = null;
  function menuItems(s) {
    var it = [];
    if (s.role === 'buyer') {
      it.push({ ico: 'i-ui-account', text: 'Личный кабинет', href: BASE + 'kabinet/' });
      it.push({ ico: 'i-ui-orders', text: 'Заказы', href: BASE + 'kabinet/zakazy/' });
      it.push({ ico: 'i-ui-notify', text: 'Уведомления', href: BASE + 'kabinet/uvedomleniya/' });
    } else if (s.role === 'vendor') {
      it.push({ ico: 'i-channel-vendor', text: 'Кабинет поставщика', href: BASE + 'kabinet-postavshchika/' });
    } else {
      it.push({ ico: 'i-op-admin', text: 'Панель оператора', href: BASE + 'panel/avtopilot/' });
      it.push({ ico: 'i-ui-orders', text: 'CRM', href: BASE + 'panel/crm/' });
    }
    it.push({ sep: true });
    it.push({ ico: 'i-ui-repeat', text: 'Сменить роль (демо)', href: BASE + 'vhod/?role=' + s.role + '&switch=1' });
    it.push({ ico: 'i-ui-repeat', text: 'Сбросить демо-данные', act: 'reset' });
    it.push({ ico: 'i-ui-login', text: 'Выйти', act: 'logout' });
    return it;
  }
  function buildMenu(s) {
    var m = el('div', 'pk-umenu'); m.id = 'pk-umenu'; m.setAttribute('role', 'menu'); m.hidden = true;
    var head = el('div', 'pk-umenu-head');
    head.appendChild(el('span', 'pk-umenu-av', s.initials || initialsOf(s.name)));
    var who = el('span', 'pk-umenu-who');
    who.appendChild(el('strong', null, s.name));
    who.appendChild(el('span', null, s.company + ' · ' + (s.title || ROLE_LABEL[s.role])));
    head.appendChild(who);
    m.appendChild(head);
    menuItems(s).forEach(function (i) {
      if (i.sep) { m.appendChild(el('div', 'pk-umenu-sep')); return; }
      var a = el(i.href ? 'a' : 'button', 'pk-umenu-item');
      a.setAttribute('role', 'menuitem');
      if (i.href) a.href = i.href; else { a.type = 'button'; a.setAttribute('data-act', i.act); }
      var ic = el('span', 'ico ico-16 ' + i.ico); ic.setAttribute('aria-hidden', 'true');
      a.appendChild(ic); a.appendChild(el('span', null, i.text));
      m.appendChild(a);
    });
    m.appendChild(el('div', 'pk-umenu-note', DEMO_NOTE));
    m.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      e.preventDefault(); e.stopPropagation();
      var act = b.getAttribute('data-act');
      closeMenu();
      if (act === 'reset') reset(); else logout();
      // из закрытого раздела после выхода — на главную
      if (guardRole()) location.href = BASE; else if (isVhod()) location.reload();
    });
    m.addEventListener('keydown', function (e) {
      var items = $$('.pk-umenu-item', m), i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
      else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
      else if (e.key === 'Tab') closeMenu();
    });
    document.body.appendChild(m);
    return m;
  }
  function placeMenu() {
    if (!menu || !menuBtn) return;
    var r = menuBtn.getBoundingClientRect(), w = menu.offsetWidth, vw = document.documentElement.clientWidth;
    var left = Math.min(Math.max(8, r.right - w), vw - w - 8);
    menu.style.left = Math.max(8, left) + 'px';
    menu.style.top = Math.round(r.bottom + 8) + 'px';
  }
  function openMenu(btn, focusFirst) {
    var s = get(); if (!s) return;
    if (menu) menu.remove();
    menu = buildMenu(s); menuBtn = btn;
    menu.hidden = false; placeMenu();
    btn.setAttribute('aria-expanded', 'true');
    if (focusFirst) { var f = $('.pk-umenu-item', menu); if (f) f.focus(); }
  }
  function closeMenu(refocus) {
    if (!menu) return;
    menu.remove(); menu = null;
    if (menuBtn) { menuBtn.setAttribute('aria-expanded', 'false'); if (refocus) menuBtn.focus(); }
  }
  document.addEventListener('click', function (e) {
    if (menu && !e.target.closest('.pk-umenu') && !e.target.closest('.pk-ubtn')) closeMenu();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menu) closeMenu(true); });
  window.addEventListener('resize', function () { closeMenu(); });
  window.addEventListener('scroll', function () { if (menu) placeMenu(); }, { passive: true });

  function userButton(s, kind) {
    var b = el('button', 'pk-ubtn pk-ubtn-' + kind); b.type = 'button';
    b.setAttribute('aria-haspopup', 'menu'); b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-controls', 'pk-umenu');
    b.setAttribute('aria-label', 'Меню пользователя: ' + s.name + ', ' + s.company);
    if (kind === 'ops') b.appendChild(el('span', 'pk-ubtn-av', s.initials || initialsOf(s.name)));
    else { var ic = el('span', 'ico ico-16 i-ui-account'); ic.setAttribute('aria-hidden', 'true'); b.appendChild(ic); }
    b.appendChild(el('span', 'pk-ubtn-name', kind === 'ops' ? (s.role === 'operator' ? s.name + ' · ' + s.title : s.company) : (s.role === 'buyer' ? s.company : s.name)));
    b.appendChild(el('span', 'pk-ubtn-caret'));
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); if (menu && menuBtn === b) closeMenu(); else openMenu(b, e.detail === 0); });
    b.addEventListener('keydown', function (e) { if (e.key === 'ArrowDown') { e.preventDefault(); openMenu(b, true); } });
    return b;
  }

  // ═════════ Шапки ═════════
  var slots = null;
  function findSlots() {
    if (slots) return slots;
    slots = { store: [], ops: [], drawer: [] };
    // витрина: ссылка с иконкой аккаунта в верхней тёмной полосе («Войти» или имя компании)
    $$('a').forEach(function (a) {
      if (!$('.i-ui-account', a) || a.closest('main, [role="main"], footer, .pk-umenu')) return;
      if (a.closest('.pk-drawer')) { slots.drawer.push({ a: a, href: a.getAttribute('href'), html: a.innerHTML }); return; }
      if (!/(vhod|kabinet)\/?$/.test(a.getAttribute('href') || '')) return;
      var wrap = el('span', 'pk-uslot pk-uslot-store');
      a.parentNode.insertBefore(wrap, a); wrap.appendChild(a);
      slots.store.push({ wrap: wrap, a: a, text: txt(a) });
    });
    // служебная шапка (панель/поставщик): кружок с инициалами справа
    $$('header').forEach(function (h) {
      if (/z-index/.test(h.getAttribute('style') || '')) return;
      $$('span', h).forEach(function (sp) {
        var av = sp.firstElementChild;
        if (!av || av.tagName !== 'SPAN' || !/^[А-ЯЁA-Z]{2}$/.test(txt(av)) || sp.closest('.pk-uslot')) return;
        if (!/margin-left:\s*auto/.test(sp.getAttribute('style') || '')) return;
        var wrap = el('span', 'pk-uslot pk-uslot-ops'); wrap.style.marginLeft = 'auto';
        sp.parentNode.insertBefore(wrap, sp); wrap.appendChild(sp);
        slots.ops.push({ wrap: wrap, orig: sp });
      });
    });
    return slots;
  }
  function renderHeaders() {
    if (!document.body) return;
    var s = get(), S = findSlots();
    closeMenu();
    S.store.forEach(function (x) {
      var old = $('.pk-ubtn', x.wrap); if (old) old.remove();
      if (s) { x.a.hidden = true; x.wrap.appendChild(userButton(s, 'store')); }
      else {
        x.a.hidden = false; x.a.href = BASE + 'vhod/';
        var node = x.a.lastChild; if (node && node.nodeType === 3) node.textContent = 'Войти'; else x.a.appendChild(document.createTextNode('Войти'));
      }
    });
    S.ops.forEach(function (x) {
      var old = $('.pk-ubtn', x.wrap); if (old) old.remove();
      if (s) { x.orig.hidden = true; x.wrap.appendChild(userButton(s, 'ops')); }
      else x.orig.hidden = false;
    });
    // мобильное меню: ссылка на вход → кабинет/выход
    S.drawer.forEach(function (x) {
      var extra = x.a.parentNode.querySelector('.pk-drawer-out'); if (extra) extra.remove();
      if (s) {
        x.a.href = BASE + HOME[s.role];
        x.a.textContent = '';
        var ic = el('span', 'ico ico-16 i-ui-account'); ic.setAttribute('aria-hidden', 'true');
        x.a.appendChild(ic); x.a.appendChild(document.createTextNode(s.role === 'buyer' ? s.company : s.name));
        var out = el('button', 'pk-drawer-sub pk-drawer-out', 'Выйти'); out.type = 'button';
        out.addEventListener('click', function () { logout(); if (guardRole()) location.href = BASE; });
        x.a.insertAdjacentElement('afterend', out);
      } else { x.a.href = BASE + 'vhod/'; x.a.innerHTML = x.html.replace(/ООО[^<]*$/, 'Войти'); }
    });
  }

  // ═════════ Защита разделов ═════════
  function rel() {
    var p = location.pathname;
    return p.indexOf(BASE) === 0 ? p.slice(BASE.length) : p.replace(/^\//, '');
  }
  function guardRole() {
    var r = rel();
    for (var i = 0; i < GUARDS.length; i++) if (r.indexOf(GUARDS[i][0]) === 0) return GUARDS[i][1];
    return null;
  }
  function isVhod() { return /\/vhod\/?$/.test(location.pathname); }

  // ═════════ Страница /vhod/ ═════════
  function initVhod() {
    var main = $('#main') || $('main'); if (!main) return;
    var q = new URLSearchParams(location.search);
    var role = isRole(q.get('role')) ? q.get('role') : 'buyer';
    var next = q.get('next') || '';
    // next только внутри сайта
    if (!/^\/(?!\/)/.test(next)) next = '';
    function target(r) { return next && (!q.get('role') || q.get('role') === r) ? next : BASE + HOME[r]; }

    var h1 = $('h1', main);
    var phoneIn = $$('input', main).filter(function (i) { return /^\+7/.test(i.placeholder || ''); })[0];
    var codeIn = $$('input', main).filter(function (i) { return /цифр/.test(i.placeholder || '') && i !== phoneIn; })[0];
    var btns = $$('button', main);
    var loginBtn = btns.filter(function (b) { return /^войти$/i.test(txt(b)); })[0];
    var regBtn = btns.filter(function (b) { return /^зарегистрировать/i.test(txt(b)); })[0];
    if (!phoneIn || !codeIn || !loginBtn) return;
    var card = loginBtn.closest('.blueprint') || loginBtn.parentNode;
    var phoneField = phoneIn.closest('.field') || phoneIn.parentNode;
    var codeField = codeIn.closest('.field') || codeIn.parentNode;

    // переключатель ролей
    var pills = el('div', 'pk-roles'); pills.setAttribute('role', 'radiogroup'); pills.setAttribute('aria-label', 'Роль для входа');
    ['buyer', 'vendor', 'operator'].forEach(function (r) {
      var b = el('button', 'pk-role', ROLE_LABEL[r]); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('data-role', r);
      pills.appendChild(b);
    });
    var note = el('p', 'pk-demo-note', DEMO_NOTE + '. Код для входа показывается на экране.');
    var anchor = h1 || card;
    anchor.insertAdjacentElement('beforebegin', pills);
    (h1 && h1.nextElementSibling ? h1.nextElementSibling : anchor).insertAdjacentElement('afterend', note);

    // «Демо-доступ»: вход в любую роль одним нажатием + подсказка про код
    var DEMO_CARDS = [
      ['buyer', 'i-ui-account', 'Кабинет закупщика', 'ООО «Метизный завод»', 'Заказы, согласование заявок цеха, регулярные закупки, запросы КП, счета и УПД, сотрудники.'],
      ['vendor', 'i-channel-vendor', 'Кабинет поставщика', 'ООО «Гидромаш»', 'Новые заявки и отгрузка, редактор прайса, выгрузка фида, расчёты и настройки.'],
      ['operator', 'i-op-admin', 'Панель оператора', 'Петров А., админ', 'CRM-сделки, автопилот, правила наценки, поставщики, права и журнал изменений.']
    ];
    var demo = el('section', 'pk-demo-access'); demo.setAttribute('aria-labelledby', 'pk-demo-h');
    var dh = el('h2', null, 'Демо-доступ: войти одним нажатием'); dh.id = 'pk-demo-h'; demo.appendChild(dh);
    demo.appendChild(el('p', 'pk-demo-sub', 'Выберите роль — откроется её кабинет. Или войдите по телефону ниже: любой номер, код из «сообщения» — 4815.'));
    var grid = el('div', 'pk-demo-grid');
    DEMO_CARDS.forEach(function (c) {
      var box = el('div', 'pk-demo-card');
      var top = el('div', 'pk-demo-top'); var ic = el('span', 'ico ico-28 ' + c[1]); ic.setAttribute('aria-hidden', 'true'); top.appendChild(ic);
      var tt = el('div'); tt.appendChild(el('strong', null, c[2])); tt.appendChild(el('span', null, c[3])); top.appendChild(tt); box.appendChild(top);
      box.appendChild(el('p', null, c[4]));
      var go = el('button', 'btn btn-primary', 'Войти как ' + ROLE_LABEL[c[0]].toLowerCase()); go.type = 'button';
      go.addEventListener('click', function (e) { e.stopPropagation(); login(c[0], ''); location.href = target(c[0]); });
      box.appendChild(go); grid.appendChild(box);
    });
    demo.appendChild(grid);
    demo.appendChild(el('p', 'pk-demo-foot', DEMO_NOTE + '. «Сбросить демо-данные» — в меню пользователя.'));
    (card.closest('[style*="grid"]') || card).insertAdjacentElement('beforebegin', demo);

    var already = el('div', 'pk-already'); already.hidden = true;
    note.insertAdjacentElement('afterend', already);

    function setRole(r) {
      role = r;
      $$('.pk-role', pills).forEach(function (b) {
        var on = b.getAttribute('data-role') === r;
        b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1;
      });
      if (h1) h1.textContent = 'Вход для ' + { buyer: 'закупщика', vendor: 'поставщика', operator: 'оператора' }[r];
            renderAlready();
    }
    pills.addEventListener('click', function (e) { var b = e.target.closest('.pk-role'); if (b) setRole(b.getAttribute('data-role')); });
    pills.addEventListener('keydown', function (e) {
      var list = ['buyer', 'vendor', 'operator'], i = list.indexOf(role), d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (!d) return; e.preventDefault();
      setRole(list[(i + d + 3) % 3]); $('.pk-role.on', pills).focus();
    });

    function renderAlready() {
      var s = get();
      already.textContent = '';
      if (!s) { already.hidden = true; return; }
      already.hidden = false;
      already.appendChild(el('span', null, 'Вы вошли: ' + s.name + ', ' + s.company + ' (' + ROLE_LABEL[s.role].toLowerCase() + ').'));
      var go = el('a', 'btn btn-secondary', s.role === role ? 'Продолжить' : 'Вернуться в свой раздел'); go.href = s.role === role ? target(s.role) : BASE + HOME[s.role];
      var out = el('button', 'btn btn-secondary', 'Выйти'); out.type = 'button';
      out.addEventListener('click', function () { logout(); renderAlready(); });
      already.appendChild(go); already.appendChild(out);
    }

    // сообщения об ошибках
    function err(input, msg) {
      var f = input.closest('.field') || input.parentNode, e = $('.pk-autherr', f);
      input.classList.toggle('pk-invalid', !!msg);
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (!msg) { if (e) e.remove(); return; }
      if (!e) { e = el('span', 'pk-err-a pk-autherr'); e.id = 'pk-err-' + Math.random().toString(36).slice(2, 8); f.appendChild(e); }
      e.textContent = msg; input.setAttribute('aria-describedby', e.id);
    }

    // телефон
    phoneIn.type = 'tel'; phoneIn.autocomplete = 'tel'; phoneIn.inputMode = 'tel'; phoneIn.maxLength = 18;
    phoneIn.id = phoneIn.id || 'pk-phone'; phoneIn.setAttribute('data-pk', 'phone'); phoneIn.placeholder = '+7 (___) ___-__-__';
    var pl = $('label', phoneField); if (pl) pl.setAttribute('for', phoneIn.id);
    phoneIn.addEventListener('focus', function () { if (!phoneIn.value) phoneIn.value = '+7 '; });
    phoneIn.addEventListener('blur', function () { if (!digits(phoneIn.value).length) phoneIn.value = ''; });
    phoneIn.addEventListener('input', function () { phoneIn.value = formatPhone(phoneIn.value); err(phoneIn, ''); });
    phoneIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); sendCode(); } });

    // код
    codeIn.type = 'text'; codeIn.inputMode = 'numeric'; codeIn.autocomplete = 'one-time-code'; codeIn.maxLength = 4;
    codeIn.id = codeIn.id || 'pk-code'; codeIn.setAttribute('data-pk', 'code');
    var cl = $('label', codeField); if (cl) cl.setAttribute('for', codeIn.id);
    codeIn.addEventListener('input', function () { codeIn.value = codeIn.value.replace(/\D/g, '').slice(0, 4); err(codeIn, ''); if (codeIn.value.length === 4) doLogin(); });
    codeIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doLogin(); } });

    var getBtn = el('button', 'btn btn-primary btn-block pk-getcode'); getBtn.type = 'button';
    var gi = el('span', 'ico ico-16 i-channel-max'); gi.setAttribute('aria-hidden', 'true');
    getBtn.appendChild(gi); getBtn.appendChild(el('span', null, 'Получить код'));
    phoneField.insertAdjacentElement('afterend', getBtn);

    var codeBox = el('div', 'pk-codebox'); codeBox.setAttribute('role', 'status'); codeBox.setAttribute('aria-live', 'polite');
    codeField.insertAdjacentElement('beforebegin', codeBox);

    var links = el('div', 'pk-login-links');
    var again = el('button', 'pk-linkbtn', 'Изменить номер'); again.type = 'button';
    var quick = el('button', 'pk-linkbtn', 'Войти в демо без кода'); quick.type = 'button';
    links.appendChild(again); links.appendChild(quick);
    loginBtn.insertAdjacentElement('afterend', links);
    loginBtn.removeAttribute('data-demo'); loginBtn.type = 'button';

    var codeSent = false;
    function step(sent) {
      codeSent = sent;
      getBtn.hidden = sent;
      codeField.hidden = !sent; loginBtn.hidden = !sent; again.hidden = !sent; codeBox.hidden = !sent;
      phoneIn.readOnly = sent;
    }
    function sendCode() {
      if (digits(phoneIn.value).length !== 10) { err(phoneIn, 'Введите номер полностью: +7 и 10 цифр'); phoneIn.focus(); return; }
      err(phoneIn, '');
      codeBox.textContent = '';
      codeBox.appendChild(el('span', null, 'Код в MAX: '));
      codeBox.appendChild(el('strong', 'mono', DEMO_CODE.split('').join(' ')));
      codeBox.appendChild(el('span', null, ' (демо)'));
      step(true);
      codeIn.value = ''; codeIn.focus();
    }
    function doLogin() {
      if (!codeSent) { sendCode(); return; }
      if (codeIn.value !== DEMO_CODE) { err(codeIn, codeIn.value.length < 4 ? 'Введите 4 цифры из сообщения' : 'Неверный код. Демо-код: ' + DEMO_CODE); codeIn.focus(); return; }
      finish(login(role, phoneIn.value));
    }
    function finish(s) {
      card.classList.add('pk-done');
      codeBox.textContent = 'Вход выполнен: ' + s.name + '. Переходим…';
      codeBox.hidden = false;
      setTimeout(function () { location.href = target(s.role); }, 250);
    }
    getBtn.addEventListener('click', function (e) { e.stopPropagation(); sendCode(); });
    loginBtn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); doLogin(); });
    again.addEventListener('click', function (e) { e.stopPropagation(); step(false); err(codeIn, ''); phoneIn.focus(); });
    quick.addEventListener('click', function (e) { e.stopPropagation(); finish(login(role, digits(phoneIn.value).length === 10 ? phoneIn.value : '')); });

    // регистрация компании → сессия закупщика
    if (regBtn) {
      regBtn.removeAttribute('data-demo'); regBtn.type = 'button';
      var rcard = regBtn.closest('.blueprint') || regBtn.parentNode;
      regBtn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        var ins = $$('input', rcard);
        var inn = ins.filter(function (i) { return /цифр/.test(i.placeholder || ''); })[0];
        var person = ins.filter(function (i) { return /имя/i.test(i.placeholder || ''); })[0];
        var mail = ins.filter(function (i) { return /@/.test(i.placeholder || ''); })[0];
        var ok = true;
        if (inn) { var n = inn.value.replace(/\D/g, ''); if (n.length !== 10 && n.length !== 12) { err(inn, 'ИНН — 10 или 12 цифр'); ok = false; } else err(inn, ''); }
        if (person) { if (txt({ textContent: person.value }).length < 2) { err(person, 'Укажите контактное лицо'); ok = false; } else err(person, ''); }
        if (mail) { if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail.value.trim())) { err(mail, 'Проверьте адрес почты'); ok = false; } else err(mail, ''); }
        if (!ok) { var bad = $('.pk-invalid', rcard); if (bad) bad.focus(); return; }
        // название компании — из карточки проверки по ИНН
        var company = $$('div', rcard).map(txt).filter(function (t) { return /^(ООО|АО|ПАО|ЗАО|ИП)\s/.test(t) && t.length < 80; })[0] || 'Новая компания';
        var name = person.value.split(',')[0].trim();
        var s = login('buyer', digits(phoneIn.value).length === 10 ? phoneIn.value : '', { name: name, company: company, email: mail ? mail.value.trim() : '', inn: inn ? inn.value.replace(/\D/g, '') : '' });
        regBtn.textContent = 'Компания зарегистрирована · переходим в кабинет';
        setTimeout(function () { location.href = q.get('role') && q.get('role') !== 'buyer' ? BASE + HOME.buyer : target(s.role); }, 400);
      });
    }

    step(false);
    setRole(role);
    if (phoneIn.value) phoneIn.value = formatPhone(phoneIn.value);
  }

  // ═════════ Старт ═════════
  var params = new URLSearchParams(location.search);
  var demo = params.get('demo');
  // обход для автотестов и скриншотов: ?demo=buyer|vendor|operator
  if (isRole(demo)) {
    var cur = get();
    if (!cur || cur.role !== demo) { try { localStorage.setItem(KEY, JSON.stringify(Object.assign(copy(PROFILES[demo]), { since: new Date().toISOString() }))); } catch (e) {} }
  }
  var need = guardRole();
  if (need) {
    document.documentElement.classList.add('pk-guard');
    require(need);
  }

  window.PK_AUTH = { get: get, login: login, logout: logout, require: require, reset: reset, profiles: PROFILES, BASE: BASE };

  function boot() {
    renderHeaders();
    if (isVhod()) initVhod();
    document.dispatchEvent(new CustomEvent('pk:auth', { detail: get() }));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  // синхронизация между вкладками
  window.addEventListener('storage', function (e) {
    if (e.key !== KEY) return;
    if (guardRole()) { var s = get(), r = guardRole(); if (!s || s.role !== r) { require(r); return; } }
    renderHeaders();
    document.dispatchEvent(new CustomEvent('pk:auth', { detail: get() }));
  });
})();

// ПРОМКОНТУР — рабочая панель оператора (демо без сервера).
// Оживляет экраны панели из макета (CRM, автопилот, права, админка, логистика, ошибки, голосовой робот, экономика,
// карточка клиента) и страницы из tools/gen_admin.js (сделки, клиенты, поставщики, журнал).
// Состояние — localStorage с префиксом pk:adm:. Каждое изменение пишет строку в журнал (кто, когда, раздел, было → стало).
(function () {
  'use strict';
  if (window.PK_AUTH && typeof PK_AUTH.require === 'function') { try { if (!PK_AUTH.require('operator')) return; } catch (e) { /* без защиты */ } }

  var BASE = (document.querySelector('link[rel="manifest"]') || { getAttribute: function () { return '/site.webmanifest'; } }).getAttribute('href').replace('site.webmanifest', '');
  var PATH = location.pathname.slice(location.pathname.indexOf(BASE) === 0 ? BASE.length : 1);
  var DATA = (function () { try { return JSON.parse(document.getElementById('pk-adm-data').textContent); } catch (e) { return { deals: [], clients: [], suppliers: [], audit: [], staff: [], columns: [] }; } })();
  var PFX = 'pk:adm:';
  var M = document.querySelector('main') ? 'main' : '[role="main"]';

  // ═════════ утилиты ═════════
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function txt(e) { return e ? (e.textContent || '').replace(/[\s\u00a0\u202f]+/g, ' ').trim() : ''; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    for (var k in (attrs || {})) { if (k === 'class') e.className = attrs[k]; else if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); }
    if (html != null) e.innerHTML = html;
    return e;
  }
  function money(n) { return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') + '\u00a0₽'; }
  function parseMoney(s) {
    s = String(s || '').replace(/[\u00a0\u202f]/g, ' ');
    var m = s.match(/([\d\s]+(?:,\d+)?)\s*(млн|тыс)?/);
    if (!m || !/\d/.test(m[1])) return 0;
    var v = parseFloat(m[1].replace(/\s/g, '').replace(',', '.'));
    return m[2] === 'млн' ? v * 1e6 : m[2] === 'тыс' ? v * 1e3 : v;
  }
  function short(n) { return n >= 1e6 ? (Math.round(n / 1e5) / 10).toString().replace('.', ',') + '\u00a0млн' : n >= 1e3 ? Math.round(n / 1e3) + '\u00a0тыс' : String(Math.round(n)); }
  function hash(s) { var h = 0; s = String(s); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(PFX + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(PFX + k, JSON.stringify(v)); } catch (e) {} }
  };
  var MONTHS = ['янв', 'февр', 'марта', 'апр', 'мая', 'июня', 'июля', 'авг', 'сент', 'окт', 'нояб', 'дек'];
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function nowStr(d) { d = d || new Date(); return d.getDate() + ' ' + MONTHS[d.getMonth()] + ', ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function hm(d) { d = d || new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function who() {
    var s = null; try { s = window.PK_AUTH && PK_AUTH.get && PK_AUTH.get(); } catch (e) {}
    if (s && s.name) return s.name + (s.title ? ' · ' + s.title : '');
    return 'Петров А. · админ';
  }
  function whoShort() { return who().split(' · ')[0]; }
  function live(msg) { var r = $('#pk-adm-live'); if (!r) { r = el('div', { id: 'pk-adm-live', class: 'pk-vh', 'aria-live': 'polite', role: 'status' }); document.body.appendChild(r); } r.textContent = ''; setTimeout(function () { r.textContent = msg; }, 30); }
  var toastEl;
  function toast(msg) {
    if (!toastEl) { toastEl = el('div', { class: 'pk-toast pk-adm-toast', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('on');
    clearTimeout(toastEl._t); toastEl._t = setTimeout(function () { toastEl.classList.remove('on'); }, 3800);
  }
  function btn(label, cls, attrs) { var b = el('button', Object.assign({ type: 'button', class: 'btn ' + (cls || 'btn-secondary') }, attrs || {})); b.textContent = label; return b; }
  // кнопка из макета: снять демо-обработчик site.js (он срабатывает только при data-demo)
  function own(b) { if (b) { b.removeAttribute('data-demo'); b.setAttribute('type', 'button'); } return b; }
  function on(b, fn) { if (!b) return; own(b); b.addEventListener('click', function (e) { e.preventDefault(); fn(e, b); }); }
  function findBtn(root, re) { return $$('button, a.btn', root || document).filter(function (b) { return re.test(txt(b)); }); }
  function blockByTitle(re) { var h = $$('h1, h2, h3').filter(function (x) { return re.test(txt(x)); })[0]; return h ? (h.closest('.blueprint') || h.parentElement) : null; }
  function headingOf(node) {
    var b = node.closest('.blueprint'); var h = b && $('h2, h3', b);
    var lbl = b && $$('.mono', b).filter(function (m) { return m.compareDocumentPosition(node) & 4 && !m.closest('td') && !m.closest('.field') && txt(m).length < 50 && !/\d{2}:\d{2}/.test(txt(m)); }).pop();
    return h ? txt(h) + (lbl && !/^\d/.test(txt(lbl)) ? ' · ' + txt(lbl) : '') : (txt($('h1')) || 'Панель');
  }
  function csv(name, rows) {
    var body = rows.map(function (r) { return r.map(function (c) { c = String(c == null ? '' : c); return /[";\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(';'); }).join('\n');
    var a = el('a', { href: URL.createObjectURL(new Blob(['\ufeff' + body], { type: 'text/csv;charset=utf-8' })), download: name });
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast('Файл ' + name + ' сформирован: ' + (rows.length - 1) + ' строк.');
  }
  function tableRows(table) { return $$('tr', table).map(function (tr) { return $$('th, td', tr).map(function (c) { return txt(c); }); }); }
  function setTag(tag, cls, label) { if (!tag) return; tag.className = 'tag ' + cls; tag.textContent = label; }

  // ═════════ модальные окна ═════════
  var lastFocus;
  function modal(opts) {
    closeModal();
    lastFocus = document.activeElement;
    var wrap = el('div', { class: 'pk-adm-modal' + (opts.side ? ' is-side' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'pk-adm-mt' });
    var box = el('form', { class: 'pk-adm-modal-box' + (opts.side ? ' is-side' : ''), novalidate: '' });
    box.innerHTML = '<div class="pk-adm-modal-h"><h2 id="pk-adm-mt">' + esc(opts.title) + '</h2><button type="button" class="pk-adm-x" aria-label="Закрыть">×</button></div><div class="pk-adm-modal-b">' + (opts.html || '') + '</div><div class="pk-adm-err" role="alert" hidden></div>';
    var foot = el('div', { class: 'pk-adm-modal-f' });
    (opts.buttons || [{ label: 'Готово', primary: true }]).forEach(function (b) {
      var x = btn(b.label, b.primary ? 'btn-primary' : 'btn-secondary', b.primary ? { type: 'submit' } : {});
      if (b.primary) x.setAttribute('type', 'submit');
      x.addEventListener('click', function (e) {
        if (b.primary) return; e.preventDefault();
        if (b.onClick) { if (b.onClick(box) === false) return; }
        closeModal();
      });
      foot.appendChild(x);
    });
    box.appendChild(foot);
    box.addEventListener('submit', function (e) {
      e.preventDefault();
      var pb = (opts.buttons || []).filter(function (b) { return b.primary; })[0];
      var err = pb && pb.onClick ? pb.onClick(box) : null;
      var eb = $('.pk-adm-err', box);
      if (typeof err === 'string') { eb.textContent = err; eb.hidden = false; var bad = $('[name]:focus', box) || $('.pk-adm-modal-b [name]', box); return; }
      eb.hidden = true;
      if (err === false) return;
      closeModal();
    });
    wrap.appendChild(box);
    wrap.addEventListener('mousedown', function (e) { if (e.target === wrap) closeModal(); });
    $('.pk-adm-x', box).addEventListener('click', closeModal);
    document.body.appendChild(wrap);
    document.documentElement.classList.add('pk-adm-lock');
    var f = $('input:not([type=hidden]), select, textarea', $('.pk-adm-modal-b', box)) || $('.pk-adm-x', box);
    setTimeout(function () { f.focus(); }, 20);
    if (opts.onOpen) opts.onOpen(box);
    return box;
  }
  function closeModal() {
    var m = $('.pk-adm-modal'); if (!m) return;
    m.remove(); document.documentElement.classList.remove('pk-adm-lock');
    if (lastFocus && lastFocus.focus && document.contains(lastFocus)) lastFocus.focus();
  }
  document.addEventListener('keydown', function (e) {
    var m = $('.pk-adm-modal'); if (!m) return;
    if (e.key === 'Escape') { e.stopPropagation(); closeModal(); return; }
    if (e.key === 'Tab') {
      var f = $$('a[href], button, input, select, textarea', m).filter(function (x) { return !x.disabled && x.offsetParent !== null; });
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  }, true);
  function field(label, control, hint) { return '<div class="field pk-adm-field"><label>' + esc(label) + '</label>' + control + (hint ? '<div class="pk-adm-hint">' + esc(hint) + '</div>' : '') + '</div>'; }
  function input(name, value, extra) { return '<input class="input" name="' + name + '" value="' + esc(value == null ? '' : value) + '" ' + (extra || '') + '>'; }
  function select(name, opts, value) { return '<select class="input" name="' + name + '">' + opts.map(function (o) { var v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o; return '<option value="' + esc(v) + '"' + (String(v) === String(value) ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('') + '</select>'; }
  function val(box, name) { var f = box.querySelector('[name="' + name + '"]'); return f ? (f.type === 'checkbox' ? f.checked : f.value.trim()) : ''; }
  // подтверждение «двух подписей»
  function twoSign(title, summary, done) {
    var me = whoShort();
    var others = (DATA.staff || []).filter(function (s) { return s.split(' · ')[0] !== me && /админ|оператор/.test(s); });
    var code = String(1000 + Math.floor(Math.random() * 9000));
    modal({ title: title,
      html: '<p class="pk-adm-muted">Защитное ограничение: изменение вступает в силу после двух подписей. Демо — код показан на экране.</p><div class="pk-adm-sum">' + summary + '</div>' +
        '<label class="radio pk-adm-check"><input type="checkbox" name="s1"><span class="dot"></span>Подписываю: ' + esc(who()) + '</label>' +
        field('Вторая подпись', select('s2', [['', 'Выберите сотрудника']].concat(others.map(function (o) { return [o, o]; })), '')) +
        field('Код подтверждения второго сотрудника', input('code', '', 'inputmode="numeric" maxlength="4" autocomplete="off"'), 'Демо-код: ' + code),
      buttons: [{ label: 'Отмена' }, { label: 'Подписать и сохранить', primary: true, onClick: function (box) {
        if (!val(box, 's1')) return 'Поставьте первую подпись.';
        if (!val(box, 's2')) return 'Выберите второго сотрудника.';
        if (val(box, 'code') !== code) return 'Код второго сотрудника не совпал.';
        done(val(box, 's2'));
      } }] });
  }

  // ═════════ журнал изменений ═════════
  function journal() { return LS.get('journal', []); }
  // section — раздел; what — объект; from/to — было/стало; undo — описание отката {k, ...}
  function log(section, what, from, to, undo) {
    var j = journal();
    var rec = { id: 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ts: Date.now(), when: nowStr(), section: section, what: what, from: String(from == null ? '—' : from), to: String(to == null ? '—' : to), who: who(), page: PATH, undo: undo || null };
    j.unshift(rec); if (j.length > 400) j.length = 400;
    LS.set('journal', j);
    document.dispatchEvent(new CustomEvent('pk:adm:log', { detail: rec }));
    return rec;
  }
  function allJournal() {
    var rolled = LS.get('rolled', {});
    return journal().concat((DATA.audit || []).map(function (a) { return Object.assign({ macro: true }, a); })).map(function (r) { return Object.assign({}, r, { rolled: !!rolled[r.id] }); });
  }
  var ST = LS.get('st', {});
  function stGet(k, d) { return Object.prototype.hasOwnProperty.call(ST, k) ? ST[k] : d; }
  function stSet(k, v) { ST[k] = v; LS.set('st', ST); }
  function rollback(rec) {
    var rolled = LS.get('rolled', {});
    if (rolled[rec.id]) { toast('Эта правка уже откачена.'); return; }
    var u = rec.undo;
    if (u) {
      if (u.k === 'st') { if (u.prev === undefined) { delete ST[u.key]; LS.set('st', ST); } else stSet(u.key, u.prev); }
      else if (u.k === 'ls') LS.set(u.key, u.prev);
    }
    rolled[rec.id] = true; LS.set('rolled', rolled);
    log(rec.section, 'Откат: ' + rec.what, rec.to, rec.from, null);
    toast('Откачено: ' + rec.what + ' — ' + rec.to + ' → ' + rec.from + (rec.macro ? ' (демо: в макете значение не хранится)' : '') + '.');
  }
  function sectionTag(s) { return /Цены|CRM|Права/.test(s) ? 'tag-accent' : /Источники|Контент|Логистика/.test(s) ? 'tag-outline' : 'tag-neutral'; }
  function journalRow(r, onRoll) {
    var tr = el('tr', { 'data-sec': r.section, 'data-who': r.who });
    tr.innerHTML = '<td class="mono">' + esc(r.when) + '</td><td><span class="tag ' + sectionTag(r.section) + '">' + esc(r.section) + '</span></td><td>' + esc(r.what) + (r.macro ? '' : '<div class="mono pk-adm-muted">в этом браузере</div>') + '</td><td class="mono">' + esc(r.from) + ' → ' + esc(r.to) + '</td><td>' + esc(r.who) + '</td><td></td>';
    var cell = tr.lastChild;
    if (/^Откат: /.test(r.what)) cell.innerHTML = '<span class="mono pk-adm-muted">откат</span>';
    else if (r.rolled) cell.innerHTML = '<span class="tag tag-neutral">откачено</span>';
    else { var b = btn('Откатить'); b.setAttribute('aria-label', 'Откатить: ' + r.what); b.addEventListener('click', function () { onRoll(r); }); cell.appendChild(b); }
    return tr;
  }

  // ═════════ шапка панели: пункты меню и активный раздел ═════════
  function chrome() {
    var nav = $('header nav[aria-label]');
    if (nav) {
      var links = $$('a', nav);
      var active = links.filter(function (a) { return /background/.test(a.getAttribute('style') || ''); })[0];
      var idle = links.filter(function (a) { return a !== active; })[0];
      var activeStyle = active ? active.getAttribute('style') : '', idleStyle = idle ? idle.getAttribute('style') : '';
      var activeIco = active && $('.ico', active) ? $('.ico', active).getAttribute('style') : '', idleIco = idle && $('.ico', idle) ? $('.ico', idle).getAttribute('style') : '';
      // «Клиенты», «Поставщики», «Журнал» — в подменю рабочих списков под шапкой: в шапке 12 пунктов не помещаются в одну строку
      var map = { 'panel/sdelki/': 'panel/crm/', 'panel/klienty/': 'panel/klienty/', 'panel/klient/': 'panel/klient/' };
      var cur = Object.keys(map).filter(function (p) { return PATH.indexOf(p) === 0; }).map(function (p) { return map[p]; })[0] || PATH.replace(/^(panel\/[^/]+\/).*$/, '$1');
      $$('a', nav).forEach(function (a) {
        var is = a.getAttribute('href') === BASE + cur;
        a.setAttribute('style', is ? activeStyle : idleStyle);
        var ic = $('.ico', a); if (ic) ic.setAttribute('style', is ? activeIco : idleIco);
        if (is) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      });
    }
    // блоки целиком не должны уводить на товар: data-href оставляем только строкам таблиц
    $$(M + ' .blueprint[data-href]').forEach(function (b) { if ($('h2, h3, table, button', b)) b.removeAttribute('data-href'); });
    // таблицы макета — горизонтальный скролл на узком экране
    $$(M + ' table.table').forEach(function (t) { var p = t.parentElement; if (p && !p.classList.contains('pk-adm-scroll')) p.classList.add('pk-adm-scrollx'); });
    // подменю рабочих списков на экранах макета
    var screen = $('[data-screen-label]');
    if (screen && !$('.pk-adm-sub')) {
      var inner = screen.firstElementChild;
      var sub = el('nav', { class: 'pk-adm-sub pk-adm-sub-macro', 'aria-label': 'Рабочие списки панели' });
      [['panel/crm/', 'Сделки', 'op-crm'], ['panel/klienty/', 'Клиенты', 'op-client'], ['panel/postavshchiki/', 'Поставщики', 'tier-sync'], ['panel/zhurnal/', 'Журнал изменений', 'doc-generic']].forEach(function (x) {
        var a = el('a', { href: BASE + x[0] }, '<span class="ico ico-16 i-' + x[2] + '"></span>' + x[1]); if (PATH === x[0]) a.setAttribute('aria-current', 'page'); sub.appendChild(a);
      });
      if (inner) inner.insertBefore(sub, inner.firstChild);
    }
  }

  // ═════════ общие поля экранов: тумблеры, поля и списки сохраняются и пишут журнал ═════════
  var SECTION_BY_PAGE = { 'panel/crm/': 'CRM', 'panel/avtopilot/': 'Автоматизация', 'panel/prava/': 'Права', 'panel/logistika/': 'Логистика', 'panel/oshibki/': 'Автоматизация', 'panel/golosovoj-robot/': 'Каналы', 'panel/ekonomika/': 'Экономика', 'panel/klient/': 'CRM', 'panel/admin/': 'Админка' };
  var VALIDATORS = [];
  function controlLabel(c) {
    var lab = c.closest('label');
    if (lab && txt(lab)) return txt(lab);
    var f = c.closest('.field'); if (f && $('label', f)) return txt($('label', f));
    var tr = c.closest('tr'); if (tr) { var td = tr.cells[0]; var th = c.closest('table').tHead; var idx = c.closest('td') ? c.closest('td').cellIndex : 0; return (td ? txt(td) : '') + (th && th.rows[0].cells[idx] ? ' · ' + txt(th.rows[0].cells[idx]) : ''); }
    var row = c.parentElement; var t = row && $$('div', row).filter(function (d) { return !d.contains(c) && txt(d); })[0];
    return t ? txt(t) : (c.getAttribute('aria-label') || 'поле');
  }
  function sectionFor(c) { return (typeof SECTION_BY_PAGE[PATH] === 'string' && PATH !== 'panel/admin/') ? SECTION_BY_PAGE[PATH] : adminSection(c); }
  function valueOf(c) { return c.type === 'checkbox' || c.type === 'radio' ? c.checked : c.value; }
  function show(c, v) { return c.type === 'checkbox' ? (v ? 'вкл' : 'выкл') : c.type === 'radio' ? (v ? 'выбрано' : '—') : String(v); }
  function persistControls() {
    var main = $('[data-screen-label]'); if (!main) return;
    // секреты (API-ключи, токены) не сохраняем и не показываем открытым текстом
    $$('input', main).forEach(function (c) { if (/ключ|токен|пароль/i.test(controlLabel(c)) && c.type === 'text') { c.type = 'password'; c.autocomplete = 'off'; } });
    var ctrls = $$('input, select, textarea', main).filter(function (c) { return !c.closest('[data-adm-skip]') && !c.hasAttribute('data-adm-skip') && c.type !== 'search' && c.type !== 'password' && !/ключ|токен|логин|пароль|api key|secret/i.test(controlLabel(c) + ' ' + (c.placeholder || '')); });
    ctrls.forEach(function (c, i) {
      var label = controlLabel(c);
      var key = PATH + '#' + hash(headingOf(c) + '|' + label + '|' + i);
      c.setAttribute('data-adm-key', key);
      if (!c.id && !c.getAttribute('aria-label') && !c.closest('label')) c.setAttribute('aria-label', label);
      var stored = stGet(key);
      if (stored !== undefined) { if (c.type === 'checkbox' || c.type === 'radio') c.checked = !!stored; else c.value = stored; }
      c._admPrev = valueOf(c);
      var commit = function () {
        var v = valueOf(c), prev = c._admPrev;
        if (v === prev) return;
        if (c.type === 'radio' && !v) return;
        for (var k = 0; k < VALIDATORS.length; k++) {
          var msg = VALIDATORS[k](c, label, v, prev);
          if (msg) { if (c.type === 'checkbox') c.checked = prev; else c.value = prev; toast(msg); c.setAttribute('aria-invalid', 'true'); setTimeout(function () { c.removeAttribute('aria-invalid'); }, 2500); return; }
        }
        var undoPrev = stGet(key);
        if (c.type === 'radio') $$('input[type=radio][name="' + c.name + '"]', main).forEach(function (r) { if (r !== c) { stSet(r.getAttribute('data-adm-key'), false); r._admPrev = false; } });
        stSet(key, v); c._admPrev = v;
        log(sectionFor(c), headingOf(c) + ': ' + label, show(c, prev), show(c, v), { k: 'st', key: key, prev: undoPrev });
        c.classList.add('pk-adm-saved'); setTimeout(function () { c.classList.remove('pk-adm-saved'); }, 900);
        live('Сохранено: ' + label);
        document.dispatchEvent(new CustomEvent('pk:adm:control', { detail: { control: c, label: label, value: v } }));
      };
      c.addEventListener('change', commit);
      if (c.tagName === 'INPUT' && c.type !== 'checkbox' && c.type !== 'radio') c.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); c.blur(); } });
    });
  }

  // ═════════ CRM: канбан ═════════
  var DEAL_ST = LS.get('deals', {});
  function dealState(id) { return DEAL_ST[id] || {}; }
  function saveDeal(id, patch) { DEAL_ST[id] = Object.assign({}, DEAL_ST[id], patch); LS.set('deals', DEAL_ST); }
  function dealById(id) { return (DATA.deals || []).concat(LS.get('newDeals', [])).filter(function (d) { return d.id === id; })[0]; }
  var CLOSE_REASONS = ['Оплачено и отгружено', 'Дорого — выбрали конкурента', 'Нет в наличии в нужный срок', 'Клиент не отвечает 14 дней', 'Дубль сделки', 'Проект отложен'];

  function initCrm() {
    var head = $$(M + ' span').filter(function (s) { return txt(s) === 'Входящие'; })[0];
    if (!head) return;
    var board = head.parentElement.parentElement.parentElement;
    board.classList.add('pk-kb'); board.setAttribute('aria-label', 'Канбан сделок');
    var cols = Array.prototype.slice.call(board.children);
    var COLS = cols.map(function (col, ci) {
      col.classList.add('pk-kb-col'); col.setAttribute('data-col', ci);
      var h = col.firstElementChild, counter = $('.mono', h);
      var cards = $$('.blueprint', col);
      var initSum = cards.reduce(function (a, c) { return a + parseMoney(txt($$('.mono', c)[2])); }, 0);
      var m = txt(counter).match(/^(\d+)\s*·\s*(.+)$/) || [];
      col.setAttribute('role', 'list'); col.setAttribute('aria-label', txt($('span', h)));
      return { el: col, title: txt($('span', h)), counter: counter, baseCount: (+m[1] || cards.length) - cards.length, baseSum: parseMoney(m[2]) - initSum };
    });
    var byTitle = {}; (DATA.deals || []).forEach(function (d) { byTitle[d.title] = d; });
    function decorate(card, d) {
      card.classList.add('pk-kb-card'); card.setAttribute('data-deal', d.id); card.setAttribute('tabindex', '0'); card.setAttribute('role', 'listitem');
      card.setAttribute('draggable', 'true'); card.removeAttribute('data-href');
      card.setAttribute('aria-label', d.title + ', ' + d.channel + ', ' + (d.sum ? money(d.sum) : 'сумма не определена') + '. Enter — открыть, Alt+стрелки — переместить');
      if (!$('.pk-kb-move', card)) {
        var bar = el('div', { class: 'pk-kb-tools' });
        var mv = btn('Переместить', 'btn-secondary pk-kb-move'); mv.setAttribute('aria-label', 'Переместить сделку «' + d.title + '»');
        mv.addEventListener('click', function (e) { e.stopPropagation(); moveDialog(card); });
        bar.appendChild(mv); card.appendChild(bar);
      }
      paintOwner(card);
    }
    function paintOwner(card) {
      var st = dealState(card.getAttribute('data-deal')); if (!st.owner) return;
      var tag = $('.tag', card); if (!tag) return;
      var robot = st.owner === 'робот';
      tag.className = 'tag ' + (robot ? 'tag-accent' : 'tag-outline');
      tag.innerHTML = (robot ? '<span class="ico i-op-autopilot"></span>' : '') + esc(st.owner);
    }
    function newCard(d) {
      var c = el('div', { class: 'blueprint pk-kb-new' });
      var ic = { MAX: 'i-channel-max', 'Почта': 'i-channel-mail', 'Сайт': 'i-channel-web', 'Телефон': 'i-channel-phone' }[d.channel] || 'i-channel-web';
      c.innerHTML = '<div class="pk-kb-top"><span class="mono"><span class="ico ' + ic + '"></span>' + esc(d.channel) + '</span><span class="mono">' + esc(d.age || 'сейчас') + '</span></div><span class="pk-kb-title">' + esc(d.title) + '</span><span class="pk-kb-last">' + esc(d.last) + '</span><div class="pk-kb-top"><span class="mono">' + (d.sum ? money(d.sum) : '—') + '</span><span class="tag tag-outline">' + esc(d.owner) + '</span></div>';
      return c;
    }
    // исходные карточки + созданные вручную
    $$('.blueprint', board).forEach(function (card) { var t = txt($$('span', card).filter(function (s) { return !s.classList.contains('mono') && !s.closest('.mono') && !s.closest('.tag'); })[0]); var d = byTitle[t]; if (d) decorate(card, d); });
    LS.get('newDeals', []).forEach(function (d) { var c = newCard(d); decorate(c, d); COLS[0].el.appendChild(c); });
    // расставить по сохранённым колонкам, закрытые убрать
    $$('.pk-kb-card', board).forEach(function (card) {
      var st = dealState(card.getAttribute('data-deal'));
      if (st.closed) { card.remove(); return; }
      if (st.col != null && COLS[st.col] && card.parentElement !== COLS[st.col].el) COLS[st.col].el.appendChild(card);
    });
    function recalc() {
      COLS.forEach(function (c) {
        var cards = $$('.pk-kb-card', c.el);
        var sum = cards.reduce(function (a, card) { var d = dealById(card.getAttribute('data-deal')); return a + (d ? d.sum || 0 : 0); }, 0);
        c.counter.textContent = (c.baseCount + cards.length) + ' · ' + short(Math.max(0, c.baseSum + sum));
        c.counter.setAttribute('aria-label', (c.baseCount + cards.length) + ' сделок на ' + money(Math.max(0, c.baseSum + sum)));
      });
    }
    function move(card, to, how) {
      var id = card.getAttribute('data-deal'), d = dealById(id);
      var from = +card.parentElement.getAttribute('data-col');
      if (from === to) return;
      COLS[to].el.appendChild(card);
      saveDeal(id, { col: to });
      recalc(); applyFilter();
      log('CRM', 'Сделка «' + d.title + '»', COLS[from].title, COLS[to].title, { k: 'ls', key: 'deals', prev: JSON.parse(JSON.stringify(Object.assign({}, DEAL_ST, (function () { var o = {}; o[id] = Object.assign({}, DEAL_ST[id], { col: from }); return o; })()))) });
      live('Сделка «' + d.title + '» перемещена в «' + COLS[to].title + '»' + (how ? ' ' + how : ''));
      toast('«' + d.title + '» → ' + COLS[to].title);
      card.classList.add('pk-kb-flash'); setTimeout(function () { card.classList.remove('pk-kb-flash'); }, 900);
    }
    function moveDialog(card) {
      var from = +card.parentElement.getAttribute('data-col');
      modal({ title: 'Переместить сделку', html: '<p class="pk-adm-muted">' + esc(dealById(card.getAttribute('data-deal')).title) + '</p><fieldset class="pk-adm-radios"><legend class="pk-vh">Колонка</legend>' + COLS.map(function (c, i) { return '<label class="radio"><input type="radio" name="col" value="' + i + '"' + (i === from ? ' checked' : '') + '><span class="dot"></span>' + esc(c.title) + '</label>'; }).join('') + '</fieldset>',
        buttons: [{ label: 'Отмена' }, { label: 'Переместить', primary: true, onClick: function (box) { var v = box.querySelector('input[name=col]:checked'); if (!v) return 'Выберите колонку.'; setTimeout(function () { move(card, +v.value); card.focus(); }, 0); } }] });
    }
    // перетаскивание мышью
    var dragCard = null;
    board.addEventListener('dragstart', function (e) { var c = e.target.closest && e.target.closest('.pk-kb-card'); if (!c) return; dragCard = c; c.classList.add('is-drag'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', c.getAttribute('data-deal')); } catch (x) {} });
    board.addEventListener('dragend', function () { if (dragCard) dragCard.classList.remove('is-drag'); dragCard = null; COLS.forEach(function (c) { c.el.classList.remove('is-over'); }); });
    COLS.forEach(function (c, i) {
      c.el.addEventListener('dragover', function (e) { if (!dragCard) return; e.preventDefault(); c.el.classList.add('is-over'); });
      c.el.addEventListener('dragleave', function (e) { if (!c.el.contains(e.relatedTarget)) c.el.classList.remove('is-over'); });
      c.el.addEventListener('drop', function (e) { e.preventDefault(); c.el.classList.remove('is-over'); if (dragCard) move(dragCard, i, 'перетаскиванием'); });
    });
    // перетаскивание пальцем: удержание 350 мс, затем карточка следует за пальцем
    var touch = null;
    board.addEventListener('touchstart', function (e) {
      var c = e.target.closest('.pk-kb-card'); if (!c || e.target.closest('button')) return;
      var t = e.touches[0];
      touch = { card: c, x: t.clientX, y: t.clientY, active: false, timer: setTimeout(function () { touch.active = true; c.classList.add('is-drag'); if (navigator.vibrate) navigator.vibrate(15); }, 350) };
    }, { passive: true });
    board.addEventListener('touchmove', function (e) {
      if (!touch) return;
      var t = e.touches[0];
      if (!touch.active) { if (Math.abs(t.clientX - touch.x) > 8 || Math.abs(t.clientY - touch.y) > 8) { clearTimeout(touch.timer); touch = null; } return; }
      e.preventDefault();
      touch.card.style.transform = 'translate(' + (t.clientX - touch.x) + 'px,' + (t.clientY - touch.y) + 'px)';
      var under = document.elementFromPoint(t.clientX, t.clientY), col = under && under.closest('.pk-kb-col');
      COLS.forEach(function (c) { c.el.classList.toggle('is-over', c.el === col); });
      touch.over = col;
      var r = board.getBoundingClientRect(); if (t.clientX > r.right - 30) board.scrollLeft += 12; else if (t.clientX < r.left + 30) board.scrollLeft -= 12;
    }, { passive: false });
    board.addEventListener('touchend', function () {
      if (!touch) return; clearTimeout(touch.timer);
      var tc = touch; touch = null;
      if (!tc.active) return;
      tc.card.style.transform = ''; tc.card.classList.remove('is-drag'); COLS.forEach(function (c) { c.el.classList.remove('is-over'); });
      if (tc.over) move(tc.card, +tc.over.getAttribute('data-col'), 'перетаскиванием');
      tc.card._noClick = true; setTimeout(function () { tc.card._noClick = false; }, 400);
    });
    // клавиатура и клик
    board.addEventListener('keydown', function (e) {
      var c = e.target.closest && e.target.closest('.pk-kb-card'); if (!c || e.target !== c) return;
      var from = +c.parentElement.getAttribute('data-col');
      if (e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.preventDefault(); var to = from + (e.key === 'ArrowRight' ? 1 : -1); if (COLS[to]) { move(c, to, 'с клавиатуры'); c.focus(); } }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDeal(c.getAttribute('data-deal')); }
    });
    board.addEventListener('click', function (e) {
      var c = e.target.closest('.pk-kb-card'); if (!c || e.target.closest('button, a') || c._noClick) return;
      openDeal(c.getAttribute('data-deal'));
    });
    // фильтр по каналу
    var sel = $$(M + ' select').filter(function (s) { return /Все каналы/.test(txt(s.options[0])); })[0];
    function applyFilter() {
      var ch = sel && sel.selectedIndex > 0 ? sel.value : '';
      $$('.pk-kb-card', board).forEach(function (card) { var d = dealById(card.getAttribute('data-deal')); card.hidden = !!ch && d && d.channel !== ch; });
    }
    if (sel) { sel.setAttribute('data-adm-skip', '1'); sel.setAttribute('aria-label', 'Фильтр по каналу'); sel.value = LS.get('crmFilter', sel.value) || sel.options[0].value; sel.addEventListener('change', function () { LS.set('crmFilter', sel.value); applyFilter(); var n = $$('.pk-kb-card', board).filter(function (c) { return !c.hidden; }).length; live('Показано сделок: ' + n); }); }

    function openDeal(id) {
      var d = dealById(id), st = dealState(id), card = $('.pk-kb-card[data-deal="' + id + '"]', board);
      var col = card ? +card.parentElement.getAttribute('data-col') : d.col;
      var owner = st.owner || d.owner;
      var tl = (d.timeline || []).concat(st.notes || []);
      var box = modal({ side: true, title: (d.code ? d.code + ' · ' : '') + d.title,
        html: '<div class="pk-adm-dealhead"><span class="tag tag-outline">' + esc(COLS[col].title) + '</span><span class="tag ' + (owner === 'робот' ? 'tag-accent' : 'tag-outline') + '" data-owner>' + esc(owner) + '</span><span class="mono">' + esc(d.channel) + '</span><span class="mono pk-adm-big">' + (d.sum ? money(d.sum) : '—') + '</span></div>' +
          (d.client ? '<p>Клиент: ' + clientLink(d.client) + '</p>' : '') +
          (d.items && d.items.length ? '<ul class="pk-adm-items">' + d.items.map(function (i) { return '<li>' + esc(i.name) + ' <span class="mono">× ' + esc(i.qty) + '</span></li>'; }).join('') + '</ul>' : '') +
          '<h3 class="pk-adm-h3">Лента действий робота</h3><ol class="pk-adm-tl">' + tl.map(function (t) { return '<li class="' + (/^Робот/.test(t.who) ? 'is-bot' : '') + '"><span class="mono">' + esc(t.time) + '</span><div><div class="pk-adm-tl-h"><b>' + esc(t.who) + '</b><span class="mono">' + esc(t.action) + '</span></div><p>' + esc(t.text) + '</p></div></li>'; }).join('') + '</ol>' +
          (/^sd-/.test(id) ? '<a class="btn btn-secondary" href="' + BASE + 'panel/sdelki/' + id + '/">Открыть страницу сделки</a>' : ''),
        buttons: [
          { label: 'Взять себе', onClick: function () { setOwner(id, whoShort()); return false; } },
          { label: 'Передать роботу', onClick: function () { setOwner(id, 'робот'); return false; } },
          { label: 'Закрыть с причиной', primary: true, onClick: function () { setTimeout(function () { closeDialog(id, function () { var c2 = $('.pk-kb-card[data-deal="' + id + '"]', board); if (c2) c2.remove(); recalc(); }); }, 0); } }
        ] });
      function setOwner(id2, o) {
        var prev = dealState(id2).owner || d.owner; if (prev === o) { toast('Ответственный уже: ' + o); return; }
        saveDeal(id2, { owner: o, notes: (dealState(id2).notes || []).concat([{ time: hm(), who: whoShort(), action: o === 'робот' ? 'передал роботу' : 'взял себе', text: o === 'робот' ? 'Сделка возвращена автопилоту в границах торга.' : 'Оператор взял сделку, робот больше не пишет клиенту без подтверждения.' }]) });
        log('CRM', 'Ответственный · «' + d.title + '»', prev, o, null);
        var tg = $('[data-owner]', box); if (tg) { tg.textContent = o; tg.className = 'tag ' + (o === 'робот' ? 'tag-accent' : 'tag-outline'); }
        if (card) paintOwner(card);
        toast(o === 'робот' ? 'Сделка передана роботу.' : 'Сделка ваша: ' + o + '.');
      }
    }
    on(findBtn($(M), /^Новая сделка$/)[0], function () {
      modal({ title: 'Новая сделка',
        html: field('Клиент', select('client', [['', 'Новый клиент']].concat((DATA.clients || []).map(function (c) { return [c.slug, c.name]; })), '')) +
          field('Компания (если новый клиент)', input('company', '', 'maxlength="80" placeholder="ООО «…»"')) +
          field('Что нужно', input('title', '', 'maxlength="90" required placeholder="Например: насос на оборотную воду, 40 м³/ч"')) +
          '<div class="pk-adm-row2">' + field('Канал', select('channel', ['Телефон', 'MAX', 'Почта', 'Сайт'], 'Телефон')) + field('Сумма, ₽', input('sum', '', 'inputmode="numeric" placeholder="можно пусто"')) + '</div>' +
          field('Ответственный', select('owner', ['робот', whoShort(), 'инженер'], whoShort())),
        buttons: [{ label: 'Отмена' }, { label: 'Создать сделку', primary: true, onClick: function (box) {
          var title = val(box, 'title'), sumRaw = val(box, 'sum').replace(/\s/g, ''), cl = val(box, 'client'), co = val(box, 'company');
          if (title.length < 4) return 'Опишите, что нужно клиенту (не короче 4 символов).';
          if (sumRaw && !/^\d{1,9}$/.test(sumRaw)) return 'Сумма — целое число рублей без копеек.';
          if (!cl && co.length < 3) return 'Выберите клиента или укажите название компании.';
          var list = LS.get('newDeals', []);
          var d = { id: 'nd-' + Date.now().toString(36), code: 'СД-' + (2232 + list.length), col: 0, channel: val(box, 'channel'), age: 'сейчас', title: title, last: 'Создано вручную: ' + whoShort(), sum: +sumRaw || 0, owner: val(box, 'owner'), client: cl, company: co, items: [], timeline: [{ time: hm(), who: whoShort(), action: 'создал сделку', text: title + (co ? ' · ' + co : '') }] };
          list.push(d); LS.set('newDeals', list); DATA.deals.push(d);
          var c = newCard(d); decorate(c, d); COLS[0].el.insertBefore(c, COLS[0].el.children[1] || null); recalc(); applyFilter();
          log('CRM', 'Новая сделка «' + title + '»', '—', 'Входящие · ' + (d.sum ? money(d.sum) : 'без суммы'), { k: 'ls', key: 'newDeals', prev: list.slice(0, -1) });
          toast('Сделка создана во «Входящих».'); setTimeout(function () { c.focus(); }, 50);
        } }] });
    });
    recalc(); applyFilter();
  }
  function clientLink(slug) {
    var c = (DATA.clients || []).filter(function (x) { return x.slug === slug; })[0];
    return c ? '<a href="' + BASE + (c.existing ? 'panel/klient/' : 'panel/klienty/' + c.slug + '/') + '">' + esc(c.name) + '</a>' : esc(slug);
  }
  function closeDialog(id, done) {
    var d = dealById(id);
    modal({ title: 'Закрыть сделку', html: '<p class="pk-adm-muted">' + esc(d.title) + '</p>' + field('Причина', select('reason', [['', 'Выберите причину']].concat(CLOSE_REASONS), '')) + field('Комментарий', '<textarea class="input" name="comment" rows="3" maxlength="300" placeholder="Необязательно: попадёт в аналитику потерь"></textarea>'),
      buttons: [{ label: 'Отмена' }, { label: 'Закрыть сделку', primary: true, onClick: function (box) {
        var r = val(box, 'reason'); if (!r) return 'Причина обязательна — по ней считается аналитика потерь.';
        var prev = JSON.parse(JSON.stringify(DEAL_ST));
        saveDeal(id, { closed: true, reason: r, comment: val(box, 'comment'), closedAt: nowStr() });
        log('CRM', 'Сделка «' + d.title + '» закрыта', 'в работе', r, { k: 'ls', key: 'deals', prev: prev });
        toast('Сделка закрыта: ' + r + '.'); if (done) done(r);
      } }] });
  }

  // ═════════ страница сделки ═════════
  function initDealPage() {
    var bar = $('[data-deal]'); if (!bar) return;
    var id = bar.getAttribute('data-deal'), d = dealById(id); if (!d) return;
    var st = dealState(id);
    var stage = $('[data-deal-stage]', bar), ownerTag = $('[data-deal-owner]', bar), state = $('[data-deal-state]', bar), feed = $('[data-deal-feed]');
    function paint() {
      st = dealState(id);
      if (st.col != null) stage.value = st.col;
      var o = st.owner || d.owner; ownerTag.textContent = o; ownerTag.className = 'tag ' + (o === 'робот' ? 'tag-accent' : 'tag-outline');
      if (st.closed) { setTag(state, 'tag-neutral', 'закрыта: ' + st.reason); stage.disabled = true; $$('[data-deal-act]').forEach(function (b) { b.disabled = true; }); }
      else setTag(state, 'tag-accent', 'в работе');
    }
    function note(n) {
      var li = el('li', { class: '' }, '<span class="mono">' + esc(n.time) + '</span><div><div class="pk-adm-tl-h"><b>' + esc(n.who) + '</b><span class="mono">' + esc(n.action) + '</span></div><p>' + esc(n.text) + '</p></div>');
      feed.appendChild(li);
    }
    (st.notes || []).forEach(note);
    stage.addEventListener('change', function () {
      var from = st.col != null ? st.col : d.col, to = +stage.value;
      saveDeal(id, { col: to }); log('CRM', 'Сделка «' + d.title + '»', DATA.columns[from], DATA.columns[to], null);
      toast('Этап: ' + DATA.columns[to]); paint();
    });
    function addNote(action, text) { var n = { time: hm(), who: whoShort(), action: action, text: text }; saveDeal(id, { notes: (dealState(id).notes || []).concat([n]) }); note(n); }
    $$('[data-deal-act]').forEach(function (b) {
      b.addEventListener('click', function () {
        var a = b.getAttribute('data-deal-act');
        if (a === 'close') { closeDialog(id, function (r) { addNote('закрыл сделку', r); paint(); }); return; }
        var o = a === 'take' ? whoShort() : 'робот', prev = dealState(id).owner || d.owner;
        if (prev === o) { toast('Ответственный уже: ' + o); return; }
        saveDeal(id, { owner: o }); log('CRM', 'Ответственный · «' + d.title + '»', prev, o, null);
        addNote(a === 'take' ? 'взял себе' : 'передал роботу', a === 'take' ? 'Робот не пишет клиенту без подтверждения оператора.' : 'Сделка возвращена автопилоту в границах торга.');
        paint(); toast(a === 'take' ? 'Сделка ваша.' : 'Сделка передана роботу.');
      });
    });
    var form = $('[data-deal-note]');
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault(); var i = $('input', form), v = i.value.trim();
      if (v.length < 2) { toast('Комментарий пустой.'); i.focus(); return; }
      addNote('комментарий', v); log('CRM', 'Комментарий к сделке «' + d.title + '»', '—', v.slice(0, 60), null); i.value = ''; live('Комментарий добавлен');
    });
    var docs = LS.get('docs', {});
    $$('[data-doc]').forEach(function (li) {
      var k = id + ':' + li.getAttribute('data-doc'), tag = $('[data-doc-status]', li), b = $('[data-doc-act]', li), name = txt(li.children[1]);
      if (docs[k]) { setTag(tag, 'tag-accent', docs[k]); b.textContent = 'Переотправить'; }
      b.addEventListener('click', function () {
        var prev = txt(tag); b.disabled = true; setTag(tag, 'tag-neutral', 'формируется…');
        setTimeout(function () {
          var s = /Сформировать/.test(txt(b)) ? 'готово' : 'отправлено';
          setTag(tag, 'tag-accent', s); b.disabled = false; b.textContent = 'Переотправить';
          docs[k] = s; LS.set('docs', docs); log('CRM', 'Документ «' + name + '»', prev, s, null); addNote('документ', name + ' — ' + s + ' (демо, клиенту не уходит)');
          toast(name + ': ' + s + ' (демо).');
        }, 900);
      });
    });
    paint();
  }

  // ═════════ автопилот ═════════
  function initAutopilot() {
    var qb = blockByTitle(/^Ждёт человека/); if (!qb) return;
    var h = $('h3', qb), list = h.parentElement.nextElementSibling;
    var rows = Array.prototype.slice.call(list.children);
    var Q = LS.get('apq', {});
    var kpi = $$(M + ' .blueprint').filter(function (b) { return /ждут человека/.test(txt(b)) && !$('h3', b); })[0];
    function count() {
      var left = rows.filter(function (r) { return document.contains(r); }).length;
      h.textContent = 'Ждёт человека · ' + left;
      if (kpi) { var v = $('.mono', kpi); if (v) v.textContent = left; }
      if (!left && !$('.pk-adm-empty', list)) list.appendChild(el('div', { class: 'pk-adm-empty' }, '<b>Очередь пуста</b><span>Все задачи разобраны. Новые появятся по правилам эскалации ниже.</span>'));
    }
    rows.forEach(function (r) {
      var title = txt(r.children[1] && r.children[1].firstElementChild), key = hash(title), st = Q[key] || {};
      r.classList.add('pk-apq-row');
      if (st.done) { r.remove(); return; }
      var act = r.lastElementChild;
      var take = btn(st.taken ? 'В работе' : 'Взять', 'btn-secondary'), done = btn('Решено', 'btn-secondary');
      take.setAttribute('aria-label', 'Взять задачу: ' + title); done.setAttribute('aria-label', 'Решено: ' + title);
      if (st.taken) { take.setAttribute('aria-pressed', 'true'); r.classList.add('is-taken'); }
      var who2 = el('span', { class: 'mono pk-apq-who' }, st.taken ? esc(st.taken) : '');
      act.classList.add('pk-apq-act'); act.appendChild(take); act.appendChild(done); r.children[1].appendChild(who2);
      take.addEventListener('click', function () {
        var cur = Q[key] || {};
        if (cur.taken) { delete cur.taken; take.textContent = 'Взять'; take.removeAttribute('aria-pressed'); r.classList.remove('is-taken'); who2.textContent = ''; log('Автоматизация', 'Задача «' + title + '»', 'в работе', 'в очереди', null); toast('Задача возвращена в очередь.'); }
        else { cur.taken = whoShort(); take.textContent = 'В работе'; take.setAttribute('aria-pressed', 'true'); r.classList.add('is-taken'); who2.textContent = 'взял: ' + cur.taken; log('Автоматизация', 'Задача «' + title + '»', 'в очереди', 'взял ' + cur.taken, null); toast('Задача ваша: ' + title); }
        Q[key] = cur; LS.set('apq', Q);
      });
      done.addEventListener('click', function () {
        var prev = JSON.parse(JSON.stringify(Q));
        Q[key] = Object.assign({}, Q[key], { done: true, by: whoShort(), at: nowStr() }); LS.set('apq', Q);
        log('Автоматизация', 'Задача «' + title + '»', (prev[key] && prev[key].taken) ? 'в работе' : 'в очереди', 'решено', { k: 'ls', key: 'apq', prev: prev });
        var next = r.nextElementSibling || r.previousElementSibling;
        r.classList.add('is-leaving');
        setTimeout(function () { r.remove(); count(); var f = next && $('button', next); if (f) f.focus(); else h.focus && h.setAttribute('tabindex', '-1'); }, 260);
        toast('Решено: ' + title);
      });
    });
    count();
    // пауза автопилота (не более 4 часов — защитное ограничение)
    var pause = findBtn($(M), /^Пауза на 1 час$|^Снять паузу$/)[0], badge = $$(M + ' .tag').filter(function (t) { return /Автопилот (включён|на паузе)/.test(txt(t)); })[0];
    function paintPause() {
      var until = LS.get('apPause', 0);
      if (until > Date.now()) { pause.textContent = 'Снять паузу'; setTag(badge, 'tag-outline', 'Автопилот на паузе до ' + hm(new Date(until))); }
      else { pause.textContent = 'Пауза на 1 час'; setTag(badge, 'tag-accent', 'Автопилот включён · 41 сценарий'); }
    }
    if (pause) { on(pause, function () {
      var until = LS.get('apPause', 0);
      if (until > Date.now()) { LS.set('apPause', 0); log('Автоматизация', 'Автопилот', 'пауза', 'включён', null); toast('Автопилот снова работает.'); }
      else { LS.set('apPause', Date.now() + 3600e3); log('Автоматизация', 'Автопилот', 'включён', 'пауза 1 ч', null); toast('Автопилот на паузе 1 час. Максимум — 4 часа, дальше включится сам.'); }
      paintPause();
    }); paintPause(); }
    // правила эскалации: добавить
    var esc2 = blockByTitle(/^Правила эскалации$/);
    if (esc2) {
      var tbody = $('tbody', esc2);
      function addRuleRow(r) {
        var tr = el('tr', { class: 'pk-adm-added' }, '<td>' + esc(r.sign) + '</td><td><input class="input mono" value="' + esc(r.threshold) + '" aria-label="Порог: ' + esc(r.sign) + '" data-adm-skip="1"></td><td>' + esc(r.to) + '</td><td class="mono">' + esc(r.sla) + '</td><td class="mono">0</td><td><label class="radio"><input type="checkbox" checked data-adm-skip="1" aria-label="Правило включено"><span class="dot"></span></label></td>');
        tbody.appendChild(tr);
        $('input[type=checkbox]', tr).addEventListener('change', function (e) { var list = LS.get('escRules', []); list.forEach(function (x) { if (x.id === r.id) x.on = e.target.checked; }); LS.set('escRules', list); log('Автоматизация', 'Правило эскалации «' + r.sign + '»', e.target.checked ? 'выкл' : 'вкл', e.target.checked ? 'вкл' : 'выкл', null); });
        $('input.input', tr).addEventListener('change', function (e) { var list = LS.get('escRules', []), old = r.threshold; list.forEach(function (x) { if (x.id === r.id) x.threshold = e.target.value; }); r.threshold = e.target.value; LS.set('escRules', list); log('Автоматизация', 'Порог «' + r.sign + '»', old, e.target.value, null); });
        if (r.on === false) $('input[type=checkbox]', tr).checked = false;
      }
      LS.get('escRules', []).forEach(addRuleRow);
      on(findBtn(esc2, /^Добавить правило$/)[0], function () {
        modal({ title: 'Новое правило эскалации', html: field('Признак', input('sign', '', 'maxlength="60" placeholder="Например: срочная доставка"')) + field('Порог', input('threshold', '', 'maxlength="40" placeholder="Например: срок < 24 ч"')) + '<div class="pk-adm-row2">' + field('Кому', select('to', ['оператор', 'инженер', 'закупщик', 'бухгалтер'], 'оператор')) + field('Срок реакции', select('sla', ['15 минут', '30 минут', '1 час', '2 часа', '4 часа'], '1 час')) + '</div>',
          buttons: [{ label: 'Отмена' }, { label: 'Добавить', primary: true, onClick: function (box) {
            var s = val(box, 'sign'), t = val(box, 'threshold');
            if (s.length < 3) return 'Укажите признак.'; if (!t) return 'Укажите порог срабатывания.';
            var list = LS.get('escRules', []), r = { id: Date.now().toString(36), sign: s, threshold: t, to: val(box, 'to'), sla: val(box, 'sla'), on: true };
            list.push(r); LS.set('escRules', list); addRuleRow(r);
            log('Автоматизация', 'Правило эскалации «' + s + '»', '—', t + ' → ' + r.to, { k: 'ls', key: 'escRules', prev: list.slice(0, -1) });
            toast('Правило добавлено.');
          } }] });
      });
    }
    // обучение на исправлениях
    var learn = blockByTitle(/^Обучение на исправлениях$/), L = LS.get('learn', {});
    if (learn) findBtn(learn, /^Принять правило$/).forEach(function (acc) {
      var row = acc.closest('div').parentElement, rule = txt(row.children[1]), key = hash(rule), rej = findBtn(acc.parentElement, /^Отклонить$/)[0];
      own(acc); own(rej);
      var status = el('span', { class: 'tag tag-neutral pk-learn-st', hidden: '' });
      acc.parentElement.appendChild(status);
      var undoB = btn('Вернуть', 'btn-secondary'); undoB.hidden = true; acc.parentElement.appendChild(undoB);
      function paint() { var s = L[key]; acc.hidden = rej.hidden = !!s; status.hidden = undoB.hidden = !s; if (s) setTag(status, s === 'accepted' ? 'tag-accent' : 'tag-neutral', s === 'accepted' ? 'Правило действует' : 'Отклонено'); row.classList.toggle('is-resolved', !!s); }
      function set(s) {
        var prev = L[key]; if (s) L[key] = s; else delete L[key]; LS.set('learn', L); paint();
        log('Автоматизация', 'Правило из исправлений: «' + rule + '»', prev ? (prev === 'accepted' ? 'принято' : 'отклонено') : 'предложено', s ? (s === 'accepted' ? 'принято' : 'отклонено') : 'предложено', null);
        toast(s === 'accepted' ? 'Правило принято: подбор будет учитывать его сразу.' : s ? 'Правило отклонено.' : 'Решение отменено.');
        (s ? undoB : acc).focus();
      }
      acc.addEventListener('click', function () { set('accepted'); }); rej.addEventListener('click', function () { set('rejected'); }); undoB.addEventListener('click', function () { set(null); });
      paint();
    });
  }

  // ═════════ права и роли ═════════
  function initRoles() {
    var table = $$(M + ' table').filter(function (t) { return t.tHead && /Админ/.test(txt(t.tHead)) && /Оператор/.test(txt(t.tHead)) && /Инженер/.test(txt(t.tHead)); })[0];
    if (!table) return;
    var roles = $$('th', table.tHead).slice(1).map(txt);
    var CYCLE = ['да', 'огр.', '—'];
    var saved = LS.get('roles', null), orig = {}, cur = {};
    var chk = function (re) { var l = $$(M + ' label.radio').filter(function (x) { return re.test(txt(x)); })[0]; return l ? $('input', l).checked : true; };
    $$('tbody tr', table).forEach(function (tr, ri) {
      var right = txt(tr.cells[0].firstChild) || txt(tr.cells[0]);
      for (var ci = 1; ci < tr.cells.length; ci++) (function (td, ci) {
        var k = ri + ':' + ci, raw = txt(td);
        var v = raw === 'да' ? 'да' : raw === '—' ? '—' : 'огр.';
        orig[k] = v; cur[k] = saved && saved[k] ? saved[k] : v;
        var b = el('button', { type: 'button', class: 'pk-perm', 'data-k': k });
        b.setAttribute('aria-label', right + ' — ' + roles[ci - 1]);
        td.textContent = ''; td.appendChild(b); td.classList.add('pk-perm-td');
        if (ci === 1) { b.disabled = true; b.title = 'У админа полный доступ; рамки задаются защитными ограничениями'; }
        b.addEventListener('click', function () {
          var next = CYCLE[(CYCLE.indexOf(cur[k]) + 1) % 3];
          var role = roles[ci - 1];
          // защитные ограничения
          if (/маржу/.test(right) && /Инженер|Контент/.test(role) && next !== '—' && chk(/Маржа скрыта/)) next = '—', toast('Ограничение: маржа скрыта от инженеров и контента. Снимите галочку в «Защитных ограничениях», если это действительно нужно.');
          else if (/Выгрузка базы/.test(right) && next !== '—' && chk(/Выгрузка базы клиентов только у админа/)) next = '—', toast('Ограничение: выгрузка базы клиентов — только у админа, с уведомлением владельцу.');
          else if (/базовую наценку/.test(right) && next === 'да') next = '—', toast('Ограничение: наценка за раз не более ±5% — для этой роли доступен только режим «огр.» (±5%).');
          if (next === cur[k]) return;
          cur[k] = next; paint(b); dirty();
        });
        paint(b);
      })(tr.cells[ci], ci);
    });
    function paint(b) {
      var k = b.getAttribute('data-k'), v = cur[k];
      b.textContent = v === 'огр.' && /наценку/.test(b.getAttribute('aria-label')) ? '±5%' : v;
      b.className = 'pk-perm is-' + (v === 'да' ? 'yes' : v === '—' ? 'no' : 'lim') + (saved && (saved[k] || orig[k]) !== v || (!saved && orig[k] !== v) ? ' is-changed' : '');
      b.setAttribute('aria-label', b.getAttribute('aria-label').replace(/: .*$/, '') + ': ' + (v === 'да' ? 'разрешено' : v === '—' ? 'запрещено' : 'с ограничением'));
    }
    function base() { return saved || orig; }
    function changes() { return Object.keys(cur).filter(function (k) { return cur[k] !== base()[k]; }); }
    var barEl = el('div', { class: 'pk-adm-savebar', role: 'region', 'aria-label': 'Несохранённые изменения прав', hidden: '' }, '<span data-n></span>');
    var cancel = btn('Отменить'), save = btn('Сохранить', 'btn-primary');
    barEl.appendChild(cancel); barEl.appendChild(save);
    table.closest('.blueprint').appendChild(barEl);
    function dirty() { var n = changes().length; barEl.hidden = !n; $('[data-n]', barEl).textContent = 'Изменений прав: ' + n + ' · вступят в силу после двух подписей'; $$('.pk-perm', table).forEach(paint); }
    cancel.addEventListener('click', function () { Object.keys(cur).forEach(function (k) { cur[k] = base()[k]; }); dirty(); toast('Изменения отменены.'); });
    save.addEventListener('click', function () {
      var ch = changes();
      var rows = $$('tbody tr', table);
      var summary = '<ul class="pk-adm-items">' + ch.map(function (k) { var p = k.split(':'); return '<li>' + esc(txt(rows[+p[0]].cells[0].firstChild) || '') + ' · ' + esc(roles[+p[1] - 1]) + ': <span class="mono">' + esc(base()[k]) + ' → ' + esc(cur[k]) + '</span></li>'; }).join('') + '</ul>';
      twoSign('Сохранить права', summary, function (second) {
        var prev = JSON.parse(JSON.stringify(base()));
        ch.forEach(function (k) { var p = k.split(':'); log('Права', (txt(rows[+p[0]].cells[0].firstChild) || 'право') + ' · ' + roles[+p[1] - 1], base()[k], cur[k] + ' (подписи: ' + whoShort() + ', ' + second.split(' · ')[0] + ')', { k: 'ls', key: 'roles', prev: saved ? prev : null }); });
        saved = JSON.parse(JSON.stringify(cur)); LS.set('roles', saved); dirty();
        toast('Права сохранены: ' + ch.length + ' изм., две подписи получены.');
      });
    });
    dirty();
    // защитные ограничения полей
    VALIDATORS.push(function (c, label, v) {
      if (/Наценка за раз не более/.test(label)) { var n = parseFloat(String(v).replace(',', '.').replace(/[^\d.]/g, '')); if (!(n > 0) || n > 5) return 'Защитное ограничение: наценка за раз не более ±5%. Больше — только через две подписи в правилах наценки.'; }
      if (/Отключение автопилота/.test(label)) { var h = parseFloat(String(v).replace(/[^\d.]/g, '')); if (!(h > 0) || h > 4) return 'Отключение автопилота — не более 4 часов.'; }
      if (/Компенсация без согласования/.test(label)) { var r = parseMoney(v); if (!(r > 0) || r > 30000) return 'Компенсация без согласования — не более 30 000 ₽.'; }
      if (/Маржа скрыта|Выгрузка базы клиентов только|Каждое изменение — в журнал/.test(label) && v === false) { if (!window.confirm('Снять защитное ограничение «' + label + '»? Действие попадёт в журнал с вашим именем.')) return 'Ограничение оставлено.'; }
      return '';
    });
    // сотрудники
    var staffT = $$(M + ' table').filter(function (t) { return t.tHead && /Сотрудник/.test(txt(t.tHead)); })[0];
    if (staffT) {
      var tb = $('tbody', staffT);
      function wireRow(tr) {
        var b = findBtn(tr, /^Права$/)[0]; if (!b) return;
        var name = txt(tr.cells[0].firstChild), role = txt(tr.cells[1]); b.setAttribute('aria-label', 'Права: ' + name);
        on(b, function () {
          var ci = roles.indexOf(role) + 1;
          var list = $$('tbody tr', table).map(function (r, ri) { var v = cur[ri + ':' + ci] || '—'; return '<li class="' + (v === '—' ? 'pk-adm-muted' : '') + '">' + esc(txt(r.cells[0].firstChild)) + ': <b>' + esc(v) + '</b></li>'; }).join('');
          modal({ title: name + ' · ' + role, html: '<p class="pk-adm-muted">Права задаются ролью. Чтобы изменить — правьте столбец «' + esc(role) + '» в матрице.</p><ul class="pk-adm-items">' + list + '</ul>' + field('Сменить роль', select('role', roles, role)),
            buttons: [{ label: 'Закрыть' }, { label: 'Применить роль', primary: true, onClick: function (box) {
              var nr = val(box, 'role'); if (nr === role) return;
              if (nr === 'Админ') return 'Назначение админа — только владельцем сервиса.';
              tr.cells[1].innerHTML = '<span class="tag ' + (nr === 'Оператор' ? 'tag-accent' : nr === 'Инженер' ? 'tag-outline' : 'tag-neutral') + '">' + esc(nr) + '</span>';
              var ov = LS.get('staffRoles', {}); ov[name] = nr; LS.set('staffRoles', ov);
              log('Права', 'Роль сотрудника ' + name, role, nr, null); role = nr; toast('Роль изменена: ' + name + ' — ' + nr + '.');
            } }] });
        });
        var ov = LS.get('staffRoles', {}); if (ov[name]) { role = ov[name]; tr.cells[1].innerHTML = '<span class="tag ' + (role === 'Оператор' ? 'tag-accent' : role === 'Инженер' ? 'tag-outline' : 'tag-neutral') + '">' + esc(role) + '</span>'; }
      }
      function staffRow(s) { var tr = el('tr', { class: 'pk-adm-added' }, '<td>' + esc(s.name) + '<div class="mono">' + esc(s.mail) + '</div></td><td><span class="tag tag-neutral">' + esc(s.role) + '</span></td><td>' + esc(s.dirs) + '</td><td class="mono">приглашение отправлено</td><td><button class="btn btn-secondary" type="button">Права</button></td>'); tb.appendChild(tr); wireRow(tr); }
      LS.get('staff', []).forEach(staffRow);
      $$('tr', tb).forEach(wireRow);
      on(findBtn($(M), /^Добавить сотрудника$/)[0], function () {
        modal({ title: 'Добавить сотрудника', html: field('Фамилия и имя', input('name', '', 'maxlength="60" autocomplete="off"')) + field('Рабочая почта', input('mail', '', 'type="email" maxlength="80" placeholder="name@promkontur.ru"')) + '<div class="pk-adm-row2">' + field('Роль', select('role', roles.slice(1), 'Оператор')) + field('Направления', input('dirs', 'все 45', 'maxlength="60"')) + '</div>',
          buttons: [{ label: 'Отмена' }, { label: 'Пригласить', primary: true, onClick: function (box) {
            var s = { name: val(box, 'name'), mail: val(box, 'mail'), role: val(box, 'role'), dirs: val(box, 'dirs') || 'все 45' };
            if (!/^[А-ЯЁA-Z][а-яёa-z-]+\s+[А-ЯЁA-Z]/.test(s.name)) return 'Укажите фамилию и имя с заглавных букв.';
            if (!/^[^@\s]+@promkontur\.ru$/i.test(s.mail)) return 'Нужна рабочая почта в домене promkontur.ru.';
            var list = LS.get('staff', []); if (list.concat([]).some(function (x) { return x.mail.toLowerCase() === s.mail.toLowerCase(); }) || /\b(petrov|smirnova|kovalev|gavrilov|ivanov|nikitina)@/i.test(s.mail)) return 'Сотрудник с такой почтой уже есть.';
            list.push(s); LS.set('staff', list); staffRow(s);
            log('Права', 'Сотрудник ' + s.name, '—', s.role + ', ' + s.dirs, { k: 'ls', key: 'staff', prev: list.slice(0, -1) });
            toast('Приглашение отправлено (демо): ' + s.mail);
          } }] });
      });
    }
  }

  // ═════════ админка ═════════
  var ADMIN_SECTIONS = [
    [/Журнал изменений|Деньги по направлениям|Воронка закупки/, 'overview'],
    [/^Наценка$|Порог «цена по запросу»|Правила наценки по категориям/, 'prices'],
    [/Источники по направлениям|Подключение источника|Импорт из Китая|Источники и синхронизация|Правила выбора поставщика|Расписание и уведомления/, 'sources'],
    [/Автоматизация и умный чат/, 'automation'],
    [/Интеграции|Каналы связи/, 'channels'],
    [/Контент-машина|Техническое SEO|Карта запросов|Статья на каждый товар/, 'content']
  ];
  var TAB_KEYS = ['all', 'overview', 'prices', 'sources', 'automation', 'channels', 'content'];
  var SEC_LABEL = { overview: 'Обзор', prices: 'Цены', sources: 'Источники', automation: 'Автоматизация', channels: 'Каналы', content: 'Контент' };
  function adminSection(node) { var b = node.closest('[data-adm-sec]'); return b ? SEC_LABEL[b.getAttribute('data-adm-sec')] || 'Админка' : (SECTION_BY_PAGE[PATH] || 'Админка'); }
  function classifyAdmin() {
    var tabs = $('[data-admin-tabs]'); if (!tabs) return null;
    var host = tabs.parentElement, last = 'overview';
    Array.prototype.slice.call(host.children).forEach(function (ch) {
      if (ch === tabs || ch.contains(tabs)) return;
      if (ch.previousElementSibling === null || ch.compareDocumentPosition(tabs) & 4) return; // до вкладок — шапка
      var hs = $$('h3', ch).map(txt), sec = null;
      if (ch.id === 'prices' || /подключённых источников/.test(txt(ch)) && !hs.length) sec = 'overview';
      for (var i = 0; i < ADMIN_SECTIONS.length && !sec; i++) if (hs.some(function (h) { return ADMIN_SECTIONS[i][0].test(h); })) sec = ADMIN_SECTIONS[i][1];
      if (/Отзывы: модерация/.test(txt(ch))) sec = 'content';
      sec = sec || last; last = sec;
      ch.setAttribute('data-adm-sec', sec);
    });
    return tabs;
  }
  function initAdmin() {
    var tabs = classifyAdmin();
    if (tabs) {
      tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Разделы админки');
      var btns = $$('button', tabs).map(function (b, i) { var nb = b.cloneNode(true); b.parentNode.replaceChild(nb, b); nb.removeAttribute('data-demo'); nb.setAttribute('type', 'button'); nb.setAttribute('role', 'tab'); nb.setAttribute('data-tab', TAB_KEYS[i] || 'all'); return nb; });
      var select2 = function (key, focus) {
        btns.forEach(function (b) { var is = b.getAttribute('data-tab') === key; b.setAttribute('aria-selected', String(is)); b.tabIndex = is ? 0 : -1; b.classList.toggle('is-active', is); if (is && focus) b.focus(); });
        $$('[data-adm-sec]').forEach(function (s) { s.hidden = key !== 'all' && s.getAttribute('data-adm-sec') !== key; });
        LS.set('adminTab', key);
        if (history.replaceState) history.replaceState(null, '', key === 'all' ? location.pathname : '#' + key);
      };
      btns.forEach(function (b, i) {
        b.addEventListener('click', function () { select2(b.getAttribute('data-tab')); live('Раздел: ' + txt(b)); });
        b.addEventListener('keydown', function (e) { var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!d) return; e.preventDefault(); var nb = btns[(i + d + btns.length) % btns.length]; select2(nb.getAttribute('data-tab'), true); });
      });
      var hk = location.hash.slice(1), anchor = { log: 'overview', funnel: 'overview', integrations: 'channels', channels: 'channels', autom: 'automation' }[hk];
      select2(TAB_KEYS.indexOf(hk) >= 0 ? hk : anchor || (hk && document.getElementById(hk) ? (document.getElementById(hk).closest('[data-adm-sec]') || {}).getAttribute && document.getElementById(hk).closest('[data-adm-sec]').getAttribute('data-adm-sec') : null) || LS.get('adminTab', 'all'));
    }
    adminJournal(); markupRules(); feeds(); reviews(); integrations(); adminButtons();
  }

  function adminJournal() {
    var b = blockByTitle(/^Журнал изменений$/); if (!b) return;
    var tbody = $('tbody', b), sel = $('select', b);
    sel.setAttribute('data-adm-skip', '1'); sel.setAttribute('aria-label', 'Фильтр журнала по разделу');
    ['CRM', 'Права', 'Каналы', 'Контент', 'Автоматизация', 'Логистика'].forEach(function (s) { if (!$$('option', sel).some(function (o) { return o.text === s; })) sel.appendChild(el('option', { text: s })); });
    var more = el('a', { class: 'btn btn-secondary', href: BASE + 'panel/zhurnal/' }, 'Весь журнал'); sel.parentElement.appendChild(more);
    function render() {
      tbody.innerHTML = '';
      var f = sel.selectedIndex > 0 ? sel.value : '';
      var rows = allJournal().filter(function (r) { return !f || r.section === f || (f === 'Цены' && r.section === 'Цены'); }).slice(0, 12);
      if (!rows.length) tbody.appendChild(el('tr', {}, '<td colspan="6" class="pk-adm-muted">В этом разделе изменений нет.</td>'));
      rows.forEach(function (r) { tbody.appendChild(journalRow(r, function (rec) { rollback(rec); applyAll(); render(); })); });
    }
    sel.addEventListener('change', render);
    document.addEventListener('pk:adm:log', render);
    on(findBtn(b, /^Выгрузить журнал$/)[0], function () { csv('zhurnal-izmenenij.csv', [['Когда', 'Раздел', 'Что изменено', 'Было', 'Стало', 'Кто']].concat(allJournal().map(function (r) { return [r.when, r.section, r.what, r.from, r.to, r.who]; }))); });
    render();
  }
  // после отката перечитать сохранённые значения на странице
  function applyAll() {
    ST = LS.get('st', {});
    $$('[data-adm-key]').forEach(function (c) { var v = stGet(c.getAttribute('data-adm-key')); if (v === undefined) return; if (c.type === 'checkbox' || c.type === 'radio') c.checked = !!v; else c.value = v; c._admPrev = valueOf(c); });
    if (window._pkRulesRender) window._pkRulesRender();
  }

  // правила наценки: CRUD и порядок
  function markupRules() {
    var b = blockByTitle(/^Правила наценки по категориям$/); if (!b) return;
    var table = $('table', b), tbody = $('tbody', table);
    table.tHead.rows[0].appendChild(el('th', {}, '<span class="pk-vh">Действия</span>'));
    var initial = $$('tr', tbody).map(function (tr) { return { cat: txt(tr.cells[0]), range: txt(tr.cells[1]), markup: txt(tr.cells[2]), round: txt(tr.cells[3]), status: txt(tr.cells[4]) }; });
    function rules() { return JSON.parse(JSON.stringify(LS.get('rules', initial))); }
    var statusCls = { 'Активно': 'tag-accent', 'Только КП': 'tag-outline', 'Черновик': 'tag-neutral', 'Выключено': 'tag-neutral' };
    function render(focusSel) {
      var list = rules(); tbody.innerHTML = '';
      list.forEach(function (r, i) {
        var isBase = /базовое/.test(r.cat);
        var tr = el('tr', {}, '<td>' + esc(r.cat) + '</td><td class="mono">' + esc(r.range) + '</td><td class="mono">' + esc(r.markup) + '</td><td>' + esc(r.round) + '</td><td><span class="tag ' + (statusCls[r.status] || 'tag-neutral') + '">' + esc(r.status) + '</span></td><td class="pk-adm-rowact"></td>');
        var act = tr.lastChild;
        var up = btn('↑', 'btn-secondary pk-adm-icon'), dn = btn('↓', 'btn-secondary pk-adm-icon'), ed = btn('Изменить'), del = btn('Удалить');
        up.setAttribute('aria-label', 'Выше: ' + r.cat + ' ' + r.range); dn.setAttribute('aria-label', 'Ниже: ' + r.cat + ' ' + r.range); ed.setAttribute('aria-label', 'Изменить: ' + r.cat + ' ' + r.range); del.setAttribute('aria-label', 'Удалить: ' + r.cat + ' ' + r.range);
        up.disabled = i === 0 || isBase; dn.disabled = isBase || i >= list.length - 2; del.disabled = isBase;
        if (isBase) { del.title = 'Базовое правило всегда последнее и не удаляется'; }
        up.setAttribute('data-f', 'up' + i); dn.setAttribute('data-f', 'dn' + i); ed.setAttribute('data-f', 'ed' + i);
        up.addEventListener('click', function () { reorder(i, -1); }); dn.addEventListener('click', function () { reorder(i, 1); });
        ed.addEventListener('click', function () { edit(i); }); del.addEventListener('click', function () { remove(i); });
        [up, dn, ed, del].forEach(function (x) { act.appendChild(x); });
        tbody.appendChild(tr);
      });
      if (focusSel) { var f = $('[data-f="' + focusSel + '"]', tbody); if (f && !f.disabled) f.focus(); else { var ff = $('button:not([disabled])', tbody); if (ff) ff.focus(); } }
    }
    window._pkRulesRender = function () { render(); };
    function commit(list, what, from, to) { var prev = rules(); LS.set('rules', list); log('Цены', what, from, to, { k: 'ls', key: 'rules', prev: prev }); }
    function reorder(i, d) {
      var list = rules(), j = i + d; if (j < 0 || j >= list.length || /базовое/.test(list[j].cat)) return;
      var r = list.splice(i, 1)[0]; list.splice(j, 0, r);
      commit(list, 'Порядок правил: «' + r.cat + ', ' + r.range + '»', 'позиция ' + (i + 1), 'позиция ' + (j + 1));
      render((d < 0 ? 'up' : 'dn') + j); live('Правило «' + r.cat + '» теперь на позиции ' + (j + 1)); toast('Порядок изменён: первое подходящее правило выигрывает.');
    }
    function remove(i) {
      var list = rules(), r = list[i];
      modal({ title: 'Удалить правило?', html: '<p>' + esc(r.cat) + ' · ' + esc(r.range) + ' · <span class="mono">' + esc(r.markup) + '</span></p><p class="pk-adm-muted">Позиции перейдут под следующее подходящее правило. Откат — в журнале изменений.</p>',
        buttons: [{ label: 'Отмена' }, { label: 'Удалить', primary: true, onClick: function () { list.splice(i, 1); commit(list, 'Удалено правило «' + r.cat + ', ' + r.range + '»', r.markup, '—'); render('ed0'); toast('Правило удалено.'); } }] });
    }
    function parsePct(s) { var m = String(s).match(/[-+]?\d+(?:[.,]\d+)?/); return m ? parseFloat(m[0].replace(',', '.')) : null; }
    function parseRange(s) {
      s = String(s).replace(/[\s\u00a0]/g, '');
      var a = s.match(/^(\d+)[–-](\d+)₽?$/); if (a) return [+a[1], +a[2]];
      var f = s.match(/^от(\d+)/); if (f) return [+f[1], ''];
      var t = s.match(/^до(\d+)/); if (t) return ['', +t[1]];
      return ['', ''];
    }
    function fmtRange(from, to) { var n = function (x) { return String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }; return from !== '' && to !== '' ? n(from) + ' – ' + n(to) + ' ₽' : from !== '' ? 'от ' + n(from) + ' ₽' : to !== '' ? 'до ' + n(to) + ' ₽' : 'любая'; }
    function edit(i) {
      var list = rules(), r = i == null ? { cat: '', range: 'любая', markup: '+20%', round: 'до 100 ₽', status: 'Черновик' } : list[i];
      var isBase = /базовое/.test(r.cat), rg = parseRange(r.range), kp = /КП/.test(r.markup);
      var cats = ['Подшипники', 'Насосы', 'Компрессоры', 'Частотные преобразователи', 'Электродвигатели', 'Редукторы', 'Арматура', 'Пневматика', 'Запчасти и РТИ'];
      modal({ title: i == null ? 'Новое правило наценки' : 'Изменить правило',
        html: (isBase ? '<p class="pk-adm-muted">Базовое правило: категорию и диапазон не меняют.</p>' : field('Категория', '<input class="input" name="cat" list="pk-cats" maxlength="50" value="' + esc(r.cat) + '"><datalist id="pk-cats">' + cats.map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist>') +
          '<div class="pk-adm-row2">' + field('Цена от, ₽', input('from', rg[0], 'inputmode="numeric" placeholder="не ограничено"')) + field('Цена до, ₽', input('to', rg[1], 'inputmode="numeric" placeholder="не ограничено"')) + '</div>') +
          '<div class="pk-adm-row2">' + field('Наценка, %', input('markup', kp ? '' : parsePct(r.markup), 'inputmode="decimal"' + (kp ? ' disabled' : '')), 'От 0 до 60%. Изменение больше чем на 5 п. п. — две подписи') + field('Округление', select('round', ['до 10 ₽', 'до 100 ₽', 'до 1 000 ₽', 'без округления', '—'], r.round)) + '</div>' +
          (isBase ? '' : '<label class="radio pk-adm-check"><input type="checkbox" name="kp"' + (kp ? ' checked' : '') + '><span class="dot"></span>Только КП — цена по запросу</label>') +
          field('Статус', select('status', ['Активно', 'Черновик', 'Только КП', 'Выключено'], r.status)),
        onOpen: function (box) { var k = box.querySelector('[name=kp]'), m = box.querySelector('[name=markup]'); if (k) k.addEventListener('change', function () { m.disabled = k.checked; if (k.checked) box.querySelector('[name=status]').value = 'Только КП'; }); },
        buttons: [{ label: 'Отмена' }, { label: i == null ? 'Добавить' : 'Сохранить', primary: true, onClick: function (box) {
          var cat = isBase ? r.cat : val(box, 'cat'), onlyKp = !isBase && val(box, 'kp');
          var from = isBase ? '' : val(box, 'from').replace(/\s/g, ''), to = isBase ? '' : val(box, 'to').replace(/\s/g, '');
          if (!isBase && cat.length < 3) return 'Укажите категорию.';
          if ((from && !/^\d+$/.test(from)) || (to && !/^\d+$/.test(to))) return 'Границы цены — целые числа в рублях.';
          if (from && to && +from >= +to) return '«Цена от» должна быть меньше «Цены до».';
          var pct = null;
          if (!onlyKp) { pct = parseFloat(val(box, 'markup').replace(',', '.')); if (isNaN(pct)) return 'Укажите наценку в процентах.'; if (pct < 0 || pct > 60) return 'Наценка — от 0 до 60%. Выше — только проектные КП.'; }
          var nr = { cat: cat, range: isBase ? r.range : fmtRange(from === '' ? '' : +from, to === '' ? '' : +to), markup: onlyKp ? 'по КП' : '+' + String(pct).replace('.', ',') + '%', round: onlyKp ? '—' : val(box, 'round'), status: onlyKp ? 'Только КП' : val(box, 'status') };
          var dup = list.some(function (x, j) { return j !== i && x.cat.toLowerCase() === nr.cat.toLowerCase() && x.range === nr.range; });
          if (dup) return 'Правило для этой категории и диапазона уже есть — измените его.';
          var old = parsePct(r.markup), apply = function (second) {
            var l2 = rules();
            if (i == null) { var baseIdx = l2.findIndex(function (x) { return /базовое/.test(x.cat); }); l2.splice(baseIdx < 0 ? l2.length : baseIdx, 0, nr); commit(l2, 'Новое правило «' + nr.cat + ', ' + nr.range + '»', '—', nr.markup + ' · ' + nr.status); render(); toast('Правило добавлено перед базовым. Проверьте порядок стрелками.'); }
            else { l2[i] = nr; commit(l2, 'Правило «' + nr.cat + ', ' + nr.range + '»' + (second ? ' (2-я подпись: ' + second.split(' · ')[0] + ')' : ''), r.markup + ' · ' + r.status, nr.markup + ' · ' + nr.status); render('ed' + i); toast('Правило сохранено.'); }
          };
          if (i != null && old != null && pct != null && Math.abs(pct - old) > 5) { setTimeout(function () { twoSign('Наценка изменяется больше чем на 5 п. п.', '<p>' + esc(nr.cat) + ': <span class="mono">' + esc(r.markup) + ' → ' + esc(nr.markup) + '</span></p>', apply); }, 0); return; }
          apply();
        } }] });
    }
    on(findBtn(b, /^Добавить правило$/)[0], function () { edit(null); });
    render();
    // базовая наценка: ±5% за раз и плитка «базовая наценка»
    VALIDATORS.push(function (c, label, v, prev) {
      if (/^Базовая наценка/.test(label)) { var n = parseFloat(String(v).replace(',', '.')), p = parseFloat(String(prev).replace(',', '.')); if (isNaN(n) || n < 0 || n > 60) return 'Базовая наценка — число от 0 до 60.'; if (!isNaN(p) && Math.abs(n - p) > 5) return 'Защитное ограничение: наценка за раз не более ±5% (было ' + p + '%). Меняйте шагами или через правило с двумя подписями.'; }
      if (/Порог КП/.test(label) && !(parseMoney(v) >= 50000)) return 'Порог КП — сумма в рублях, не меньше 50 000.';
      return '';
    });
    var tile = $$(M + ' .blueprint').filter(function (t) { return /базовая наценка/.test(txt(t)) && !$('h3', t); })[0];
    var paintTile = function () { var inp = $$(M + ' input').filter(function (x) { return /^Базовая наценка/.test(controlLabel(x)); })[0]; if (tile && inp) $('.mono', tile).textContent = inp.value.replace(/%$/, '') + '%'; };
    document.addEventListener('pk:adm:control', paintTile); setTimeout(paintTile, 0);
  }

  // синхронизация фидов
  function runSync(tag, timeCell, okLabel, btnEl, name, done) {
    var prev = txt(tag);
    setTag(tag, 'tag-neutral', 'Синхронизация…'); tag.setAttribute('aria-busy', 'true'); if (btnEl) btnEl.disabled = true;
    setTimeout(function () {
      tag.removeAttribute('aria-busy'); if (btnEl) btnEl.disabled = false;
      var t = nowStr(); setTag(tag, 'tag-accent', okLabel);
      if (timeCell) timeCell.textContent = t;
      var F = LS.get('feeds', {}); F[name] = { status: okLabel, time: t }; LS.set('feeds', F);
      log('Источники', 'Синхронизация «' + name + '»', prev, okLabel + ', ' + t, null);
      live(name + ': ' + okLabel); if (done) done(t);
    }, 900 + Math.random() * 900);
  }
  function feeds() {
    var F = LS.get('feeds', {});
    // «Источники и синхронизация» — поставщики
    var sb = blockByTitle(/^Источники и синхронизация$/);
    if (sb) {
      var tbody = $('tbody', sb);
      function wire(tr) {
        var name = txt(tr.cells[0].firstChild), tag = $('.tag', tr.cells[5]), time = tr.cells[3], b = findBtn(tr, /^Обновить$/)[0];
        if (F[name]) { setTag(tag, 'tag-accent', F[name].status); time.textContent = F[name].time; }
        if (b) { b.setAttribute('aria-label', 'Обновить фид: ' + name); on(b, function () { runSync(tag, time, 'Успешно', b, name, function () { toast('«' + name + '» синхронизирован.'); }); }); }
      }
      LS.get('newFeeds', []).forEach(function (f) { tbody.appendChild(el('tr', { class: 'pk-adm-added' }, '<td>' + esc(f.name) + '<div class="mono">' + esc(f.url) + '</div></td><td class="mono">' + esc(f.format) + '</td><td>' + esc(f.freq) + '</td><td>' + esc(f.time || '—') + '</td><td class="mono">—</td><td><span class="tag tag-accent">Успешно</span></td><td><button class="btn btn-secondary" type="button">Обновить</button></td>')); });
      $$('tr', tbody).forEach(wire);
      on(findBtn(sb, /^Синхронизировать все$/)[0], function (e, b) {
        var trs = $$('tr', tbody); b.disabled = true; toast('Синхронизация ' + trs.length + ' источников…');
        var n = 0; trs.forEach(function (tr, i) { setTimeout(function () { var bb = findBtn(tr, /^Обновить$/)[0]; if (bb && !bb.disabled) bb.click(); if (++n === trs.length) setTimeout(function () { b.disabled = false; toast('Все источники синхронизированы.'); }, 1900); }, i * 250); });
      });
      on(findBtn(sb, /^Подключить источник$/)[0], function () { goConnect(); });
    }
    // «Источники по направлениям»
    var db = blockByTitle(/^Источники по направлениям$/);
    if (db) {
      var sel = $('select', db); sel.setAttribute('data-adm-skip', '1'); sel.setAttribute('aria-label', 'Фильтр по кластеру');
      sel.addEventListener('change', function () { var v = sel.selectedIndex ? sel.value : ''; var n = 0; $$('tbody tr', db).forEach(function (tr) { var show2 = !v || txt($('.mono', tr.cells[0])) === v; tr.hidden = !show2; if (show2) n++; }); live('Направлений: ' + n); });
      $$('tbody tr', db).forEach(function (tr) {
        var name = txt(tr.cells[0].firstChild), tag = $('.tag', tr.cells[5]), b = $('button', tr.cells[6]); if (!b) return;
        var note = el('div', { class: 'mono pk-adm-muted' }); tr.cells[5].appendChild(note);
        var key = 'dir:' + name;
        if (F[key]) { setTag(tag, 'tag-accent', F[key].status); note.textContent = F[key].time; if (/Подключить|Настроить/.test(txt(b))) b.textContent = 'Обновить'; }
        b.setAttribute('aria-label', txt(b) + ': ' + name);
        on(b, function () {
          var label = txt(b);
          if (label === 'Обновить') { runSync(tag, note, 'Синхронизировано', b, key.replace('dir:', 'направление ')); return; }
          modal({ title: (label === 'Подключить' ? 'Подключить: ' : 'Настроить: ') + name,
            html: field('Способ обмена', select('way', ['XML / YML фид', 'REST API', 'Excel / CSV по FTP', 'Обмен с 1С', 'Парсер каталога сайта'], 'XML / YML фид')) + field('Частота', select('freq', ['каждые 2 ч', 'каждые 4 ч', 'раз в сутки', 'вручную'], txt(tr.cells[3]))) + field('Наценка на импорт, %', input('mk', '20', 'inputmode="numeric"')),
            buttons: [{ label: 'Отмена' }, { label: label === 'Подключить' ? 'Подключить и синхронизировать' : 'Сохранить и синхронизировать', primary: true, onClick: function (box) {
              var mk = +val(box, 'mk'); if (!(mk >= 0 && mk <= 60)) return 'Наценка на импорт — от 0 до 60%.';
              var oldF = txt(tr.cells[3]); tr.cells[3].textContent = val(box, 'freq'); tr.cells[4].textContent = '₽ / $ · +' + mk + '%';
              log('Источники', 'Направление «' + name + '»', oldF, val(box, 'freq') + ', ' + val(box, 'way'), null);
              b.textContent = 'Обновить'; setTimeout(function () { runSync(tag, note, 'Синхронизировано', b, key.replace('dir:', 'направление ')); }, 50);
            } }] });
        });
      });
      on(findBtn(db, /^Подключить источник$/)[0], function () { goConnect(); });
      on(findBtn(db, /^Синхронизировать направления$/)[0], function (e, b) {
        var bs = $$('tbody tr', db).filter(function (tr) { return !tr.hidden; }).map(function (tr) { return $('button', tr.cells[6]); }).filter(function (x) { return x && txt(x) === 'Обновить'; });
        toast('Синхронизация направлений: ' + bs.length); b.disabled = true;
        bs.forEach(function (x, i) { setTimeout(function () { x.click(); }, i * 180); }); setTimeout(function () { b.disabled = false; }, bs.length * 180 + 1900);
      });
    }
    // форма подключения
    var cf = blockByTitle(/^Подключение источника к направлению$/);
    function goConnect() { if (!cf) return; var tabAll = $('[data-tab="sources"]'); if (tabAll && cf.closest('[hidden]')) tabAll.click(); cf.scrollIntoView({ behavior: 'smooth', block: 'center' }); var i = $('input', cf); if (i) setTimeout(function () { i.focus(); }, 400); }
    if (cf) {
      $$('input, select', cf).forEach(function (x) { x.setAttribute('data-adm-skip', '1'); });
      var urlI = $$('input', cf).filter(function (x) { return x.placeholder === 'https://'; })[0], keyI = $$('input', cf).filter(function (x) { return x.placeholder === 'API key'; })[0];
      if (keyI) { keyI.type = 'password'; keyI.autocomplete = 'off'; }
      var sels = $$('select', cf);
      var check = function () { var u = urlI.value.trim(); if (!/^https?:\/\/[^\s.]+\.[^\s]{2,}$/i.test(u) && !/^ftp:\/\//i.test(u)) { toast('Укажите адрес источника: https://… или ftp://…'); urlI.setAttribute('aria-invalid', 'true'); urlI.focus(); return null; } urlI.removeAttribute('aria-invalid'); return u; };
      on(findBtn(cf, /^Проверить и подключить$/)[0], function (e, b) {
        var u = check(); if (!u) return;
        b.disabled = true; b.textContent = 'Проверяем…';
        setTimeout(function () {
          b.disabled = false; b.textContent = 'Проверить и подключить';
          var host = u.replace(/^\w+:\/\//, '').split('/')[0];
          var f = { name: host.replace(/^www\./, '').split('.')[0].replace(/^./, function (c) { return c.toUpperCase(); }), url: u.replace(/^https?:\/\//, ''), format: sels[2].value.split(' ')[0], freq: sels[3].value.replace('каждые ', 'каждые ').replace(' часа', ' ч').replace(' часов', ' ч'), time: nowStr() };
          var list = LS.get('newFeeds', []); list.push(f); LS.set('newFeeds', list);
          log('Источники', 'Подключён источник «' + f.name + '» → ' + sels[0].value, '—', f.format + ', ' + f.freq, { k: 'ls', key: 'newFeeds', prev: list.slice(0, -1) });
          if (keyI) keyI.value = ''; urlI.value = '';
          toast('Источник «' + f.name + '» подключён (демо) и добавлен в «Источники и синхронизация».');
          if (sb) { var tr = el('tr', { class: 'pk-adm-added' }, '<td>' + esc(f.name) + '<div class="mono">' + esc(f.url) + '</div></td><td class="mono">' + esc(f.format) + '</td><td>' + esc(f.freq) + '</td><td>' + esc(f.time) + '</td><td class="mono">—</td><td><span class="tag tag-accent">Успешно</span></td><td><button class="btn btn-secondary" type="button">Обновить</button></td>'); $('tbody', sb).appendChild(tr); var bb = $('button', tr); on(bb, function () { runSync($('.tag', tr), tr.cells[3], 'Успешно', bb, f.name); }); }
        }, 1100);
      });
      on(findBtn(cf, /^Тестовая выгрузка$/)[0], function (e, b) { if (!check()) return; b.disabled = true; setTimeout(function () { b.disabled = false; toast('Тестовая выгрузка (демо): 1 240 строк, 1 236 распознано, 4 без цены — строки 14, 88, 302, 911.'); }, 1000); });
      on(findBtn(cf, /^Сопоставить категории$/)[0], function () {
        modal({ title: 'Сопоставление категорий', html: '<p class="pk-adm-muted">Категории прайса источника → направления каталога. Демо-выборка.</p><div class="pk-adm-scroll"><table class="table"><thead><tr><th>Категория в прайсе</th><th>Направление</th></tr></thead><tbody>' + [['Двигатели АИР', 'Электродвигатели'], ['Насосы консольные', 'Насосы'], ['Подшипники шариковые', 'Подшипники и комплектующие'], ['Пневмоцилиндры', 'Пневматика']].map(function (r, i) { return '<tr><td>' + esc(r[0]) + '</td><td>' + select('m' + i, ['Электродвигатели', 'Насосы', 'Подшипники и комплектующие', 'Пневматика', 'не публиковать'], r[1]) + '</td></tr>'; }).join('') + '</tbody></table></div>',
          buttons: [{ label: 'Отмена' }, { label: 'Сохранить сопоставление', primary: true, onClick: function (box) { var n = $$('select', box).filter(function (s) { return s.value === 'не публиковать'; }).length; log('Источники', 'Сопоставление категорий источника', '—', '4 категории, скрыто ' + n, null); toast('Сопоставление сохранено.'); } }] });
      });
    }
  }

  // модерация отзывов
  function reviews() {
    var head = $$(M + ' .mono').filter(function (m) { return /^Отзывы: модерация/.test(txt(m)); })[0]; if (!head) return;
    var box = head.nextElementSibling, table = $('table', box); if (!table) return;
    var R = LS.get('reviews', {});
    var onlyBought = function () { var l = $$('label.radio', box).filter(function (x) { return /Только подтверждённые покупки/.test(txt(x)); })[0]; return l ? $('input', l).checked : true; };
    var modInput = $$('input', box).filter(function (x) { return /На модерации/.test(controlLabel(x)); })[0];
    var TEXTS = { 5: 'Всё совпало по рабочей точке, отгрузили за два дня, документы пришли по ЭДО.', 4: 'Работает, но пришлось отдельно докупать комплект прокладок — стоит предлагать сразу.', 3: 'Сам мотор-редуктор в порядке, но паспорт пришёл позже груза.', 2: 'Подшипники шумят после месяца работы, прошу разобраться с партией.' };
    $$('tbody tr', table).forEach(function (tr) {
      tr.removeAttribute('data-href');
      var company = txt(tr.cells[0].firstChild), item = txt(tr.cells[1]), score = parseFloat(txt(tr.cells[2]).replace(',', '.')), tag = $('.tag', tr.cells[3]), bought = !/Покупки нет/.test(txt(tag));
      var key = hash(company + item), cell = tr.cells[4]; cell.innerHTML = ''; cell.classList.add('pk-adm-rowact');
      var read = btn('Читать'), pub = btn('Опубликовать'), rej = btn('Отклонить'), back = btn('Вернуть');
      [read, pub, rej, back].forEach(function (x) { x.setAttribute('aria-label', txt(x) + ': отзыв ' + company + ' на ' + item); cell.appendChild(x); });
      var orig = { cls: tag.className, label: txt(tag) };
      function paint() {
        var s = R[key];
        pub.hidden = rej.hidden = !!s; back.hidden = !s;
        if (s) setTag(tag, s === 'pub' ? 'tag-accent' : 'tag-neutral', s === 'pub' ? 'Опубликован' : 'Отклонён'); else { tag.className = orig.cls; tag.textContent = orig.label; }
        tr.classList.toggle('is-resolved', !!s);
        if (modInput) { var base = parseInt(modInput.defaultValue, 10) || 18; modInput.value = Math.max(0, base - Object.keys(R).length); }
      }
      function set(s) {
        if (s === 'pub' && !bought && onlyBought()) { toast('Нельзя опубликовать: покупка не подтверждена, включено «Только подтверждённые покупки».'); return; }
        var prev = R[key]; if (s) R[key] = s; else delete R[key]; LS.set('reviews', R); paint();
        log('Контент', 'Отзыв ' + company + ' · ' + item + ' (' + String(score).replace('.', ',') + ')', prev === 'pub' ? 'опубликован' : prev ? 'отклонён' : 'на модерации', s === 'pub' ? 'опубликован' : s ? 'отклонён' : 'на модерации', null);
        toast(s === 'pub' ? 'Отзыв опубликован — попадёт в рейтинг карточки.' : s ? 'Отзыв отклонён.' : 'Отзыв вернулся на модерацию.');
        (s ? back : pub).focus();
      }
      pub.addEventListener('click', function () { set('pub'); }); rej.addEventListener('click', function () { set('rej'); }); back.addEventListener('click', function () { set(null); });
      read.addEventListener('click', function () {
        modal({ title: 'Отзыв · ' + company, html: '<p class="mono">' + esc(item) + ' · оценка ' + esc(txt(tr.cells[2])) + ' · ' + esc(orig.label) + '</p><blockquote class="pk-adm-quote">' + esc(TEXTS[Math.round(score)] || TEXTS[4]) + '</blockquote>' + (score < 3 ? '<p class="pk-adm-muted">Низкая оценка — обращение уже ушло инженеру. Публикуется без правок.</p>' : ''),
          buttons: [{ label: 'Отклонить', onClick: function () { set('rej'); } }, { label: 'Опубликовать', primary: true, onClick: function () { set('pub'); } }] });
      });
      paint();
    });
  }

  // интеграции и каналы: тумблеры и «Настроить»
  function integrations() {
    var ib = blockByTitle(/^Интеграции: банк/);
    var I = LS.get('integr', {});
    function toggleRow(tr, tag, name, onLabel, offLabel, section) {
      var cell = tag.parentElement, lab = el('label', { class: 'pk-adm-switch' }, '<input type="checkbox" data-adm-skip="1"><span aria-hidden="true"></span><span class="pk-vh">' + esc(name) + '</span>');
      var cb = $('input', lab), initialOn = !/Отключ|Не подключ/.test(txt(tag)), origLabel = txt(tag), origCls = tag.className;
      cb.checked = I[name] === undefined ? initialOn : I[name];
      cell.insertBefore(lab, tag);
      function paint() { if (cb.checked) { if (I[name] === undefined || initialOn) { tag.className = origCls; tag.textContent = initialOn ? origLabel : onLabel; } else setTag(tag, 'tag-accent', onLabel); } else setTag(tag, 'tag-neutral', offLabel); tr.classList.toggle('is-off', !cb.checked); }
      cb.addEventListener('change', function () { var prev = I[name]; I[name] = cb.checked; LS.set('integr', I); paint(); log(section, name, cb.checked ? 'выкл' : 'вкл', cb.checked ? 'вкл' : 'выкл', null); toast(name + (cb.checked ? ' — включено.' : ' — отключено. Автоматика на этом шаге передаёт задачу человеку.')); });
      paint();
    }
    if (ib) {
      $$('tbody tr', ib).forEach(function (tr) { var tag = $('.tag', tr.cells[4]); if (tag) toggleRow(tr, tag, 'Интеграция «' + txt(tr.cells[0].firstChild) + '»', 'Работает', 'Отключено', 'Каналы'); });
      on(findBtn(ib, /^Добавить интеграцию$/)[0], function () {
        modal({ title: 'Добавить интеграцию', html: field('Система', select('sys', ['ЭДО · СБИС', 'Банк · второй расчётный счёт', 'CRM закупщика · Битрикс24', 'Перевозчик · Байкал Сервис', 'Маркетплейс · выгрузка остатков'], '')) + field('Событие', input('ev', '', 'maxlength="60" placeholder="Например: подписан УПД"')) + field('Что делает автоматика', input('act', '', 'maxlength="90"')),
          buttons: [{ label: 'Отмена' }, { label: 'Подключить', primary: true, onClick: function (box) {
            if (val(box, 'ev').length < 3 || val(box, 'act').length < 3) return 'Заполните событие и действие автоматики.';
            var tr = el('tr', { class: 'pk-adm-added' }, '<td>' + esc(val(box, 'sys')) + '<div class="mono">API · тест</div></td><td>' + esc(val(box, 'ev')) + '</td><td>' + esc(val(box, 'act')) + '</td><td class="mono">сразу</td><td><span class="tag tag-outline">Пилот</span></td>');
            $('tbody', ib).appendChild(tr); toggleRow(tr, $('.tag', tr), 'Интеграция «' + val(box, 'sys') + '»', 'Пилот', 'Отключено', 'Каналы');
            log('Каналы', 'Новая интеграция «' + val(box, 'sys') + '»', '—', 'пилот: ' + val(box, 'ev'), null); toast('Интеграция добавлена в режиме пилота (демо, до перезагрузки).');
          } }] });
      });
    }
    var cb2 = blockByTitle(/^Каналы связи и бот в MAX$/);
    if (cb2) {
      $$('table', cb2).filter(function (t) { return /Идентификатор/.test(txt(t.tHead)); }).forEach(function (t) {
        $$('tbody tr', t).forEach(function (tr) {
          var name = txt(tr.cells[0]), tag = $('.tag', tr.cells[5]), b = findBtn(tr, /^Настроить$/)[0];
          toggleRow(tr, tag, 'Канал «' + name + '»', 'Подключено', 'Отключено', 'Каналы');
          if (b) { b.setAttribute('aria-label', 'Настроить канал: ' + name); on(b, function () {
            var C = LS.get('chan', {}), cur = C[name] || {};
            modal({ title: 'Канал · ' + name, html: field('Идентификатор', input('id', cur.id || txt(tr.cells[1]), 'maxlength="60"')) + field('Автоответ', select('auto', ['робот отвечает сам', 'черновик для оператора', 'только человек'], cur.auto || 'робот отвечает сам')) + field('Тихие часы', select('quiet', ['22:00–08:00', '20:00–09:00', 'не соблюдать'], cur.quiet || '22:00–08:00')),
              buttons: [{ label: 'Отмена' }, { label: 'Сохранить', primary: true, onClick: function (box) {
                var id = val(box, 'id'); if (id.length < 3) return 'Идентификатор канала не короче 3 символов.';
                var prev = cur.auto || 'робот отвечает сам'; C[name] = { id: id, auto: val(box, 'auto'), quiet: val(box, 'quiet') }; LS.set('chan', C); tr.cells[1].textContent = id;
                log('Каналы', 'Настройки канала «' + name + '»', prev, C[name].auto + ', тихие часы ' + C[name].quiet, null); toast('Настройки канала сохранены.');
              } }] });
          }); var C0 = LS.get('chan', {}); if (C0[name]) tr.cells[1].textContent = C0[name].id; }
        });
      });
      on(findBtn(cb2, /^Проверить webhook$/)[0], function (e, b) { b.disabled = true; b.textContent = 'Проверяем…'; setTimeout(function () { b.disabled = false; b.textContent = 'Проверить webhook'; var ms = 120 + Math.round(Math.random() * 120); toast('Webhook MAX отвечает: 200 OK за ' + ms + ' мс (демо, ' + hm() + ').'); log('Каналы', 'Проверка webhook MAX', '—', '200 OK, ' + ms + ' мс', null); }, 1000); });
      on(findBtn(cb2, /^Подключить канал$/)[0], function () {
        modal({ title: 'Подключить канал', html: field('Канал', select('ch', ['Telegram-бот', 'WhatsApp Business', 'Второй номер телефонии', 'Почта отдела продаж'], '')) + field('Токен или адрес', input('tok', '', 'type="password" autocomplete="off" placeholder="вставьте токен бота или адрес ящика"'), 'Демо: значение не сохраняется'),
          buttons: [{ label: 'Отмена' }, { label: 'Подключить', primary: true, onClick: function (box) { if (val(box, 'tok').length < 6) return 'Токен или адрес — не короче 6 символов.'; log('Каналы', 'Подключение канала «' + val(box, 'ch') + '»', '—', 'проверка токена (демо)', null); toast('Канал «' + val(box, 'ch') + '» отправлен на проверку (демо, токен не сохраняется).'); } }] });
      });
    }
  }

  // прочие кнопки админки
  function adminButtons() {
    var main = $(M);
    on(findBtn(main, /^Пересчитать цены$/)[0], function (e, b) {
      var info = $$(M + ' div').filter(function (d) { return /^Последний полный пересчёт/.test(txt(d)) && !d.children.length; })[0];
      b.disabled = true; b.textContent = 'Пересчёт…'; toast('Пересчёт цен по правилам наценки запущен…');
      setTimeout(function () {
        b.disabled = false; b.textContent = 'Пересчитать цены';
        var t = nowStr(), errs = Math.max(0, 12 - Object.keys(LS.get('feeds', {})).length);
        if (info) info.textContent = 'Последний полный пересчёт: ' + t + ' · обновлено 218 430 позиций · ошибок ' + errs;
        LS.set('recalc', { t: t, errs: errs }); log('Цены', 'Полный пересчёт цен', '—', '218 430 поз., ошибок ' + errs, null); toast('Цены пересчитаны: 218 430 позиций, ошибок ' + errs + '.');
      }, 1600);
    });
    var rc = LS.get('recalc', null); if (rc) { var info0 = $$(M + ' div').filter(function (d) { return /^Последний полный пересчёт/.test(txt(d)) && !d.children.length; })[0]; if (info0) info0.textContent = 'Последний полный пересчёт: ' + rc.t + ' · обновлено 218 430 позиций · ошибок ' + rc.errs; }
    on(findBtn(main, /^История выгрузок$/)[0], function () {
      var rows = allJournal().filter(function (r) { return r.section === 'Источники'; }).slice(0, 15);
      modal({ title: 'История выгрузок', html: rows.length ? '<div class="pk-adm-scroll"><table class="table"><thead><tr><th>Когда</th><th>Что</th><th>Результат</th><th>Кто</th></tr></thead><tbody>' + rows.map(function (r) { return '<tr><td class="mono">' + esc(r.when) + '</td><td>' + esc(r.what) + '</td><td class="mono">' + esc(r.to) + '</td><td>' + esc(r.who) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p>Выгрузок пока не было.</p>', buttons: [{ label: 'Закрыть', primary: true }] });
    });
    // отчёты: CSV таблицы блока
    findBtn(main, /^Выгрузить отчёт$/).forEach(function (b) { on(b, function () { var t = $('table', b.closest('.blueprint')); if (t) csv('dengi-po-napravleniyam.csv', tableRows(t)); }); });
    // селекты периода и канала — без данных за другой период в демо
    $$(M + ' select').filter(function (s) { return /^(Сентябрь|Все каналы)$/.test(txt(s.options[0])) && !s.hasAttribute('data-adm-skip'); }).forEach(function (s) {
      s.setAttribute('data-adm-skip', '1'); s.setAttribute('aria-label', /Сентябрь/.test(txt(s.options[0])) ? 'Период отчёта' : 'Канал воронки');
      s.addEventListener('change', function () { toast('Срез «' + s.value + '»: в демо показаны данные за сентябрь по всем каналам.'); });
    });
    // автоматизация: добавить сценарий, статусы включения
    var ab = blockByTitle(/^Автоматизация и умный чат$/);
    if (ab) {
      var S = LS.get('scen', {});
      function scenRow(tr) {
        var name = txt(tr.cells[0]), tag = $('.tag', tr.cells[tr.cells.length - 1]); if (!tag) return;
        var b = el('button', { type: 'button', class: 'pk-adm-tagbtn', 'aria-pressed': 'true' }); tag.parentElement.insertBefore(b, tag); b.appendChild(tag);
        var initOn = /Включено|Работает|Активно/.test(txt(tag)), orig = { cls: tag.className, t: txt(tag) };
        function paint() { var onv = S[name] === undefined ? initOn : S[name]; b.setAttribute('aria-pressed', String(onv)); b.setAttribute('aria-label', 'Сценарий «' + name + '»: ' + (onv ? 'включён' : 'выключен') + '. Переключить'); if (onv === initOn) { tag.className = orig.cls; tag.textContent = orig.t; } else setTag(tag, onv ? 'tag-accent' : 'tag-neutral', onv ? 'Включено' : 'Выключено'); }
        b.addEventListener('click', function () { var cur = S[name] === undefined ? initOn : S[name]; S[name] = !cur; LS.set('scen', S); paint(); log('Автоматизация', 'Сценарий «' + name + '»', cur ? 'вкл' : 'выкл', !cur ? 'вкл' : 'выкл', null); toast('Сценарий «' + name + '» ' + (!cur ? 'включён.' : 'выключен — заявки уходят человеку.')); });
        paint();
      }
      LS.get('newScen', []).forEach(function (s) { $('tbody', ab).appendChild(el('tr', { class: 'pk-adm-added' }, '<td>' + esc(s.name) + '</td><td>' + esc(s.trigger) + '</td><td>' + esc(s.action) + '</td><td class="mono">' + esc(s.limit) + '</td><td><span class="tag tag-accent">Включено</span></td>')); });
      $$('tbody tr', ab).forEach(scenRow);
      on(findBtn(ab, /^Добавить сценарий$/)[0], function () {
        modal({ title: 'Новый сценарий', html: field('Название', input('name', '', 'maxlength="60"')) + field('Триггер', input('trigger', '', 'maxlength="60" placeholder="Например: письмо с вложением PDF"')) + field('Действие', input('action', '', 'maxlength="80"')) + field('Порог передачи человеку', input('limit', 'до 500 000 ₽', 'maxlength="40"')),
          buttons: [{ label: 'Отмена' }, { label: 'Добавить', primary: true, onClick: function (box) {
            var s = { name: val(box, 'name'), trigger: val(box, 'trigger'), action: val(box, 'action'), limit: val(box, 'limit') };
            if (s.name.length < 3 || s.trigger.length < 3 || s.action.length < 3) return 'Заполните название, триггер и действие.';
            var list = LS.get('newScen', []); list.push(s); LS.set('newScen', list);
            var tr = el('tr', { class: 'pk-adm-added' }, '<td>' + esc(s.name) + '</td><td>' + esc(s.trigger) + '</td><td>' + esc(s.action) + '</td><td class="mono">' + esc(s.limit) + '</td><td><span class="tag tag-accent">Включено</span></td>');
            $('tbody', ab).appendChild(tr); scenRow(tr);
            log('Автоматизация', 'Новый сценарий «' + s.name + '»', '—', s.trigger + ' → ' + s.action, { k: 'ls', key: 'newScen', prev: list.slice(0, -1) }); toast('Сценарий добавлен и включён.');
          } }] });
      });
    }
    // контент-машина
    var cm = blockByTitle(/^Контент-машина/);
    if (cm) {
      on(findBtn(cm, /^Сгенерировать партию$/)[0], function (e, b) { b.disabled = true; b.textContent = 'Ставим в очередь…'; setTimeout(function () { b.disabled = false; b.textContent = 'Сгенерировать партию'; log('Контент', 'Партия статей', '—', '12 статей в очереди, проверка инженером', null); toast('Партия поставлена в очередь (демо): 12 статей, публикация после проверки инженером.'); }, 1200); });
      on(findBtn(cm, /^Шаблоны промптов$/)[0], function () {
        modal({ title: 'Шаблоны промптов', html: '<ul class="pk-adm-items"><li><b>Обзор модели</b> — характеристики из карточки, рабочая точка, типовые ошибки подбора</li><li><b>Сравнение с аналогом</b> — таблица отличий, когда аналог подходит, когда нет</li><li><b>Инструкция по замене</b> — присоединительные размеры, ЗИП, пусконаладка</li><li><b>FAQ по позиции</b> — вопросы из умного чата без ответа</li></ul><p class="pk-adm-muted">Правка шаблонов — в следующей версии; сейчас они только просматриваются.</p>', buttons: [{ label: 'Закрыть', primary: true }] });
      });
    }
    // очередь тем: статусы и просмотр
    $$(M + ' table').filter(function (t) { return t.tHead && /Ключевой запрос/.test(txt(t.tHead)); }).forEach(function (t) {
      var Q = LS.get('topics', {});
      $$('tbody tr', t).forEach(function (tr) {
        var topic = txt(tr.cells[0]), stTd = tr.cells[5], tag = $('.tag', stTd) || stTd, b = $('button', tr.cells[6]); if (!b) return;
        b.setAttribute('aria-label', txt(b) + ': ' + topic);
        var paint = function () { var s = Q[topic]; if (!s) return; if (s === 'paused') { setTag(tag, 'tag-neutral', 'На паузе'); b.textContent = 'Запустить'; } else if (s === 'running') { setTag(tag, 'tag-accent', 'В работе'); b.textContent = 'Пауза'; } else if (s === 'checked') { setTag(tag, 'tag-accent', 'Проверено'); b.textContent = 'Смотреть'; } };
        on(b, function () {
          var l = txt(b), prevT = txt(tag);
          if (l === 'Пауза' || l === 'Запустить') { Q[topic] = l === 'Пауза' ? 'paused' : 'running'; LS.set('topics', Q); paint(); log('Контент', 'Тема «' + topic + '»', prevT, txt(tag), null); toast(l === 'Пауза' ? 'Тема поставлена на паузу.' : 'Генерация темы запущена (демо).'); return; }
          modal({ title: topic, html: '<p class="mono">' + esc(txt(tr.cells[1])) + ' · ' + esc(txt(tr.cells[2])) + ' · ' + esc(txt(tr.cells[4])) + '</p><p>Черновик статьи: вводная, таблица подбора, 4 раздела, FAQ из вопросов чата, перелинковка на карточки и направление. Фото — ' + esc(txt(tr.cells[3])) + '.</p><p class="pk-adm-muted">Демо-превью: полный текст появится после генерации.</p>',
            buttons: l === 'Проверить' ? [{ label: 'Вернуть на доработку', onClick: function () { log('Контент', 'Тема «' + topic + '»', prevT, 'на доработке', null); toast('Отправлено на доработку.'); } }, { label: 'Проверено, в публикацию', primary: true, onClick: function () { Q[topic] = 'checked'; LS.set('topics', Q); paint(); log('Контент', 'Тема «' + topic + '»', prevT, 'проверено', null); toast('Статья проверена и ушла в публикацию (демо).'); } }] : [{ label: 'Закрыть', primary: true }] });
        });
        paint();
      });
    });
  }

  // ═════════ логистика ═════════
  function initLogistics() {
    var b = blockByTitle(/расчёт доставки/); if (!b) return;
    var table = $('table', b), badge = $$('.tag', b).filter(function (t) { return /^Выбрано:/.test(txt(t)); })[0];
    var rows = $$('tbody tr', table), chosen = LS.get('logChoice', null);
    var origTags = rows.map(function (tr) { var t = $('.tag', tr.cells[5]); return { cls: t.className, t: txt(t) }; });
    table.tHead.rows[0].appendChild(el('th', {}, '<span class="pk-vh">Действие</span>'));
    rows.forEach(function (tr, i) {
      var name = txt(tr.cells[0]); var td = el('td'); var bb = btn('Выбрать'); bb.setAttribute('aria-label', 'Выбрать вариант: ' + name); td.appendChild(bb); tr.appendChild(td);
      bb.addEventListener('click', function () {
        var prevI = chosen == null ? 0 : chosen; if (prevI === i) return;
        chosen = i; LS.set('logChoice', i); paint();
        log('Логистика', 'Заказ ПК-10428: вариант доставки', txt(rows[prevI].cells[0]), name + ', ' + txt(tr.cells[4]), null);
        toast('Выбрано: ' + name + ' — ' + txt(tr.cells[3]) + ', ' + txt(tr.cells[4]) + '. Клиенту уйдёт уведомление (демо).');
      });
    });
    function paint() {
      var c = chosen == null ? 0 : chosen;
      rows.forEach(function (tr, i) { var t = $('.tag', tr.cells[5]), bb = $('button', tr.lastChild); if (i === c) { setTag(t, 'tag-accent', 'Выбрано'); bb.hidden = true; } else { if (i === 0 && c !== 0) setTag(t, 'tag-outline', 'Рекомендация системы'); else { t.className = origTags[i].cls; t.textContent = origTags[i].t; } bb.hidden = false; } tr.classList.toggle('is-chosen', i === c); });
      if (badge) badge.textContent = 'Выбрано: ' + txt(rows[c].cells[0]).toLowerCase() + (c === 0 ? ', 2 отгрузки' : '');
    }
    paint();
    var head = $('.pk-adm-sub-macro') ? $$(M + ' h1')[0].closest('div').parentElement : null;
    var actions = head && head.lastElementChild;
    if (actions) {
      var rb = btn('Пересчитать', 'btn-primary'); actions.appendChild(rb);
      rb.addEventListener('click', function () {
        rb.disabled = true; rb.textContent = 'Запрос тарифов…';
        setTimeout(function () {
          rb.disabled = false; rb.textContent = 'Пересчитать';
          var costs = rows.map(function (tr) { return parseMoney(txt(tr.cells[4])); });
          rows.forEach(function (tr, i) { if (costs[i]) { var v = Math.round(costs[i] * (0.97 + Math.random() * 0.06) / 10) * 10; tr.cells[4].textContent = money(v); } });
          log('Логистика', 'Пересчёт доставки ПК-10428', '—', 'тарифы 4 перевозчиков на ' + hm(), null);
          var c = chosen == null ? 0 : chosen; toast('Тарифы 4 перевозчиков обновлены в ' + hm() + '. Выбран вариант: ' + txt(rows[c].cells[0]).toLowerCase() + ', ' + txt(rows[c].cells[4]) + '.');
        }, 1300);
      });
    }
  }

  // ═════════ ошибки автоматики ═════════
  function initIncidents() {
    var main = $(M);
    on(findBtn(main, /^Настроить компенсации$/)[0], function () {
      var C = LS.get('comp', { limit: '30 000', ack: '1 час', off: '3' });
      modal({ title: 'Компенсации без оператора', html: field('Компенсация без согласования, ₽', input('limit', C.limit, 'inputmode="numeric"'), 'Не более 30 000 ₽ — защитное ограничение из «Прав и ролей»') + field('Признать ошибку клиенту за', select('ack', ['30 минут', '1 час', '2 часа'], C.ack)) + field('Отключать сценарий после ошибок одного типа', select('off', ['2', '3', '5'], C.off)),
        buttons: [{ label: 'Отмена' }, { label: 'Сохранить', primary: true, onClick: function (box) {
          var l = parseMoney(val(box, 'limit')); if (!(l > 0)) return 'Укажите сумму компенсации.'; if (l > 30000) return 'Больше 30 000 ₽ без согласования нельзя — ограничение из «Прав и ролей».';
          var n = { limit: String(l).replace(/\B(?=(\d{3})+(?!\d))/g, ' '), ack: val(box, 'ack'), off: val(box, 'off') };
          log('Автоматизация', 'Правила компенсаций', C.limit + ' ₽, ' + C.ack + ', ' + C.off + ' ош.', n.limit + ' ₽, ' + n.ack + ', ' + n.off + ' ош.', { k: 'ls', key: 'comp', prev: C }); LS.set('comp', n); toast('Правила компенсаций сохранены.');
        } }] });
    });
    var yes = findBtn(main, /^Согласен на замену$/)[0], money2 = findBtn(main, /^Вернуть деньги$/)[0];
    [yes, money2].forEach(function (b) { if (!b) return; on(b, function () {
      var choice = b === yes ? 'замена' : 'возврат';
      LS.set('incChoice', choice);
      [yes, money2].forEach(function (x) { if (x) x.setAttribute('aria-pressed', String(x === b)); });
      log('Автоматизация', 'Ответ клиента в письме об ошибке (демо)', '—', choice, null);
      toast(choice === 'замена' ? 'Так клиент выберет замену: запускается отгрузка правильной модели и забор старой (демо).' : 'Так клиент выберет возврат: деньги уходят в день обращения (демо).');
    }); });
    var ch = LS.get('incChoice', null); if (ch) [yes, money2].forEach(function (x) { if (x) x.setAttribute('aria-pressed', String((x === yes) === (ch === 'замена'))); });
  }

  // ═════════ голосовой робот ═════════
  function initVoice() {
    var main = $(M);
    on(findBtn(main, /^Тестовый звонок$/)[0], function () {
      modal({ title: 'Тестовый звонок робота', html: field('Номер для звонка', input('phone', '', 'type="tel" inputmode="tel" autocomplete="off" placeholder="+7 900 000-00-00"'), 'Демо: звонок не совершается') + field('Сценарий', select('scen', ['Цена и наличие по артикулу', 'Подбор по описанию', 'Статус заказа', 'Напоминание об оплате'], '')),
        buttons: [{ label: 'Отмена' }, { label: 'Позвонить (демо)', primary: true, onClick: function (box) {
          var d = val(box, 'phone').replace(/\D/g, ''); if (d.length === 11 && /^[78]/.test(d)) d = d.slice(1);
          if (d.length !== 10) return 'Номер — 10 цифр после +7.';
          log('Каналы', 'Тестовый звонок робота', '—', val(box, 'scen') + ', +7 ··· ' + d.slice(-4), null);
          toast('Робот набирает +7 ··· ' + d.slice(-2) + ' по сценарию «' + val(box, 'scen') + '» (демо, звонок не совершается).');
        } }] });
    });
    on(findBtn(main, /^Прослушать запись$/)[0], function () {
      var dur = 92, t = 0, timer = null;
      var box = modal({ title: 'Запись звонка · 09:12', html: '<div class="pk-adm-player"><button type="button" class="btn btn-primary" data-play>Пауза</button><span class="pk-adm-meter pk-adm-meter-lg"><i data-pos style="width:0"></i></span><span class="mono" data-time>0:00 / 1:32</span></div><p class="pk-adm-muted">Демо-проигрыватель без звука: расшифровка — на странице, строка подсвечивается по времени.</p>', buttons: [{ label: 'Закрыть', primary: true }] });
      var pos = $('[data-pos]', box), time = $('[data-time]', box), pb = $('[data-play]', box);
      var lines = $$(M + ' .blueprint').filter(function (b) { return /Расшифровка входящего/.test(txt($('h3', b))); }).map(function (b) { return $$('.mono', b).filter(function (m) { return /^\d\d:\d\d$/.test(txt(m)); }); })[0] || [];
      function tick() { t = Math.min(dur, t + 2); pos.style.width = (t / dur * 100) + '%'; time.textContent = Math.floor(t / 60) + ':' + pad(t % 60) + ' / 1:32'; lines.forEach(function (m) { var p = txt(m).split(':'); var s = +p[0] * 60 + +p[1]; var row = m.parentElement; row.classList.toggle('pk-adm-now', s <= t && t < s + 10); }); if (t >= dur) { stop(); pb.textContent = 'Сначала'; } }
      function stop() { clearInterval(timer); timer = null; }
      function start() { if (t >= dur) t = 0; timer = setInterval(tick, 250); pb.textContent = 'Пауза'; }
      pb.addEventListener('click', function () { if (timer) { stop(); pb.textContent = 'Играть'; } else start(); });
      start();
      var obs = new MutationObserver(function () { if (!document.contains(box)) { stop(); lines.forEach(function (m) { m.parentElement.classList.remove('pk-adm-now'); }); obs.disconnect(); } });
      obs.observe(document.body, { childList: true });
    });
    on(findBtn(main, /^Отметить ошибку распознавания$/)[0], function () {
      modal({ title: 'Ошибка распознавания', html: field('Где ошибка', select('at', ['00:06 — расход «сорок кубов»', '00:31 — напор «метров сорок»', '00:58 — «две штуки»', '01:27 — «добавьте»'], '')) + field('Как правильно', input('fix', '', 'maxlength="80"')),
        buttons: [{ label: 'Отмена' }, { label: 'В обучение распознавания', primary: true, onClick: function (box) { if (val(box, 'fix').length < 2) return 'Напишите правильный вариант.'; log('Каналы', 'Ошибка распознавания ' + val(box, 'at').split(' — ')[0], val(box, 'at').split(' — ')[1], val(box, 'fix'), null); toast('Исправление ушло в обучение распознавания. Точность пересчитается ночью.'); } }] });
    });
  }

  // ═════════ экономика ═════════
  function initEconomy() {
    var main = $(M);
    on(findBtn(main, /^Выгрузить$/)[0], function () { var rows = []; $$(M + ' table').forEach(function (t, i) { if (i) rows.push([]); rows = rows.concat(tableRows(t)); }); csv('ekonomika-servisa.csv', rows); });
    $$(M + ' select').filter(function (s) { return txt(s.options[0]) === 'Сентябрь'; }).forEach(function (s) { s.setAttribute('data-adm-skip', '1'); s.setAttribute('aria-label', 'Период'); s.addEventListener('change', function () { toast('Период «' + s.value + '»: в демо показаны данные за сентябрь.'); }); });
  }

  // ═════════ карточка клиента ═════════
  function limitDialog(card, name, done) {
    var limEl = $('[data-limit]', card) || $$('.mono', card)[0], used = +(($('[data-used]', card) || {}).getAttribute ? $('[data-used]', card).getAttribute('data-used') : 0);
    var cur = parseMoney(txt(limEl));
    modal({ title: 'Лимит отсрочки · ' + name, html: field('Новый лимит, ₽', input('lim', String(cur), 'inputmode="numeric"'), 'Не ниже использованного (' + money(used) + '). Выше 1 000 000 ₽ — две подписи.') + field('Основание', select('why', ['скоринг и история оплат', 'проектная сделка', 'просьба клиента', 'просрочка — снижение'], '')),
      buttons: [{ label: 'Отмена' }, { label: 'Сохранить', primary: true, onClick: function (box) {
        var v = +val(box, 'lim').replace(/\s/g, '');
        if (!/^\d+$/.test(val(box, 'lim').replace(/\s/g, ''))) return 'Лимит — целое число рублей.';
        if (v < used) return 'Лимит не может быть ниже использованного: ' + money(used) + '.';
        if (v > 3000000) return 'Больше 3 000 000 ₽ — только через кредитный комитет.';
        var apply = function (second) { done(v, cur); log('CRM', 'Лимит отсрочки · ' + name + (second ? ' (2-я подпись: ' + second.split(' · ')[0] + ')' : ''), money(cur), money(v) + ' · ' + val(box, 'why'), null); toast('Лимит ' + name + ': ' + money(v) + '.'); };
        if (v > 1000000 && v !== cur) { setTimeout(function () { twoSign('Лимит больше 1 000 000 ₽', '<p>' + esc(name) + ': <span class="mono">' + money(cur) + ' → ' + money(v) + '</span></p>', apply); }, 0); return; }
        apply();
      } }] });
  }
  function initClient() {
    var main = $(M), name = txt($('h1'));
    var lim = blockByTitle(/^Расчёты и лимит$/);
    if (lim && !$('[data-limit-card]')) {
      var vals = $$('.mono', lim), limEl = vals[0], usedEl = vals[1], bar = $('span > span', lim);
      limEl.setAttribute('data-limit', ''); usedEl.setAttribute('data-used', parseMoney(txt(usedEl)));
      var kpi = $$(M + ' .blueprint').filter(function (b) { return /лимит отсрочки использован/.test(txt(b)); })[0];
      var paint = function (v) { limEl.textContent = money(v); var p = Math.round(parseMoney(txt(usedEl)) / v * 100); if (bar) bar.style.width = p + '%'; if (kpi) $('.mono', kpi).textContent = p + '%'; };
      var stored = LS.get('limit:metiznyj-zavod', null); if (stored) paint(stored);
      on(findBtn(lim, /^Изменить лимит$/)[0], function () { limitDialog(lim, name, function (v) { LS.set('limit:metiznyj-zavod', v); paint(v); }); });
      on(findBtn(lim, /^Акт сверки$/)[0], function () { sverka(name); });
      var acts = $('h1').closest('div').parentElement.lastElementChild;
      if (acts && !$('[data-call]', acts)) { var cb = btn('Позвонить (демо)'); cb.setAttribute('data-call', name); acts.insertBefore(cb, acts.firstChild); }
    }
    // «Повторить» и «В корзину» — ссылки из макета; подсказки → в задачи
    var hints = blockByTitle(/^Что подсказать клиенту$/);
    if (hints) $$('span', hints).filter(function (s) { return txt(s).length > 40 && !s.children.length; }).forEach(function (s, i) {
      var li = s.parentElement; li.classList.add('pk-adm-hintrow'); li.setAttribute('data-hint', 'metiz-' + i);
      var b = btn('В задачи'); b.setAttribute('data-hint-task', ''); li.appendChild(b);
    });
  }
  function sverka(name) {
    modal({ title: 'Акт сверки · ' + name, html: field('Период', select('p', ['III квартал 2026', 'Август 2026', 'С начала года'], '')) + field('Отправить', select('to', ['по ЭДО (Диадок)', 'на почту снабжения', 'только скачать'], '')),
      buttons: [{ label: 'Отмена' }, { label: 'Сформировать', primary: true, onClick: function (box) {
        var to = val(box, 'to'), p = val(box, 'p');
        if (/скачать/.test(to)) csv('akt-sverki.csv', [['Дата', 'Документ', 'Дебет', 'Кредит'], ['12.09.2026', 'Счёт ПК-10428', '222 600', ''], ['02.09.2026', 'УПД ПК-10390', '249 200', ''], ['04.09.2026', 'Оплата п/п 1184', '', '249 200']]);
        else toast('Акт сверки за ' + p.toLowerCase() + ' сформирован и отправлен ' + to + ' (демо).');
        log('CRM', 'Акт сверки · ' + name, '—', p + ', ' + to, null);
      } }] });
  }
  // общие действия на карточках клиентов
  function initClientCommon() {
    document.addEventListener('click', function (e) {
      var call = e.target.closest('[data-call]');
      if (call) { e.preventDefault(); log('CRM', 'Звонок клиенту ' + call.getAttribute('data-call'), '—', 'исходящий (демо)', null); toast('Звоним: ' + call.getAttribute('data-call') + ' — телефония в демо не подключена, звонок записан в историю.'); return; }
      var task = e.target.closest('[data-hint-task]');
      if (task) {
        var li = task.closest('[data-hint]'), key = li.getAttribute('data-hint'), T = LS.get('tasks', {});
        if (T[key]) { toast('Задача уже в очереди.'); return; }
        var text = txt(li.firstElementChild && li.firstElementChild.tagName !== 'BUTTON' ? li.querySelector('span:not(:empty)') || li : li).replace(/В задачи$/, '').slice(0, 120);
        T[key] = { at: nowStr(), by: whoShort() }; LS.set('tasks', T);
        task.textContent = 'В задачах'; task.disabled = true;
        log('CRM', 'Задача по подсказке', '—', text.slice(0, 70), null); toast('Задача создана, ответственный: ' + whoShort().replace(/\.$/, '') + '.');
      }
    });
    var T = LS.get('tasks', {});
    $$('[data-hint]').forEach(function (li) { if (T[li.getAttribute('data-hint')]) { var b = $('[data-hint-task]', li); if (b) { b.textContent = 'В задачах'; b.disabled = true; } } });
    var lc = $('[data-limit-card]');
    if (lc) {
      var slug = lc.getAttribute('data-client'), name = txt($('h1')), kpi = $$('.pk-adm-kpi').filter(function (k) { return /лимит отсрочки/.test(txt(k)); })[0];
      var paint = function (v) { $('[data-limit]', lc).textContent = v ? money(v) : 'нет'; var used = +$('[data-used]', lc).getAttribute('data-used'); var p = v ? Math.round(used / v * 100) : 0; $('[data-limit-bar]', lc).style.width = p + '%'; if (kpi) $('.mono', kpi).textContent = p + '%'; };
      var st = LS.get('limit:' + slug, null); if (st) paint(st);
      $('[data-limit-edit]', lc).addEventListener('click', function () { limitDialog(lc, name, function (v) { LS.set('limit:' + slug, v); paint(v); }); });
      $('[data-act-sverka]', lc).addEventListener('click', function () { sverka(name); });
    }
    // статусы сделок клиента по CRM
    $$('[data-deal-col]').forEach(function (t) { var s = dealState(t.getAttribute('data-deal-col')); if (s.closed) setTag(t, 'tag-neutral', 'закрыта'); else if (s.col != null) t.textContent = DATA.columns[s.col]; });
  }

  // ═════════ списки: поиск, фильтр, сортировка ═════════
  function initTables() {
    $$('table[data-table]').forEach(function (t) {
      var id = t.getAttribute('data-table'), tbody = t.tBodies[0], rows = $$('tr', tbody);
      var q = $('[data-table-search="' + id + '"]'), f = $('[data-table-filter="' + id + '"]'), cnt = $('[data-table-count="' + id + '"]');
      function apply() {
        var s = q ? q.value.trim().toLowerCase() : '', fv = f ? f.value : '', n = 0;
        rows.forEach(function (r) { var ok = (!s || (r.getAttribute('data-q') || '').indexOf(s) >= 0) && (!fv || (fv === 'paused' ? r.classList.contains('is-paused') : r.getAttribute('data-feed') === fv)); r.hidden = !ok; if (ok) n++; });
        if (cnt) cnt.textContent = 'Показано: ' + n + ' из ' + rows.length;
        var empty = $('.pk-adm-emptyrow', tbody);
        if (!n && !empty) tbody.appendChild(el('tr', { class: 'pk-adm-emptyrow' }, '<td colspan="' + t.tHead.rows[0].cells.length + '" class="pk-adm-muted">Ничего не найдено — измените запрос или фильтр.</td>')); else if (n && empty) empty.remove();
      }
      if (q) q.addEventListener('input', apply); if (f) f.addEventListener('change', apply);
      $$('[data-sort]', t).forEach(function (b) {
        b.addEventListener('click', function () {
          var col = +b.getAttribute('data-sort'), numeric = b.hasAttribute('data-num'), dir = b.getAttribute('aria-sort') === 'ascending' ? -1 : 1;
          $$('th', t).forEach(function (th) { th.removeAttribute('aria-sort'); }); $$('[data-sort]', t).forEach(function (x) { x.removeAttribute('aria-sort'); });
          b.setAttribute('aria-sort', dir === 1 ? 'ascending' : 'descending'); b.closest('th').setAttribute('aria-sort', dir === 1 ? 'ascending' : 'descending');
          rows.sort(function (a, c) { var x = a.cells[col], y = c.cells[col]; var vx = numeric ? +x.getAttribute('data-v') : txt(x), vy = numeric ? +y.getAttribute('data-v') : txt(y); return (numeric ? vx - vy : String(vx).localeCompare(String(vy), 'ru')) * dir; });
          rows.forEach(function (r) { tbody.appendChild(r); });
          live('Сортировка: ' + txt(b) + (dir === 1 ? ' по возрастанию' : ' по убыванию'));
        });
      });
      apply();
    });
  }

  // ═════════ поставщики ═════════
  function initSuppliers() {
    var t = $('table[data-table="sup"]'); if (!t) return;
    var P = LS.get('sup', {});
    $$('tbody tr[data-sup]', t).forEach(function (tr) {
      var slug = tr.getAttribute('data-sup'), name = txt($('b', tr)), tag = $('[data-sup-status]', tr), time = $('[data-sup-time]', tr), sync = $('[data-sup-sync]', tr), pause = $('[data-sup-pause]', tr);
      sync.setAttribute('aria-label', 'Обновить фид: ' + name); pause.setAttribute('aria-label', 'Приостановить поставщика: ' + name);
      var F = LS.get('feeds', {}); if (F[name]) { setTag(tag, 'tag-accent', F[name].status); time.textContent = F[name].time; tr.setAttribute('data-feed', 'ok'); }
      function paint() { var p = !!P[slug]; tr.classList.toggle('is-paused', p); pause.textContent = p ? 'Возобновить' : 'Приостановить'; pause.setAttribute('aria-pressed', String(p)); sync.disabled = p; if (p) setTag(tag, 'tag-neutral', 'Приостановлен'); }
      sync.addEventListener('click', function () { runSync(tag, time, 'Успешно', sync, name, function () { tr.setAttribute('data-feed', 'ok'); toast('Фид «' + name + '» обновлён.'); }); });
      pause.addEventListener('click', function () {
        if (!P[slug]) {
          modal({ title: 'Приостановить «' + name + '»?', html: '<p>Позиции поставщика перестанут участвовать в выборе предложения, открытые резервы сохранятся.</p>' + field('Причина', select('why', ['срыв сроков', 'точность остатков ниже порога', 'ошибки фида', 'по просьбе поставщика'], '')),
            buttons: [{ label: 'Отмена' }, { label: 'Приостановить', primary: true, onClick: function (box) { P[slug] = { why: val(box, 'why'), at: nowStr() }; LS.set('sup', P); paint(); log('Источники', 'Поставщик «' + name + '»', 'активен', 'приостановлен: ' + P[slug].why, null); toast('«' + name + '» приостановлен.'); } }] });
        } else { var why = P[slug].why; delete P[slug]; LS.set('sup', P); tag.className = 'tag tag-accent'; tag.textContent = 'Успешно'; paint(); log('Источники', 'Поставщик «' + name + '»', 'приостановлен: ' + why, 'активен', null); toast('«' + name + '» снова в работе.'); }
      });
      paint();
    });
    var all = $('[data-sup-syncall]');
    if (all) all.addEventListener('click', function () {
      var bs = $$('[data-sup-sync]', t).filter(function (b) { return !b.disabled && !b.closest('tr').hidden; });
      all.disabled = true; toast('Синхронизация ' + bs.length + ' поставщиков…');
      bs.forEach(function (b, i) { setTimeout(function () { b.click(); }, i * 150); });
      setTimeout(function () { all.disabled = false; }, bs.length * 150 + 1900);
    });
  }

  // ═════════ полный журнал ═════════
  function initJournalPage() {
    var box = $('[data-journal-full]'); if (!box) return;
    var body = $('[data-j-body]', box), sec = $('[data-j-sec]', box), wh = $('[data-j-who]', box), q = $('[data-j-q]', box), cnt = $('[data-j-count]', box);
    function fillOpts() {
      var all = allJournal(), secs = {}, whos = {};
      all.forEach(function (r) { secs[r.section] = 1; whos[r.who] = 1; });
      [[sec, secs], [wh, whos]].forEach(function (p) { var cur = p[0].value; p[0].length = 1; Object.keys(p[1]).sort().forEach(function (k) { p[0].appendChild(el('option', { value: k, text: k })); }); p[0].value = cur; });
    }
    function render() {
      var s = sec.value, w = wh.value, qq = q.value.trim().toLowerCase();
      var rows = allJournal().filter(function (r) { return (!s || r.section === s) && (!w || r.who === w) && (!qq || (r.what + ' ' + r.from + ' ' + r.to).toLowerCase().indexOf(qq) >= 0); });
      body.innerHTML = '';
      if (!rows.length) body.appendChild(el('tr', {}, '<td colspan="6" class="pk-adm-muted">Записей нет — измените фильтр.</td>'));
      rows.forEach(function (r) { body.appendChild(journalRow(r, function (rec) { rollback(rec); fillOpts(); render(); })); });
      cnt.textContent = 'Записей: ' + rows.length;
    }
    [sec, wh].forEach(function (x) { x.addEventListener('change', render); }); q.addEventListener('input', render);
    var params = new URLSearchParams(location.search); if (params.get('section')) { fillOpts(); sec.value = params.get('section'); }
    fillOpts(); render();
    $('[data-journal-csv]').addEventListener('click', function () { csv('zhurnal-izmenenij.csv', [['Когда', 'Раздел', 'Что изменено', 'Было', 'Стало', 'Кто', 'Откачено']].concat(allJournal().map(function (r) { return [r.when, r.section, r.what, r.from, r.to, r.who, r.rolled ? 'да' : '']; }))); });
  }

  // ═════════ оставшиеся демо-кнопки панели: осмысленный ответ вместо общего ═════════
  function leftovers() {
    $$(M + ' [data-demo]').forEach(function (b) {
      var t = txt(b);
      on(b, function () { log(SECTION_BY_PAGE[PATH] || 'Панель', t, '—', 'выполнено (демо)', null); toast('«' + t + '» — выполнено в демо-режиме, запись добавлена в журнал.'); });
    });
  }

  // ═════════ запуск ═════════
  function start() {
    chrome();
    if (PATH === 'panel/crm/') initCrm();
    if (PATH === 'panel/avtopilot/') initAutopilot();
    if (PATH === 'panel/prava/') initRoles();
    if (PATH === 'panel/admin/') initAdmin();
    if (PATH === 'panel/logistika/') initLogistics();
    if (PATH === 'panel/oshibki/') initIncidents();
    if (PATH === 'panel/golosovoj-robot/') initVoice();
    if (PATH === 'panel/ekonomika/') initEconomy();
    if (PATH === 'panel/klient/') initClient();
    if (/^panel\/sdelki\//.test(PATH)) initDealPage();
    if (PATH === 'panel/postavshchiki/') initSuppliers();
    if (PATH === 'panel/zhurnal/') initJournalPage();
    initTables(); initClientCommon();
    persistControls();
    leftovers();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

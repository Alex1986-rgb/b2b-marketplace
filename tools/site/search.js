// ПРОМКОНТУР — поиск по сайту: подсказки в шапке и страница результатов /poisk/?q=
// Без зависимостей. Индекс: BASE + 'search-index.json' (пишет tools/build_site.js).
// Пользовательский ввод выводится только через textContent.
(function () {
  'use strict';
  var BASE = (document.querySelector('link[rel="manifest"]') || { getAttribute: function () { return '/site.webmanifest'; } }).getAttribute('href').replace('site.webmanifest', '');
  var TYPES = ['Товар', 'Направление', 'Производитель', 'Статья', 'Раздел'];
  var PLURAL = { 'Товар': 'Товары', 'Направление': 'Направления', 'Производитель': 'Производители', 'Статья': 'Статьи', 'Раздел': 'Разделы' };
  var STOP = { 'и': 1, 'в': 1, 'во': 1, 'на': 1, 'по': 1, 'для': 1, 'с': 1, 'со': 1, 'от': 1, 'до': 1, 'или': 1, 'из': 1, 'к': 1, 'the': 1, 'of': 1 };

  // ═════════ Нормализация ═════════
  var CYR = { 'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'i', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sh', 'ъ': '', 'ы': 'i', 'ь': '', 'э': 'e', 'ю': 'iu', 'я': 'ia' };
  var EN = 'qwertyuiop[]asdfghjkl;\'zxcvbnm,.`', RU = 'йцукенгшщзхъфывапролджэячсмитьбюё';
  var EN2RU = {}, RU2EN = {};
  for (var li = 0; li < EN.length; li++) { EN2RU[EN[li]] = RU[li]; RU2EN[RU[li]] = EN[li]; }

  // «скелет»: кириллица и латиница сводятся к общей латинице — grundfos = грундфос, wilo = вило, skf = скф
  function skeleton(word) {
    var s = '', i;
    for (i = 0; i < word.length; i++) { var c = word[i]; s += CYR.hasOwnProperty(c) ? CYR[c] : c; }
    s = s.replace(/ph/g, 'f').replace(/kh/g, 'h').replace(/ck/g, 'k').replace(/tz/g, 'ts').replace(/x/g, 'ks')
      .replace(/w/g, 'v').replace(/q/g, 'k').replace(/c/g, 'k').replace(/[yj]/g, 'i');
    return s.replace(/([a-z])\1(?!\1)/g, '$1'); // двойные буквы: компрессор = компресор, danfoss = данфос
  }
  function clean(s) {
    return String(s || '').toLowerCase().replace(/ё/g, 'е')
      .replace(/[^a-zа-я0-9]+/g, ' ')                         // пунктуация, дефисы, ×, №
      .replace(/([a-zа-я])(\d)/g, '$1 $2').replace(/(\d)([a-zа-я])/g, '$1 $2') // cr32 → cr 32
      .trim();
  }
  function tokens(s) { var t = clean(s); return t ? t.split(' ').map(skeleton).filter(Boolean) : []; }
  function compact(s) { return tokens(s).join(''); }
  function layout(raw) {
    var lat = /[a-z]/i.test(raw), cyr = /[а-яё]/i.test(raw), map = lat && !cyr ? EN2RU : cyr && !lat ? RU2EN : null;
    if (!map) return '';
    var out = '', s = raw.toLowerCase();
    for (var i = 0; i < s.length; i++) out += map.hasOwnProperty(s[i]) ? map[s[i]] : s[i];
    return out;
  }

  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var prev = [], cur, i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i]; var rowMin = i;
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (cur[j] < rowMin) rowMin = cur[j];
      }
      if (rowMin > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }
  function fuzzMax(len) { return len >= 8 ? 2 : len >= 4 ? 1 : 0; }

  // ═════════ Индекс ═════════
  var INDEX = null, loading = null;
  function uniq(a) { var o = {}, r = []; a.forEach(function (x) { if (!o[x]) { o[x] = 1; r.push(x); } }); return r; }
  function prepare(list) {
    return list.map(function (it, n) {
      var sku = /арт\.\s*([^·]+)/.exec(it.sub || '');
      return { it: it, n: n, tt: uniq(tokens(it.title)), kt: uniq(tokens((it.keys || '') + ' ' + (it.sub || ''))),
        ct: compact(it.title), ck: compact(it.keys), cs: sku ? compact(sku[1]) : '' };
    });
  }
  function load() {
    if (INDEX) return Promise.resolve(INDEX);
    if (!loading) loading = fetch(BASE + 'search-index.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { INDEX = prepare(d); return INDEX; })
      .catch(function (e) { loading = null; throw e; });
    return loading;
  }

  // ═════════ Скоринг ═════════
  function tokenScore(q, list, w) {
    var best = 0, digits = /^\d+$/.test(q), fm = digits ? 0 : fuzzMax(q.length);
    for (var i = 0; i < list.length; i++) {
      var t = list[i], s = 0;
      if (t === q) s = 10;
      else if (q.length >= 2 && t.indexOf(q) === 0 && !(digits && q.length < 3 && /^\d+$/.test(t))) s = 7;
      else if (q.length >= 3 && !digits && t.indexOf(q) > 0) s = 4;
      else if (fm && t.length >= 4) { var d = lev(q, t, fm); if (d <= fm) s = 3 - d * 0.5; else if (t.length > q.length) { d = lev(q, t.slice(0, q.length), fm); if (d <= fm) s = 2.5 - d * 0.5; } }
      if (s > best) { best = s; if (s === 10) break; }
    }
    return best * w;
  }
  function score(entry, qt, qc, numeric) {
    var total = 0, matched = 0, sum = 0;
    for (var i = 0; i < qt.length; i++) {
      var q = qt[i]; if (STOP[q]) continue;
      total++;
      var s = Math.max(tokenScore(q, entry.tt, 1), tokenScore(q, entry.kt, 0.7));
      if (s > 0) { matched++; sum += s; }
    }
    if (!total) return 0;
    var cov = matched / total;
    if (cov < 0.5 || (total <= 2 && cov < 1)) return 0;
    var sc = sum * cov * cov;
    if (qc.length >= 3) {
      if (entry.cs && entry.cs === qc) sc += 50;
      else if (entry.ct === qc) sc += 40;
      else if (entry.ct.indexOf(qc) === 0) sc += 20;
      else if (entry.ct.indexOf(qc) > 0) sc += 12;
      else if (qc.length >= 4 && entry.ck.indexOf(qc) >= 0) sc += 6;
    }
    if (numeric && entry.it.type === 'Товар') sc *= 1.15;
    return sc;
  }
  function run(raw) {
    var qt = tokens(raw), qc = qt.join(''), numeric = /\d/.test(raw), out = [];
    if (!INDEX || !qc) return { list: out, full: false };
    var full = false;
    INDEX.forEach(function (e) { var s = score(e, qt, qc, numeric); if (s > 0) out.push({ e: e, s: s }); });
    out.sort(function (a, b) { return b.s - a.s || a.e.n - b.e.n; });
    if (out.length) { var top = out[0].s; out = out.filter(function (r) { return r.s >= Math.max(2, top * 0.12); }); full = top >= 7; }
    return { list: out, full: full };
  }
  // основной вход: исходный запрос, при слабом результате — та же строка в другой раскладке (yfcjc → насос)
  function find(raw) {
    raw = String(raw || '').trim();
    var a = run(raw), alt = layout(raw);
    if (alt && alt !== raw) {
      var b = run(alt), ta = a.list.length ? a.list[0].s : 0, tb = b.list.length ? b.list[0].s : 0;
      if ((b.full && !a.full) || tb > ta * 2) return { list: b.list, fixed: alt };
    }
    return { list: a.list, fixed: '' };
  }
  // «возможно, вы искали»: мягкое сравнение слов запроса со словами заголовков
  function suggest(raw, n) {
    var qt = tokens(raw).filter(function (t) { return t.length >= 3 && !STOP[t]; }), res = [];
    if (!INDEX || !qt.length) return res;
    INDEX.forEach(function (e) {
      var best = 99;
      qt.forEach(function (q) {
        var m = Math.ceil(q.length / 2);
        e.tt.concat(e.kt.slice(0, 40)).forEach(function (t) {
          if (t.length < 3) return;
          var d = lev(q, t.length > q.length + 2 ? t.slice(0, q.length) : t, m);
          if (d <= m && d / q.length < best) best = d / q.length;
        });
      });
      if (best <= 0.5) res.push({ e: e, s: best });
    });
    res.sort(function (a, b) { return a.s - b.s || TYPES.indexOf(a.e.it.type) - TYPES.indexOf(b.e.it.type); });
    return res.slice(0, n).map(function (r) { return r.e.it; });
  }

  // ═════════ DOM-помощники ═════════
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k]; if (v == null || v === false) return;
      if (k === 'text') n.textContent = v; else if (k === 'class') n.className = v; else if (k === 'style') n.style.cssText = v; else n.setAttribute(k, v);
    });
    (kids || []).forEach(function (c) { if (c != null) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function money(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽'; }
  function cssUrl(u) { return 'url("' + String(u).replace(/["\\\n]/g, '') + '")'; }
  function corners(n) { ['tl', 'tr', 'bl', 'br'].forEach(function (c) { n.insertBefore(el('i', { class: 'corner ' + c }), n.firstChild); }); return n; }
  function resultsUrl(q) { return BASE + 'poisk/?q=' + encodeURIComponent(q); }
  function media(it, size) {
    if (it.icon) return el('span', { class: 'pk-sg-media pk-sg-ic', 'aria-hidden': 'true' }, [el('span', { class: 'ico ' + it.icon })]);
    if (it.img) { var m = el('span', { class: 'pk-sg-media' + (it.type === 'Товар' ? ' pk-sg-thumb' : ' pk-sg-cover'), 'aria-hidden': 'true' }); m.style.backgroundImage = cssUrl(it.img); return m; }
    return el('span', { class: 'pk-sg-media pk-sg-ic', 'aria-hidden': 'true' }, [el('span', { class: 'ico ' + (it.type === 'Производитель' ? 'i-entry-catalog' : 'i-ui-search') })]);
  }

  // ═════════ Подсказки под полем ═════════
  var uid = 0;
  function isSearchInput(n) { return n && n.matches && n.matches('input.input') && /модель|артикул|название/i.test(n.placeholder || ''); }

  function attach(input) {
    if (input._pkSearch) return;
    input._pkSearch = true;
    var id = 'pk-sg-' + (++uid), panel = el('div', { class: 'pk-sg', id: id, role: 'listbox', 'aria-label': 'Подсказки поиска', hidden: 'hidden' });
    document.body.appendChild(panel);
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', id);
    input.setAttribute('autocomplete', 'off');
    var opts = [], active = -1, timer = 0, lastQ = null;

    function place() {
      if (panel.hidden) return;
      var wrap = input.parentElement || input, r = wrap.getBoundingClientRect(), header = input.closest('header');
      if (window.innerWidth <= 760) {
        var top = header ? Math.max(header.getBoundingClientRect().bottom, input.getBoundingClientRect().bottom) : r.bottom;
        panel.style.cssText = 'left:0;right:0;width:auto;top:' + Math.round(top + 4) + 'px;max-height:' + Math.max(200, window.innerHeight - top - 12) + 'px';
      } else {
        var w = Math.max(r.width, 420), left = Math.min(r.left, window.innerWidth - w - 12);
        panel.style.cssText = 'left:' + Math.round(Math.max(12, left)) + 'px;width:' + Math.round(w) + 'px;top:' + Math.round(r.bottom + 6) + 'px;max-height:' + Math.max(220, window.innerHeight - r.bottom - 24) + 'px';
      }
    }
    function open() { if (!panel.hidden) return; panel.hidden = false; input.setAttribute('aria-expanded', 'true'); place(); }
    function close() {
      if (panel.hidden) return;
      panel.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); setActive(-1);
    }
    function setActive(i) {
      if (opts[active]) opts[active].setAttribute('aria-selected', 'false');
      active = i;
      if (opts[i]) { opts[i].setAttribute('aria-selected', 'true'); input.setAttribute('aria-activedescendant', opts[i].id); opts[i].scrollIntoView({ block: 'nearest' }); }
      else input.removeAttribute('aria-activedescendant');
    }
    function option(href, kids, extraClass) {
      var o = el('a', { class: 'pk-sg-opt' + (extraClass ? ' ' + extraClass : ''), role: 'option', id: id + '-' + opts.length, href: href, 'aria-selected': 'false', tabindex: '-1' }, kids);
      var idx = opts.length; opts.push(o);
      o.addEventListener('mousemove', function () { if (active !== idx) setActive(idx); });
      o.addEventListener('mousedown', function (e) { e.preventDefault(); }); // фокус остаётся в поле
      return o;
    }
    function render(q) {
      var res = find(q), list = res.list.slice(0, 8);
      panel.textContent = ''; opts = []; active = -1; input.removeAttribute('aria-activedescendant');
      if (res.fixed) panel.appendChild(el('div', { class: 'pk-sg-note', role: 'presentation' }, ['Раскладка исправлена: ', el('b', { text: res.fixed })]));
      if (!list.length) panel.appendChild(el('div', { class: 'pk-sg-empty', role: 'presentation', text: 'Ничего не нашлось — откройте все результаты или опишите задачу в чате.' }));
      var order = []; list.forEach(function (r) { if (order.indexOf(r.e.it.type) < 0) order.push(r.e.it.type); });
      order.forEach(function (type, gi) {
        var gid = id + '-g' + gi, g = el('div', { role: 'group', 'aria-labelledby': gid, class: 'pk-sg-group' }, [el('div', { class: 'pk-sg-gh', id: gid, role: 'presentation', text: PLURAL[type] })]);
        list.filter(function (r) { return r.e.it.type === type; }).forEach(function (r) {
          var it = r.e.it;
          g.appendChild(option(it.href, [media(it),
            el('span', { class: 'pk-sg-txt' }, [el('span', { class: 'pk-sg-title', text: it.title }), it.sub ? el('span', { class: 'pk-sg-sub', text: it.sub }) : null]),
            it.type === 'Товар' ? el('span', { class: 'pk-sg-price mono', text: it.price ? money(it.price) : 'по запросу' }) : null]));
        });
        panel.appendChild(g);
      });
      panel.appendChild(option(resultsUrl(q), [el('span', { text: 'Все результаты по «' + q + '» →' })], 'pk-sg-all'));
    }
    function update() {
      var q = input.value.trim();
      if (q.length < 2) { lastQ = null; close(); return; }
      load().then(function () {
        if (input.value.trim() !== q || document.activeElement !== input) return;
        if (q !== lastQ || panel.hidden) { lastQ = q; render(q); }
        open();
      }, function () {});
    }
    input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(update, 90); });
    input.addEventListener('focus', function () { load().catch(function () {}); if (input.value.trim().length >= 2) update(); });
    input.addEventListener('blur', function () { setTimeout(function () { if (document.activeElement !== input) close(); }, 120); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (panel.hidden) { if (input.value.trim().length >= 2) { e.preventDefault(); update(); } return; }
        e.preventDefault();
        var n = opts.length; if (!n) return;
        setActive(e.key === 'ArrowDown' ? (active + 1) % n : (active <= 0 ? n - 1 : active - 1));
      } else if (e.key === 'Enter') {
        if (!panel.hidden && opts[active]) {
          e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation();
          location.href = opts[active].getAttribute('href');
        } else close();
      } else if (e.key === 'Escape') {
        if (!panel.hidden) { e.preventDefault(); e.stopPropagation(); close(); }
      }
    }, true);
    document.addEventListener('mousedown', function (e) { if (!panel.hidden && e.target !== input && !panel.contains(e.target)) close(); });
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, { passive: true });
  }
  function scan() { [].forEach.call(document.querySelectorAll('input.input'), function (n) { if (isSearchInput(n)) attach(n); }); }
  scan();
  document.addEventListener('focusin', function (e) { if (isSearchInput(e.target)) attach(e.target); });

  // ═════════ Страница /poisk/ ═════════
  if (!/\/poisk\/$/.test(location.pathname)) return;
  var Q = (new URLSearchParams(location.search).get('q') || '').trim();
  if (!Q) return;
  [].forEach.call(document.querySelectorAll('input.input'), function (n) { if (isSearchInput(n)) n.value = Q; });
  var h1 = document.querySelector('main h1, [role="main"] h1') || document.querySelector('h1');
  var screen = h1 && h1.parentElement;
  if (!screen) return;
  document.title = 'Поиск: ' + Q + ' — ПРОМКОНТУР';

  function productCard(it) {
    var ph = el('div', { class: 'ph pk-sr-ph', 'aria-hidden': 'true' }); if (it.img) ph.style.backgroundImage = cssUrl(it.img);
    return corners(el('article', { class: 'card blueprint pk-sr-prod', 'data-href': it.href }, [ph,
      el('div', { class: 'pk-sr-body' }, [
        el('span', { class: 'tag tag-accent pk-sr-type', text: it.type }),
        el('span', { class: 'card-title' }, [el('a', { href: it.href, text: it.title })]),
        it.sub ? el('span', { class: 'pk-sr-sub', text: it.sub }) : null,
        el('div', { class: 'pk-sr-foot' }, [
          el('div', { class: 'mono pk-sr-price', text: it.price ? money(it.price) : 'Цена по запросу' }),
          el('a', { class: 'btn btn-primary', href: it.href, text: 'Открыть' })])])]));
  }
  function rowCard(it) {
    return corners(el('article', { class: 'blueprint pk-sr-row', 'data-href': it.href }, [media(it),
      el('div', { class: 'pk-sr-txt' }, [
        el('span', { class: 'tag tag-accent pk-sr-type', text: it.type }),
        el('a', { class: 'pk-sr-title', href: it.href, text: it.title }),
        it.sub ? el('span', { class: 'pk-sr-sub', text: it.sub }) : null]),
      el('a', { class: 'btn btn-secondary pk-sr-open', href: it.href, text: 'Открыть' })]));
  }
  function plural(n, a, b, c) { var m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? b : c; }

  function renderPage() {
    var res = find(Q), list = res.list.map(function (r) { return r.e.it; });
    var keep = [].filter.call(screen.children, function (c) { return c.classList.contains('corner'); });
    screen.textContent = '';
    keep.forEach(function (c) { screen.appendChild(c); });
    screen.classList.add('pk-sr');
    screen.appendChild(el('div', { class: 'mono pk-sr-kicker', text: 'Поиск: «' + Q + '»' }));

    if (!list.length) {
      screen.appendChild(el('h1', { class: 'pk-sr-h1', text: 'Ничего не нашлось по «' + Q + '»' }));
      var sug = suggest(Q, 5);
      var p = el('p', { class: 'pk-sr-lead' }, ['Проверьте написание модели или артикула. ']);
      if (sug.length) {
        p.appendChild(document.createTextNode('Возможно, вы искали: '));
        sug.forEach(function (it, i) { if (i) p.appendChild(document.createTextNode(', ')); p.appendChild(el('a', { href: it.href, text: it.title })); });
        p.appendChild(document.createTextNode('.'));
      } else p.appendChild(document.createTextNode('Или воспользуйтесь другими способами подбора — они понимают фото, описание задачи и список позиций.'));
      screen.appendChild(p);
      var ways = [
        ['i-entry-photo', 'Поиск по фото шильдика', 'Снимите табличку на оборудовании — модель найдётся по артикулу.', BASE + 'poisk-po-foto/', 'Загрузить фото'],
        ['i-entry-chat', 'Умный чат', 'Опишите задачу параметрами — чат подберёт варианты.', BASE + 'chat/?q=' + encodeURIComponent(Q), 'Спросить в чате'],
        ['i-entry-list', 'Заявка списком', 'Загрузите список из заявки цеха — сопоставим строки с артикулами.', BASE + 'zayavka-spiskom/', 'Загрузить список']];
      screen.appendChild(el('div', { class: 'pk-sr-ways' }, ways.map(function (w, i) {
        return corners(el('div', { class: 'card blueprint pk-sr-way' }, [el('span', { class: 'ico ico-28 ' + w[0], 'aria-hidden': 'true' }),
          el('span', { class: 'card-title', text: w[1] }), el('p', { class: 'card-body', text: w[2] }),
          el('a', { class: 'btn ' + (i === 1 ? 'btn-primary' : 'btn-secondary'), href: w[3], text: w[4] })]));
      })));
      return;
    }

    var h = el('h1', { class: 'pk-sr-h1' }, ['Результаты по «' + Q + '»']);
    screen.appendChild(h);
    screen.appendChild(el('p', { class: 'pk-sr-lead', 'aria-live': 'polite' }, [
      'Найдено ' + list.length + ' ' + plural(list.length, 'совпадение', 'совпадения', 'совпадений'),
      res.fixed ? el('span', {}, [' · запрос в другой раскладке: ', el('b', { text: res.fixed })]) : null]));

    var counts = {}; list.forEach(function (it) { counts[it.type] = (counts[it.type] || 0) + 1; });
    var chips = el('div', { class: 'pk-sr-chips', role: 'toolbar', 'aria-label': 'Тип результата' });
    var grid = el('div', { class: 'pk-sr-grid' }), rows = el('div', { class: 'pk-sr-rows' });
    var filter = 'all';
    function chip(key, label, n) {
      var b = el('button', { type: 'button', class: 'pk-sr-chip', 'aria-pressed': key === filter ? 'true' : 'false', 'data-type': key }, [label + ' ', el('span', { class: 'mono', text: String(n) })]);
      b.addEventListener('click', function () {
        filter = key;
        [].forEach.call(chips.children, function (c) { c.setAttribute('aria-pressed', c === b ? 'true' : 'false'); });
        draw();
      });
      chips.appendChild(b);
    }
    chip('all', 'Все', list.length);
    TYPES.forEach(function (t) { if (counts[t]) chip(t, PLURAL[t], counts[t]); });
    screen.appendChild(chips);
    screen.appendChild(grid);
    screen.appendChild(rows);
    function draw() {
      grid.textContent = ''; rows.textContent = '';
      list.forEach(function (it) {
        if (filter !== 'all' && it.type !== filter) return;
        if (it.type === 'Товар') grid.appendChild(productCard(it)); else rows.appendChild(rowCard(it));
      });
      grid.hidden = !grid.children.length; rows.hidden = !rows.children.length;
    }
    draw();
  }
  load().then(renderPage, function () {});
})();

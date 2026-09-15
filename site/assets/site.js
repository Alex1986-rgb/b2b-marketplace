// ПРОМКОНТУР — поведение статического сайта (без фреймворков и бэкенда).
// Всё состояние — в localStorage браузера: корзина, сравнение. Сетевых запросов нет.
(function () {
  'use strict';
  var BASE = (document.querySelector('link[rel="manifest"]') || { getAttribute: function () { return '/site.webmanifest'; } }).getAttribute('href').replace('site.webmanifest', '');
  // bus: шина событий между кабинетами (assets/bus.js). Сборщик подключает на страницах только site.js/search.js/auth.js
  // и скрипт раздела, поэтому bus.js догружаем отсюда — только на корзине и в кабинетах. Скрипты разделов
  // подписываются через PK_BUS_READY(fn): fn вызовется сразу, если шина уже есть, или по событию pk:bus:ready.
  window.PK_BUS_READY = window.PK_BUS_READY || function (fn) {
    if (window.PK_BUS) { fn(window.PK_BUS); return; }
    document.addEventListener('pk:bus:ready', function h() { document.removeEventListener('pk:bus:ready', h); if (window.PK_BUS) fn(window.PK_BUS); });
  };
  (function () { // bus
    var rel = location.pathname.indexOf(BASE) === 0 ? location.pathname.slice(BASE.length) : location.pathname.replace(/^\//, '');
    if (window.PK_BUS || !/^(korzina|kabinet|kabinet-postavshchika|panel)\//.test(rel)) return;
    var s = document.createElement('script'); s.src = BASE + 'assets/bus.js'; s.async = true;
    (document.head || document.documentElement).appendChild(s);
  })();
  var LS = { get: function (k, d) { try { var v = localStorage.getItem('pk:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
             set: function (k, v) { try { localStorage.setItem('pk:' + k, JSON.stringify(v)); } catch (e) {} } };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var txt = function (el) { return el ? (el.textContent || '').replace(/[\s\u00a0\u202f]+/g, ' ').trim() : ''; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  // ── деньги: «104 900 ₽», разряды через узкий неразрывный пробел ──
  function money(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f') + '\u00a0₽'; }
  function parseMoney(s) { var d = String(s).replace(/[^\d]/g, ''); return d ? +d : 0; }
  var PRICE_RE = /\d[\d\s\u00a0\u202f]*\s?₽/;

  // ── тост (aria-live) ──
  var toastEl;
  function toast(text) {
    if (!toastEl) {
      toastEl = document.createElement('div'); toastEl.className = 'pk-toast';
      toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite'); toastEl.setAttribute('aria-atomic', 'true');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = text; toastEl.classList.add('on');
    clearTimeout(toastEl._t); toastEl._t = setTimeout(hideToast, 3600);
  }
  function hideToast() { if (toastEl) toastEl.classList.remove('on'); }

  // ═════════ Корзина ═════════
  // pk:cart2 — массив {sku, name, note, img, price, qty}; null — пользователь корзину ещё не трогал (показываем демо макета)
  function getCart() { return LS.get('cart2', null); }
  function setCart(items) { LS.set('cart2', items); paintCounters(); }

  function paintCounters() {
    var cart = getCart();
    if (cart) $$('header a[href$="korzina/"] .mono').forEach(function (el) { el.textContent = cart.length; });
    var cmp = LS.get('compare', null);
    if (cmp != null) $$('header a[href$="sravnenie/"] .mono').forEach(function (el) { el.textContent = cmp; });
  }

  function bgUrl(el) { var m = el && (el.getAttribute('style') || '').match(/url\((?:&quot;|["'])?([^"')&]+)/); return m ? m[1] : ''; }
  // текст только из собственных текстовых узлов (без вложенных подписей)
  function ownText(el) { return el ? txt({ textContent: [].filter.call(el.childNodes, function (n) { return n.nodeType === 3; }).map(function (n) { return n.nodeValue; }).join(' ') }) : ''; }
  function isPrice(el) { return PRICE_RE.test(txt(el)) && !/[a-zа-я]{3,}/i.test(txt(el).replace('₽', '')); }

  // количество из соседнего степпера (.seg с −/число/+)
  function qtyNear(btn) {
    var seg = btn.parentElement && btn.parentElement.querySelector('.seg');
    var num = seg && seg.querySelector('.seg-opt.mono');
    return num ? Math.max(1, parseInt(txt(num), 10) || 1) : 1;
  }

  // Вытащить позицию(и) из DOM рядом с кнопкой: строка таблицы, карточка каталога, карточка товара, ответ чата
  function extractItems(btn) {
    var tr = btn.closest('tr'), table = btn.closest('table');
    if (tr && table) {
      var cells = [].slice.call(tr.children), myCell = btn.closest('td,th');
      var priceCell = cells.filter(function (c) { return c !== myCell && isPrice(c); })[0];
      if (priceCell) { // строка = товар
        var skuCell = cells.filter(function (c) { return c.classList.contains('mono') && !isPrice(c); })[0];
        var nameCell = cells.filter(function (c) { return c !== myCell && !c.classList.contains('mono') && ownText(c); })[0];
        var sub = nameCell && nameCell.querySelector('div');
        return [{ sku: txt(skuCell), name: ownText(nameCell), note: txt(sub), price: parseMoney(txt(priceCell)), img: bgUrl(tr.querySelector('.thumb, [data-photo]')) }];
      }
      // столбец = товар (сравнение): имя, артикул и фото из шапки таблицы
      var idx = cells.indexOf(myCell), th = table.tHead && table.tHead.rows[0] && table.tHead.rows[0].cells[idx];
      var pr = $$('.mono', myCell).filter(isPrice)[0];
      if (pr && th) return [{ sku: txt(th.querySelector('.mono')), name: ownText(th) || txt(th), price: parseMoney(txt(pr)), img: bgUrl(th.querySelector('.thumb')) }];
    }
    var node = btn.parentElement, prices = [];
    for (var i = 0; node && i < 7; i++, node = node.parentElement) {
      prices = $$('.mono', node).filter(function (m) { return isPrice(m) && !m.closest('header') && !m.closest('.seg'); });
      if (prices.length) break;
    }
    if (!prices.length) return [];
    // несколько строк «название · параметры — цена» (ответ чата)
    if (prices.length > 1) {
      return prices.map(function (p) {
        var row = p.parentElement, label = [].filter.call(row.children, function (c) { return c !== p; })[0];
        var parts = txt(label).split(' · ');
        return { sku: '', name: parts[0], note: parts.slice(1).join(' · '), price: parseMoney(txt(p)), img: '' };
      }).filter(function (x) { return x.name && x.price; });
    }
    var card = btn.closest('.card') || node;
    var title = $('.card-title', card) || $('h1');
    var skuEl = $$('.mono', card).filter(function (m) { return /^[A-Z0-9][A-Z0-9-]{3,}$/i.test(txt(m)); })[0];
    var sku = skuEl ? txt(skuEl) : '';
    if (!sku) { var art = $$('.mono span, span').filter(function (s) { return /^Артикул /.test(txt(s)); })[0]; if (art) sku = txt(art).replace('Артикул ', ''); }
    var ph = $('[data-photo]', card) || (title && title.tagName === 'H1' ? $('figure[data-photo], [data-screen-label] [data-photo]') : null);
    return [{ sku: sku, name: txt(title), price: parseMoney(txt(prices[0])), img: bgUrl(ph), qty: qtyNear(btn) }];
  }

  function addToCart(btn) {
    var items = extractItems(btn);
    if (!items.length) { toast('Не удалось определить позицию. Откройте карточку товара.'); return false; }
    var cart = getCart() || [];
    items.forEach(function (it) {
      // одна позиция: совпал артикул, а если у кого-то его нет — совпало название
      var ex = cart.filter(function (c) { return c.sku && it.sku ? c.sku === it.sku : c.name === it.name; })[0];
      if (ex) ex.qty += it.qty || 1;
      else cart.push({ sku: it.sku, name: it.name, note: it.note || '', img: it.img || '', price: it.price, qty: it.qty || 1 });
    });
    setCart(cart);
    toast((items.length > 1 ? 'Добавлено позиций: ' + items.length : 'Добавлено: ' + items[0].name) + '. В корзине позиций: ' + cart.length);
    return true;
  }

  // ── страница /korzina/ ──
  var cartPage = null;
  function initCartPage() {
    var first = $('.cartrow');
    if (!first) return;
    var wrap = first.parentElement;
    // демо-позиции макета → модель (цена за штуку = сумма / количество)
    var demo = $$('.cartrow', wrap).map(function (row) {
      var info = row.children[1], spans = info ? info.children : [];
      var q = parseInt(txt(row.querySelector('.seg-opt.mono')), 10) || 1;
      var sum = parseMoney(txt([].slice.call(row.querySelectorAll('.mono')).filter(isPrice).pop()));
      return { sku: txt(spans[0]), name: txt(spans[1]), note: txt(spans[2]), img: bgUrl(row.querySelector('[data-photo]')), price: Math.round(sum / q), qty: q };
    });
    cartPage = { wrap: wrap, demo: demo };
    renderCart();
    window.PK_BUS_READY(function (B) { // bus: строка честности под кнопкой оформления
      var go = $$('button').filter(function (b) { return /^оформить и выставить счёт/i.test(txt(b)); })[0];
      if (!go || $('.pk-bus-note')) return;
      B.css(); var n = document.createElement('p'); n.className = 'pk-bus-note'; n.textContent = B.NOTE;
      go.insertAdjacentElement('afterend', n);
    });

    wrap.addEventListener('click', function (e) {
      var step = e.target.closest('[data-step]'), del = e.target.closest('[data-del]');
      if (!step && !del) return;
      var items = currentItems(), i = +(step || del).closest('.cartrow').getAttribute('data-i');
      if (del) { var name = items[i].name; items.splice(i, 1); saveItems(items); renderCart(); toast('Удалено: ' + name); var f = $('[data-del]', wrap) || $('a', wrap); if (f) f.focus(); return; }
      items[i].qty = Math.max(1, items[i].qty + (+step.getAttribute('data-step'))); saveItems(items); renderCart(i, 'step');
    });
    wrap.addEventListener('input', function (e) {
      if (!e.target.matches('.pk-qty')) return;
      var items = currentItems(), i = +e.target.closest('.cartrow').getAttribute('data-i');
      var v = parseInt(e.target.value, 10);
      if (!(v >= 1)) return; // пустое поле — ждём ввода, сумму не ломаем
      items[i].qty = Math.min(v, 99999); saveItems(items); paintTotals(items); paintRowSum(e.target.closest('.cartrow'), items[i]);
    });
    wrap.addEventListener('change', function (e) {
      if (e.target.matches('.pk-qty') && !(parseInt(e.target.value, 10) >= 1)) { e.target.value = currentItems()[+e.target.closest('.cartrow').getAttribute('data-i')].qty; }
    });
  }
  function currentItems() { return getCart() || cartPage.demo.map(function (x) { return Object.assign({}, x); }); }
  function saveItems(items) { setCart(items); } // любая правка превращает демо-корзину в пользовательскую
  function paintRowSum(row, it) { var s = row.querySelector('.pk-sum'); if (s) s.textContent = money(it.price * it.qty); }

  function renderCart(focusIdx, focusKind) {
    var wrap = cartPage.wrap, items = currentItems();
    $$('.cartrow, .pk-cart-empty', wrap).forEach(function (r) { r.remove(); });
    if (!items.length) {
      var em = document.createElement('div'); em.className = 'pk-cart-empty';
      em.innerHTML = '<span class="ico i-ui-cart" aria-hidden="true"></span><strong>Корзина пуста</strong><span>Добавьте позиции из каталога.</span><a class="btn btn-secondary" href="' + BASE + 'katalog/nasosy/">Перейти в каталог</a>';
      wrap.appendChild(em);
    }
    items.forEach(function (it, i) {
      var row = document.createElement('div'); row.className = 'cartrow'; row.setAttribute('data-i', i);
      row.innerHTML =
        '<div class="ph duotone" data-photo="1" style="' + (it.img ? 'background: url(&quot;' + esc(it.img) + '&quot;) center center / cover no-repeat; ' : '') + 'height: 76px;"></div>' +
        '<div style="display: flex; flex-direction: column; gap: 3px;">' +
          (it.sku ? '<span class="mono" style="font-size: 11px; color: var(--color-neutral-600);">' + esc(it.sku) + '</span>' : '') +
          '<span style="font-family: var(--font-heading); font-weight: 600; font-size: 18px;">' + esc(it.name) + '</span>' +
          '<span style="font-size: 13px; color: var(--color-neutral-700);">' + (it.note ? esc(it.note) + ' · ' : '') + money(it.price) + ' за&nbsp;шт.</span>' +
        '</div>' +
        '<div style="display: flex; align-items: center; gap: 12px;">' +
          '<div class="seg"><button type="button" class="seg-opt pk-step" data-step="-1" aria-label="Уменьшить количество">−</button>' +
          '<input class="seg-opt mono pk-qty" type="number" inputmode="numeric" min="1" value="' + it.qty + '" aria-label="Количество: ' + esc(it.name) + '">' +
          '<button type="button" class="seg-opt pk-step" data-step="1" aria-label="Увеличить количество">+</button></div>' +
          '<span class="mono pk-sum" style="font-size: 19px; min-width: 120px; text-align: right;">' + money(it.price * it.qty) + '</span>' +
          '<button type="button" class="pk-del" data-del="1" aria-label="Удалить из корзины: ' + esc(it.name) + '" title="Удалить">×</button>' +
        '</div>';
      wrap.appendChild(row);
    });
    paintTotals(items);
    if (focusIdx != null) { var r = wrap.querySelector('.cartrow[data-i="' + focusIdx + '"]'); if (r && focusKind === 'step') { var b = document.activeElement; if (!b || b === document.body) (r.querySelector('.pk-qty') || r).focus(); } }
  }

  function paintTotals(items) {
    var sum = items.reduce(function (a, x) { return a + x.price * x.qty; }, 0);
    var vat = Math.round(sum * 22 / 122);
    $$('.text-muted').forEach(function (l) {
      var v = l.nextElementSibling; if (!v) return;
      var t = txt(l);
      if (/^Оборудование/.test(t)) { l.textContent = 'Оборудование, ' + items.length + ' поз.'; v.textContent = money(sum); }
      else if (/НДС/.test(t)) v.textContent = money(vat);
    });
    $$('span').forEach(function (s) { if (txt(s) === 'К оплате' && s.nextElementSibling) s.nextElementSibling.textContent = money(sum); });
  }

  // ═════════ Сравнение ═════════
  function addToCompare() {
    var n = LS.get('compare', null);
    if (n == null) { var el = $('header a[href$="sravnenie/"] .mono'); n = el ? parseInt(txt(el), 10) || 0 : 0; }
    n += 1; LS.set('compare', n); paintCounters();
    toast('Добавлено к сравнению. Позиций в сравнении: ' + n);
  }

  // ═════════ Формы ═════════
  function validate(scope) {
    var bad = [];
    $$('input.input, input[required], textarea[required]', scope).forEach(function (inp) {
      if (/^(radio|checkbox|hidden|file|submit|button)$/.test(inp.type) || inp.closest('header')) return;
      var err = inp.parentElement.querySelector('.pk-err');
      if (inp.value.trim()) { inp.classList.remove('pk-invalid'); inp.removeAttribute('aria-invalid'); if (err) err.remove(); return; }
      inp.classList.add('pk-invalid'); inp.setAttribute('aria-invalid', 'true');
      if (!err) {
        err = document.createElement('span'); err.className = 'pk-err'; err.textContent = 'Заполните поле';
        err.id = 'pk-err-' + Math.random().toString(36).slice(2, 8); inp.setAttribute('aria-describedby', err.id);
        inp.insertAdjacentElement('afterend', err);
      }
      bad.push(inp);
    });
    if (bad.length) bad[0].focus();
    return !bad.length;
  }
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.classList && t.classList.contains('pk-invalid') && t.value.trim()) {
      t.classList.remove('pk-invalid'); t.removeAttribute('aria-invalid');
      var err = t.parentElement.querySelector('.pk-err'); if (err) err.remove();
    }
  });

  function successHTML(title) {
    return '<div class="pk-success" role="status" tabindex="-1"><span class="pk-success-ico" aria-hidden="true"><span class="ico i-ui-approval"></span></span>' +
      '<strong>' + (title || 'Заявка принята (демо-режим): данные не отправляются') + '</strong>' +
      '<span>Это демонстрационная версия сайта — форма ничего не передаёт на сервер.</span></div>';
  }

  function submitForm(btn) {
    // область полей: ближайшая карточка/форма, где есть .field; иначе — ближайший родитель с полем ввода
    var box = btn.closest('form, .card, .blueprint'), scope = null;
    for (var n = btn.parentElement; n && n !== document.body; n = n.parentElement) { if (n.querySelector('.field')) { scope = n; break; } }
    if (!scope) { // короткие формы без .field: чат, подписка
      var row = btn.parentElement, inp = row && row.querySelector('input.input, textarea.input');
      if (inp) { if (!validate(row)) return; inp.value = ''; toast('Демо-режим: сообщение не отправляется.'); return; }
      toast('Готово (демо-режим): данные не отправляются.');
      if (/подпис/i.test(txt(btn))) { btn.textContent = 'Вы подписаны'; btn.disabled = true; }
      return;
    }
    if (!validate(scope)) { toast('Заполните обязательные поля'); return; }
    var target = box || scope; // в корзине поля в соседнем блоке — заменяем карточку «Итого»
    var busTitle = null; // bus
    if (cartPage && document.body.contains(cartPage.wrap)) { busTitle = emitOrder(scope); setCart([]); renderCart(); }
    var keep = $$('.corner', target);
    target.innerHTML = successHTML(busTitle);
    keep.forEach(function (c) { target.insertBefore(c, target.firstChild); });
    var s = $('.pk-success', target); if (s) s.focus();
  }

  // bus: оформление в корзине → событие order.created для кабинетов закупщика, поставщика и оператора
  function emitOrder(scope) {
    var B = window.PK_BUS; if (!B) return null;
    var items = currentItems().filter(function (x) { return x.qty > 0; });
    if (!items.length) return null;
    var f = {};
    $$('.field', scope.closest('main, #main, [role="main"]') || document).forEach(function (fl) {
      var l = txt($('label', fl)), c = $('input.input, textarea.input', fl); if (l && c) f[l] = c.value.trim();
    });
    var pay = $$('input[type="radio"][name="pay"]').filter(function (r) { return r.checked; })[0];
    var payLabel = pay ? txt(pay.closest('label')) : 'Счёт для юрлица';
    var addr = f['Адрес доставки'] || '', city = (addr.match(/(?:г\.\s*)?([А-ЯЁ][а-яё-]+)/) || [])[1] || '';
    var order = B.nextOrderId(), total = items.reduce(function (a, x) { return a + x.price * x.qty; }, 0);
    var ev = B.emit('order.created', {
      order: order, total: total, payment: payLabel, company: f['Плательщик'] || '', inn: f['ИНН'] || '', address: addr, city: city, contact: f['Контакт на объекте'] || '',
      items: items.map(function (x) { return { sku: x.sku, name: x.name, qty: x.qty, price: x.price }; })
    });
    return ev ? 'Заказ ' + order + ' оформлен (демо): счёт и статус — в кабинете закупщика' : null;
  }

  // ═════════ Делегированные клики ═════════
  var CART_RE = /^(в корзину|добавить в корзину|быстрый счёт)$/i;
  var CMP_RE = /^\+?\s*(сравнить|к сравнению|добавить к сравнению)$/i;
  var FORM_RE = /^(отправить|зарегистрировать|оформить и выставить счёт|подписаться)/i;

  document.addEventListener('click', function (e) {
    var h = e.target.closest('[data-href]');
    if (h && !e.target.closest('a,button,input,select,textarea,summary,label')) { location.href = h.getAttribute('data-href'); return; }

    // степпер количества вне корзины (карточка товара)
    var opt = e.target.closest('.seg > span.seg-opt');
    if (opt && !opt.closest('.cartrow')) {
      var sign = txt(opt) === '+' ? 1 : txt(opt) === '−' ? -1 : 0, num = opt.parentElement.querySelector('.seg-opt.mono');
      if (sign && num) { num.textContent = Math.max(1, (parseInt(txt(num), 10) || 1) + sign); return; }
    }

    var el = e.target.closest('a, button');
    if (!el || el.closest('.pk-drawer')) return;
    var t = txt(el), href = el.getAttribute('href') || '';
    var demo = el.hasAttribute('data-demo') || el.tagName === 'BUTTON';

    if (CART_RE.test(t) && !/korzina\/?$/.test(href)) {
      e.preventDefault();
      if (addToCart(el) && /быстрый счёт/i.test(t)) setTimeout(function () { location.href = BASE + 'korzina/'; }, 600);
      return;
    }
    if (CMP_RE.test(t)) { e.preventDefault(); addToCompare(); return; }
    if (demo && FORM_RE.test(t)) { e.preventDefault(); submitForm(el); return; }
    if (!el.hasAttribute('data-demo')) return;

    if (el.tagName === 'A' && href === '#') e.preventDefault();
    if (/^сбросить$/i.test(t) && filters) { resetFilters(); return; }
    var lt = t.toLowerCase();
    if (/сохран|оформ|подключ|позвон|загруз|получить|войти|принять|согласов/.test(lt)) toast('Это демонстрационная версия сайта: данные никуда не отправляются.');
    else if (/найти/.test(lt)) search(el);
    else if (el.tagName === 'BUTTON') toast('Демонстрационная версия: действие показано в макете.');
  });

  // ── поиск: Enter или «Найти» → страница результатов ──
  function search(from) {
    var box = from && from.parentElement && from.parentElement.querySelector('input');
    var q = box ? box.value.trim() : '';
    location.href = BASE + 'poisk/' + (q ? '?q=' + encodeURIComponent(q) : '');
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { hideToast(); closeMenu(true); return; }
    if (e.key !== 'Enter' || !e.target.matches || !e.target.matches('input.input')) return;
    var p = e.target.placeholder || '';
    if (/модель|артикул|название/i.test(p)) { e.preventDefault(); search(e.target.nextElementSibling || e.target); }
  });
  var q = new URLSearchParams(location.search).get('q');
  if (q) { var lab = [].find.call(document.querySelectorAll('.mono'), function (x) { return /^Поиск: «/.test(x.textContent); }); if (lab) lab.textContent = 'Поиск: «' + q + '»'; }

  // ═════════ Фильтры каталога ═════════
  var filters = null;
  function initFilters() {
    var boxes = $$('label').filter(function (l) {
      var s = l.firstElementChild;
      return s && s.tagName === 'SPAN' && /width:\s*14px;\s*height:\s*14px/.test(s.getAttribute('style') || '') && !l.closest('table');
    });
    if (!boxes.length) return;
    var found = $$('span').filter(function (s) { return /^Найдено /.test(txt(s)); })[0];
    var chipsRow = found && found.parentElement;
    var grid = chipsRow && chipsRow.nextElementSibling;
    var cards = grid ? $$(':scope > .card', grid) : [];
    cards.forEach(function (c, i) { c._pkIdx = i; });
    filters = { boxes: boxes, found: found, foundText: txt(found), chipsRow: chipsRow, grid: grid, cards: cards, pager: grid && grid.nextElementSibling };

    boxes.forEach(function (l) {
      l.setAttribute('role', 'checkbox'); l.setAttribute('tabindex', '0');
      l.setAttribute('aria-checked', String(isOn(l)));
      l.addEventListener('click', function (e) { e.preventDefault(); setOn(l, !isOn(l)); applyFilters(); });
      l.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setOn(l, !isOn(l)); applyFilters(); } });
    });
    if (chipsRow) chipsRow.addEventListener('click', function (e) {
      var c = e.target.closest('[data-chip]'); if (!c) return;
      setOn(boxes[+c.getAttribute('data-chip')], false); applyFilters();
    });
    if (chipsRow) chipsRow.addEventListener('keydown', function (e) {
      var c = e.target.closest('[data-chip]'); if (c && (e.key === 'Enter' || e.key === ' ' || e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); c.click(); }
    });
    applyFilters();

    // сортировка
    var sel = $$('select').filter(function (s) { return /дешёв/i.test(txt(s)); })[0];
    if (sel && grid) sel.addEventListener('change', function () {
      var mode = txt(sel.options[sel.selectedIndex]), arr = cards.slice();
      var days = function (c) { var m = txt(c).match(/Отгрузка\s+(\d+)/); return m ? +m[1] : 999; };
      var price = function (c) { var p = $$('.mono', c).filter(isPrice)[0]; return p ? parseMoney(txt(p)) : 0; };
      if (/дешёв/i.test(mode)) arr.sort(function (a, b) { return price(a) - price(b) || a._pkIdx - b._pkIdx; });
      else if (/срок/i.test(mode)) arr.sort(function (a, b) { return days(a) - days(b) || a._pkIdx - b._pkIdx; });
      else arr.sort(function (a, b) { return a._pkIdx - b._pkIdx; });
      arr.forEach(function (c) { grid.appendChild(c); });
    });
  }
  function isOn(l) { return /accent/.test(l.firstElementChild.style.background || l.firstElementChild.style.backgroundColor); }
  function setOn(l, on) {
    var s = l.firstElementChild;
    s.style.background = on ? 'var(--color-accent)' : 'transparent';
    s.style.borderColor = on ? 'var(--color-accent)' : 'var(--color-divider)';
    l.setAttribute('aria-checked', String(on));
  }
  function groupOf(l) { var t = l.parentElement.querySelector('span.mono'); return txt(t); }
  function labelOf(l) { return txt(l); }
  function resetFilters() { filters.boxes.forEach(function (l) { setOn(l, false); }); applyFilters(); toast('Фильтры сброшены'); }

  function applyFilters() {
    var F = filters; if (!F.chipsRow) return;
    $$('.tag', F.chipsRow).forEach(function (t) { t.remove(); });
    var makers = [];
    F.boxes.forEach(function (l, i) {
      var g = groupOf(l), name = labelOf(l);
      if (/производител/i.test(g)) { if (isOn(l)) makers.push(name); }
      if (!isOn(l)) return;
      var chip = document.createElement('span');
      chip.className = 'tag tag-accent'; chip.style.cssText = 'font-size: 12px; padding: 6px 11px; cursor: pointer;';
      chip.setAttribute('data-chip', i); chip.setAttribute('role', 'button'); chip.setAttribute('tabindex', '0');
      var label = /подача/i.test(g) ? 'Подача ' + name + '\u00a0м³/ч' : name;
      chip.setAttribute('aria-label', 'Снять фильтр: ' + label);
      chip.textContent = label + ' ×';
      F.chipsRow.insertBefore(chip, F.found);
    });
    // в демо-выдаче все карточки — Grundfos: выбран другой производитель без Grundfos → пусто
    var empty = makers.length > 0 && makers.indexOf('Grundfos') < 0;
    if (F.grid) F.grid.hidden = empty;
    if (F.pager) F.pager.hidden = empty;
    F.found.textContent = empty ? 'Найдено 0' : F.foundText;
    var box = F.chipsRow.parentElement.querySelector('.pk-empty');
    if (empty && !box) {
      box = document.createElement('div'); box.className = 'pk-empty blueprint'; box.setAttribute('role', 'status');
      box.innerHTML = '<strong>Нет позиций по фильтру</strong><span>Измените условия или сбросьте фильтры.</span><button type="button" class="btn btn-secondary">Сбросить</button>';
      box.querySelector('button').addEventListener('click', function () { resetFilters(); });
      F.grid.insertAdjacentElement('afterend', box);
    } else if (!empty && box) box.remove();
  }

  // ═════════ Шапка: мобильное меню и тень при прокрутке ═════════
  var header = $('header'), drawer, scrim, menuBtn;
  function initMenu() {
    var nav = header && $('nav', header);
    if (!nav) return;
    var row = header.firstElementChild;
    menuBtn = document.createElement('button');
    menuBtn.type = 'button'; menuBtn.className = 'btn btn-secondary pk-menu-btn';
    menuBtn.setAttribute('aria-expanded', 'false'); menuBtn.setAttribute('aria-controls', 'pk-drawer');
    menuBtn.innerHTML = '<span class="ico i-ui-menu" aria-hidden="true"></span><span>Меню</span>';
    var logo = row && row.firstElementChild;
    if (logo && logo.tagName === 'A') logo.insertAdjacentElement('afterend', menuBtn); else if (row) row.insertBefore(menuBtn, row.firstChild);

    scrim = document.createElement('div'); scrim.className = 'pk-scrim'; scrim.hidden = true;
    drawer = document.createElement('div'); drawer.className = 'pk-drawer'; drawer.id = 'pk-drawer';
    drawer.setAttribute('role', 'dialog'); drawer.setAttribute('aria-modal', 'true'); drawer.setAttribute('aria-label', 'Меню сайта');
    var links = $$('a', nav).map(function (a) { return '<a href="' + esc(a.getAttribute('href')) + '"' + (a.getAttribute('aria-current') ? ' aria-current="page"' : '') + '>' + a.innerHTML + '</a>'; }).join('');
    var top = header.previousElementSibling;
    var topLinks = top ? $$('a', top).map(function (a) { return '<a class="pk-drawer-sub" href="' + esc(a.getAttribute('href')) + '">' + a.innerHTML + '</a>'; }).join('') : '';
    drawer.innerHTML = '<div class="pk-drawer-head"><strong>Меню</strong><button type="button" class="pk-drawer-close" aria-label="Закрыть меню">×</button></div>' +
      '<nav aria-label="Разделы">' + links + '</nav>' + (topLinks ? '<div class="pk-drawer-extra">' + topLinks + '</div>' : '');
    drawer.hidden = true;
    document.body.appendChild(scrim); document.body.appendChild(drawer);

    menuBtn.addEventListener('click', function () { drawer.classList.contains('on') ? closeMenu() : openMenu(); });
    scrim.addEventListener('click', function () { closeMenu(); });
    drawer.querySelector('.pk-drawer-close').addEventListener('click', function () { closeMenu(); });
    document.addEventListener('click', function (e) {
      if (drawer.classList.contains('on') && !drawer.contains(e.target) && !menuBtn.contains(e.target)) closeMenu(false);
    });
    // держим фокус внутри панели
    drawer.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = $$('a, button', drawer), a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    });
    window.addEventListener('resize', function () { if (window.innerWidth > 760 && drawer.classList.contains('on')) closeMenu(false); });
  }
  function openMenu() {
    drawer.hidden = false; scrim.hidden = false;
    requestAnimationFrame(function () { drawer.classList.add('on'); scrim.classList.add('on'); });
    menuBtn.setAttribute('aria-expanded', 'true'); document.documentElement.classList.add('pk-lock');
    var f = $('a', drawer); if (f) f.focus();
  }
  function closeMenu(fromEsc) {
    if (!drawer || !drawer.classList.contains('on')) return;
    drawer.classList.remove('on'); scrim.classList.remove('on');
    menuBtn.setAttribute('aria-expanded', 'false'); document.documentElement.classList.remove('pk-lock');
    setTimeout(function () { if (!drawer.classList.contains('on')) { drawer.hidden = true; scrim.hidden = true; } }, 250);
    if (fromEsc !== false) menuBtn.focus();
  }

  function onScroll() { if (header) header.classList.toggle('pk-scrolled', window.pageYOffset > 8); }

  // ── карусели «Статьи по теме» ──
  $$('[data-carousel]').forEach(function (wrap) {
    var track = wrap.querySelector('[data-track]');
    $$('[data-dir]', wrap).forEach(function (b) {
      b.removeAttribute('data-demo');
      b.addEventListener('click', function () { track.scrollBy({ left: +b.getAttribute('data-dir') * track.clientWidth * 0.9, behavior: 'smooth' }); });
    });
    // стрелки неактивны на краях ленты
    function edges() {
      if (!track) return;
      var max = track.scrollWidth - track.clientWidth - 2;
      $$('[data-dir]', wrap).forEach(function (b) {
        var off = +b.getAttribute('data-dir') < 0 ? track.scrollLeft <= 2 : track.scrollLeft >= max;
        b.disabled = off; b.setAttribute('aria-disabled', off ? 'true' : 'false'); b.style.opacity = off ? '.45' : '';
      });
    }
    if (track) { track.addEventListener('scroll', edges, { passive: true }); window.addEventListener('resize', edges); edges(); }
  });

  // ── вкладки админки: якоря ──
  $$('[data-admin-tabs] button').forEach(function (b, i) {
    b.removeAttribute('data-demo');
    var ids = ['log', 'prices', 'sources', 'integrations', 'channels', 'content', 'seo'];
    b.addEventListener('click', function () { var el = document.getElementById(ids[i]); if (el) el.scrollIntoView({ behavior: 'smooth' }); });
  });

  // ═════════ Доступность (a11y 14.09.26) ═════════
  function initA11y() {
    // JS-1: имена кнопок-иконок и полей без подписи
    if (menuBtn) menuBtn.setAttribute('aria-label', 'Меню');
    $$('.hide-m').forEach(function (s) { var b = s.closest('button, a'); if (b && !b.getAttribute('aria-label')) b.setAttribute('aria-label', txt(s)); });
    $$('button, a').forEach(function (b) { if (!txt(b) && !b.getAttribute('aria-label') && $('[class*="i-ui-search"]', b)) b.setAttribute('aria-label', 'Найти'); });
    $$('input.input').forEach(function (i) {
      if (i.getAttribute('aria-label') || i.id && $('label[for="' + i.id + '"]')) return;
      var p = i.placeholder || '';
      if (/модель|артикул|название/i.test(p)) i.setAttribute('aria-label', 'Поиск по модели, артикулу или названию');
      else if (/^от\s/i.test(p)) i.setAttribute('aria-label', 'Цена от, ₽');
      else if (/^до\s/i.test(p)) i.setAttribute('aria-label', 'Цена до, ₽');
    });
    $$('select').forEach(function (s) {
      if (s.getAttribute('aria-label')) return;
      s.setAttribute('aria-label', /дешёв|релевант/i.test(txt(s)) ? 'Сортировка' : /Все направления/i.test(txt(s)) ? 'Рубрика' : 'Выбор');
    });
    $$('header a').forEach(function (a) { // «3Корзина» → «Корзина: 3»
      var n = $('span.mono[style*="position: absolute"]', a); if (!n) return;
      var name = txt(a).replace(txt(n), '').trim(); if (name) a.setAttribute('aria-label', name + ': ' + txt(n));
    });

    // JS-2: label ↔ поле и autocomplete
    var AC = [[/телефон/i, 'tel', 'tel'], [/почт|e-?mail/i, 'email', 'email'], [/контакт|имя|лицо/i, 'name'], [/компани|плательщик|организац/i, 'organization'], [/адрес/i, 'street-address'], [/инн/i, 'off']];
    $$('.field').forEach(function (f, i) {
      var l = $('label', f), c = $('input, select, textarea', f); if (!l || !c) return;
      if (!c.id) c.id = 'pk-f' + i;
      if (l.tagName === 'LABEL') l.htmlFor = c.id; else { l.id = l.id || 'pk-l' + i; c.setAttribute('aria-labelledby', l.id); }
      var t = txt(l);
      for (var k = 0; k < AC.length; k++) if (AC[k][0].test(t)) { c.setAttribute('autocomplete', AC[k][1]); if (AC[k][2] && c.tagName === 'INPUT') c.type = AC[k][2]; break; }
      if (/инн/i.test(t)) c.setAttribute('inputmode', 'numeric');
    });

    // JS-3: степпер карточки товара — клавиатура
    $$('.seg > span.seg-opt').forEach(function (s) {
      var v = txt(s); if (s.closest('.cartrow')) return;
      if (v === '+' || v === '−') {
        s.setAttribute('role', 'button'); s.setAttribute('tabindex', '0');
        s.setAttribute('aria-label', v === '+' ? 'Увеличить количество' : 'Уменьшить количество');
        s.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); s.click(); } });
      } else if (/^\d+$/.test(v)) { s.setAttribute('role', 'status'); s.setAttribute('aria-live', 'polite'); s.setAttribute('aria-label', 'Количество'); }
    });

    // JS-4: фото — информативные получают имя, декоративные скрываются
    var h1 = txt($('h1'));
    $$('[data-photo], .gal > span').forEach(function (el, i) {
      if (el.getAttribute('role') === 'img' || el.hasAttribute('aria-hidden')) return;
      var inLink = el.closest('a, [data-href]'), main = el.matches('figure') || el.closest('.split > :first-child');
      if (main && !inLink) {
        el.setAttribute('role', 'img');
        el.setAttribute('aria-label', h1 + (el.closest('.gal') ? ' — фото ' + ([].indexOf.call(el.parentElement.children, el) + 1) : ' — фото'));
      } else el.setAttribute('aria-hidden', 'true');
    });
    $$('.gal[role="list"] > span[role="img"]').forEach(function (s) { var w = document.createElement('span'); w.setAttribute('role', 'listitem'); s.parentElement.insertBefore(w, s); w.appendChild(s); });
    $$('span').forEach(function (s) { if (/^★+$/.test(txt(s))) s.setAttribute('aria-hidden', 'true'); });

    // JS-5: фильтры и бегущая строка
    if (filters) {
      if (filters.found) { filters.found.setAttribute('role', 'status'); filters.found.setAttribute('aria-live', 'polite'); }
      filters.boxes.forEach(function (l) { var g = l.parentElement, t = $('span.mono', g); if (t && !g.getAttribute('role')) { t.id = t.id || 'pk-g' + Math.random().toString(36).slice(2, 7); g.setAttribute('role', 'group'); g.setAttribute('aria-labelledby', t.id); } });
    }
    $$('.marquee-wrap').forEach(function (w) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'pk-marquee-toggle'; b.textContent = 'Пауза';
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () { var on = w.classList.toggle('pk-paused'); b.textContent = on ? 'Продолжить' : 'Пауза'; b.setAttribute('aria-pressed', String(on)); });
      w.insertAdjacentElement('beforebegin', b);
    });
  }

  // ── старт ──
  paintCounters();
  initCartPage();
  initFilters();
  initMenu();
  initA11y();
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
})();

// Ленивые фоновые фото: data-bg проставляет сборщик (optimizeImages)
(function () {
  var els = document.querySelectorAll('[data-bg]');
  if (!els.length) return;
  var webpSet = window.CSS && CSS.supports && CSS.supports('background-image', 'image-set(url("a.webp") type("image/webp"))');
  function show(el) {
    el.style.backgroundImage = webpSet ? el.getAttribute('data-bg') : 'url("' + el.getAttribute('data-bg-jpg') + '")';
    el.removeAttribute('data-bg');
  }
  if (!('IntersectionObserver' in window)) { [].forEach.call(els, show); return; }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } });
  }, { rootMargin: '600px 0px' });
  [].forEach.call(els, function (el) { io.observe(el); });
  window.addEventListener('beforeprint', function () { [].forEach.call(document.querySelectorAll('[data-bg]'), show); });
})();

// Каталог: ?tip=<подкатегория> из страницы направления — показываем выбранный тип в заголовке выдачи
(function () {
  var tip = new URLSearchParams(location.search).get('tip');
  if (!tip) return;
  var h1 = document.querySelector('h1');
  if (h1 && /^Насосы$/.test(h1.textContent.trim())) h1.textContent = 'Насосы: ' + tip.toLowerCase();
})();

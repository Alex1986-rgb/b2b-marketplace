// Каталог категории (katalog/<категория>/, генератор tools/gen_catalog.js):
// фильтры по производителю, подкатегории, наличию и цене, сортировка, счётчик, пустое состояние, ?tip=<подкатегория>.
(function () {
  var root = document.querySelector('.pk-cat[data-cat]');
  if (!root) return;
  var list = root.querySelector('[data-cat-list]');
  var items = [].slice.call(list.querySelectorAll('.pk-cat-item'));
  var found = root.querySelector('[data-cat-found]');
  var empty = root.querySelector('[data-cat-empty]');
  var chips = root.querySelector('[data-cat-chips]');
  var sort = root.querySelector('[data-cat-sort]');
  var minEl = root.querySelector('[data-cat-min]'), maxEl = root.querySelector('[data-cat-max]');
  var boxes = [].slice.call(root.querySelectorAll('.pk-cat-side input[type=checkbox]'));
  var h1 = root.querySelector('[data-cat-h1]');
  var title = root.getAttribute('data-cat-title') || (h1 ? h1.textContent : '');
  var LABEL = { stock: { in: 'В наличии', order: 'Под заказ' } };

  function num(el) { var v = el && el.value.trim(); return v === '' || v == null ? null : Math.max(0, +v || 0); }
  function checked(group) { return boxes.filter(function (b) { return b.name === group && b.checked; }).map(function (b) { return b.value; }); }

  function apply() {
    var brand = checked('brand'), tip = checked('tip'), stock = checked('stock');
    var lo = num(minEl), hi = num(maxEl), n = 0;
    items.forEach(function (it) {
      var price = it.getAttribute('data-price'), p = price === '' ? null : +price;
      var ok = (!brand.length || brand.indexOf(it.getAttribute('data-brand')) >= 0)
        && (!tip.length || tip.indexOf(it.getAttribute('data-tip')) >= 0)
        && (!stock.length || stock.indexOf(it.getAttribute('data-stock')) >= 0)
        && (lo == null || (p != null && p >= lo))
        && (hi == null || (p != null && p <= hi));
      it.hidden = !ok; if (ok) n++;
    });
    found.textContent = 'Найдено ' + n;
    list.hidden = n === 0;
    empty.hidden = n !== 0;
    renderChips(lo, hi);
    // заголовок: одна выбранная подкатегория → «Категория: подкатегория»
    if (h1) h1.textContent = tip.length === 1 ? title + ': ' + tip[0].charAt(0).toLowerCase() + tip[0].slice(1) : title;
  }

  function chip(text, onRemove) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'tag tag-accent pk-cat-chip';
    b.setAttribute('aria-label', 'Снять фильтр: ' + text);
    b.textContent = text + ' ×';
    b.addEventListener('click', onRemove);
    chips.appendChild(b);
  }
  function renderChips(lo, hi) {
    chips.textContent = '';
    boxes.forEach(function (b) {
      if (!b.checked) return;
      var text = LABEL[b.name] ? LABEL[b.name][b.value] : b.value;
      chip(text, function () { b.checked = false; apply(); });
    });
    var fmt = function (v) { return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); };
    if (lo != null || hi != null) chip('Цена ' + (lo != null ? 'от ' + fmt(lo) + ' ' : '') + (hi != null ? 'до ' + fmt(hi) + ' ' : '') + '₽', function () { minEl.value = ''; maxEl.value = ''; apply(); });
  }

  function reset() {
    boxes.forEach(function (b) { b.checked = false; });
    if (minEl) minEl.value = ''; if (maxEl) maxEl.value = '';
    apply();
    if (history.replaceState && location.search) history.replaceState(null, '', location.pathname + location.hash);
  }

  function doSort() {
    var mode = sort.value, arr = items.slice();
    var price = function (it, dir) { var v = it.getAttribute('data-price'); return v === '' ? (dir > 0 ? Infinity : -Infinity) : +v; };
    var idx = function (it) { return +it.getAttribute('data-i'); };
    if (mode === 'price-asc') arr.sort(function (a, b) { return price(a, 1) - price(b, 1) || idx(a) - idx(b); });
    else if (mode === 'price-desc') arr.sort(function (a, b) { return price(b, -1) - price(a, -1) || idx(a) - idx(b); });
    else if (mode === 'name') arr.sort(function (a, b) { return a.getAttribute('data-name').localeCompare(b.getAttribute('data-name'), 'ru') || idx(a) - idx(b); });
    else arr.sort(function (a, b) { return idx(a) - idx(b); });
    arr.forEach(function (it) { list.appendChild(it); });
  }

  boxes.forEach(function (b) { b.addEventListener('change', apply); });
  [minEl, maxEl].forEach(function (el) { if (el) el.addEventListener('input', apply); });
  if (sort) sort.addEventListener('change', doSort);
  [].forEach.call(root.querySelectorAll('[data-cat-reset]'), function (b) { b.addEventListener('click', function (e) { e.preventDefault(); reset(); }); });

  // мобильный вид: панель фильтров сворачивается
  var toggle = root.querySelector('[data-cat-toggle]'), side = root.querySelector('.pk-cat-side');
  var mq = window.matchMedia ? window.matchMedia('(max-width: 900px)') : null;
  function setOpen(open) {
    side.classList.toggle('is-collapsed', !open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Свернуть' : 'Показать';
  }
  if (toggle && side) {
    root.classList.add('pk-cat-js');
    toggle.addEventListener('click', function () { setOpen(side.classList.contains('is-collapsed')); });
    setOpen(!(mq && mq.matches));
  }

  // ?tip=<подкатегория>: предвыбор фильтра (точное совпадение без учёта регистра, иначе — по началу названия)
  var tipQ = (new URLSearchParams(location.search).get('tip') || '').trim().toLowerCase().replace(/ё/g, 'е');
  if (tipQ) {
    var tips = boxes.filter(function (b) { return b.name === 'tip'; });
    var norm = function (s) { return s.toLowerCase().replace(/ё/g, 'е'); };
    var hit = tips.filter(function (b) { return norm(b.value) === tipQ; })[0] || tips.filter(function (b) { return norm(b.value).indexOf(tipQ) === 0; })[0];
    if (hit) hit.checked = true;
  }
  apply();
})();

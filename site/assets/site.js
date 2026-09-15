// ПРОМКОНТУР — поведение статического сайта (без фреймворков).
(function () {
  var BASE = (document.querySelector('link[rel="manifest"]') || { getAttribute: function () { return '/site.webmanifest'; } }).getAttribute('href').replace('site.webmanifest', '');
  var LS = { get: function (k, d) { try { var v = localStorage.getItem('pk:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
             set: function (k, v) { try { localStorage.setItem('pk:' + k, JSON.stringify(v)); } catch (e) {} } };

  // ── тост ──
  var toastEl;
  function toast(text) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'pk-toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.textContent = text; toastEl.classList.add('on');
    clearTimeout(toastEl._t); toastEl._t = setTimeout(function () { toastEl.classList.remove('on'); }, 3200);
  }

  // ── элементы с data-href (переходы на не-ссылках) ──
  document.addEventListener('click', function (e) {
    var h = e.target.closest('[data-href]');
    if (h && !e.target.closest('a,button,input,select,textarea,summary')) { location.href = h.getAttribute('data-href'); return; }

    var btn = e.target.closest('[data-demo]');
    if (!btn) return;
    var t = (btn.textContent || '').trim().toLowerCase();
    if (btn.tagName === 'A' && btn.getAttribute('href') === '#') e.preventDefault();
    if (/в корзину|быстрый счёт/.test(t)) {
      var n = LS.get('cart', 3) + 1; LS.set('cart', n); paintCart();
      toast('Добавлено в корзину. Позиций: ' + n);
    } else if (/сравн/.test(t)) {
      toast('Добавлено к сравнению');
    } else if (/отправ|запрос|зарегистр|сохран|оформ|подключ|позвон|подписат|загруз|получить|войти|принять|согласов/.test(t)) {
      toast('Это демонстрационная версия сайта: данные никуда не отправляются.');
    } else if (/найти/.test(t)) {
      search(btn);
    } else if (btn.tagName === 'BUTTON') {
      toast('Демонстрационная версия: действие показано в макете.');
    }
  });

  // ── поиск: Enter или «Найти» → страница результатов ──
  function search(from) {
    var box = from && from.parentElement && from.parentElement.querySelector('input');
    var q = box ? box.value.trim() : '';
    location.href = BASE + 'poisk/' + (q ? '?q=' + encodeURIComponent(q) : '');
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || !e.target.matches('input.input')) return;
    var p = e.target.placeholder || '';
    if (/модель|артикул|название/i.test(p)) { e.preventDefault(); search(e.target.nextElementSibling || e.target); }
  });
  var q = new URLSearchParams(location.search).get('q');
  if (q) { var lab = [].find.call(document.querySelectorAll('.mono'), function (x) { return /^Поиск: «/.test(x.textContent); }); if (lab) lab.textContent = 'Поиск: «' + q + '»'; }

  // ── счётчик корзины в шапке ──
  function paintCart() {
    var n = LS.get('cart', null); if (n == null) return;
    [].forEach.call(document.querySelectorAll('header a[href$="korzina/"] .mono'), function (el) { el.textContent = n; });
  }
  paintCart();

  // ── карусели «Статьи по теме» ──
  [].forEach.call(document.querySelectorAll('[data-carousel]'), function (wrap) {
    var track = wrap.querySelector('[data-track]');
    [].forEach.call(wrap.querySelectorAll('[data-dir]'), function (b) {
      b.removeAttribute('data-demo');
      b.addEventListener('click', function () { track.scrollBy({ left: +b.getAttribute('data-dir') * track.clientWidth * 0.9, behavior: 'smooth' }); });
    });
  });

  // ── вкладки админки: якоря ──
  [].forEach.call(document.querySelectorAll('[data-admin-tabs] button'), function (b, i) {
    b.removeAttribute('data-demo');
    var ids = ['log', 'prices', 'sources', 'integrations', 'channels', 'content', 'seo'];
    b.addEventListener('click', function () { var el = document.getElementById(ids[i]); if (el) el.scrollIntoView({ behavior: 'smooth' }); });
  });
})();

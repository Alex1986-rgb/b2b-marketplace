#!/usr/bin/env node
// Сборка статического сайта ПРОМКОНТУР из макета Claude Design.
//   node tools/build_site.js            — собрать site/ (нужен сервер макета на :8150, поднимется сам)
//   BASE=/ node tools/build_site.js     — базовый путь (по умолчанию /b2b-marketplace/ для GitHub Pages)
//
// Как это работает: макет — один React-документ на 38 экранов. Для каждого экрана из routes.js
// скрипт переключает экран, перехватывает DCLogic.setState у каждой кнопки (так узнаёт, на какой
// экран она ведёт), превращает кнопки-переходы в настоящие <a href>, убирает служебную панель макета
// и сохраняет готовый HTML со своими title/description/canonical/OG/JSON-LD. Интерактив, который не
// является переходом (FAQ, «читать полностью», карусель), сделан в разметке на <details> и site.js.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');
const ROUTES = require('./routes');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'project');
const FINAL = path.join(ROOT, 'site');
const OUT = path.join(ROOT, '.site-build-' + process.pid); // собираем во временную папку, в конце подмена — site/ никогда не бывает полупустым
const BASE = process.env.BASE || '/b2b-marketplace/';
const ORIGIN = process.env.ORIGIN || 'https://alex1986-rgb.github.io';
const PORT = 8150;
const DOC = 'http://localhost:' + PORT + '/' + encodeURIComponent('Промышленный агрегатор.dc.html');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DATE = process.env.BUILD_DATE || new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' });

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const url = p => ORIGIN + BASE + p;

function up() {
  return new Promise(res => http.get(DOC, r => { r.resume(); res(r.statusCode === 200); }).on('error', () => res(false)));
}

function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }); }
function copyDir(a, b, skip = () => false) {
  fs.mkdirSync(b, { recursive: true });
  for (const f of fs.readdirSync(a)) {
    const s = path.join(a, f), d = path.join(b, f);
    if (skip(s)) continue;
    if (fs.statSync(s).isDirectory()) copyDir(s, d, skip); else fs.copyFileSync(s, d);
  }
}

// ── то, что выполняется внутри страницы макета ────────────────────────────────
function inPage(routes, base) {
  const P = DCLogic.prototype, orig = P.setState; let cap;
  P.setState = function (a) { cap = a; };
  const os = window.scrollTo; window.scrollTo = () => {};
  const root = document.getElementById('dc-root');
  for (const el of root.querySelectorAll('*')) {
    const pk = Object.keys(el).find(k => k.startsWith('__reactProps'));
    if (!pk || typeof el[pk].onClick !== 'function') continue;
    cap = undefined;
    try { el[pk].onClick({ preventDefault() {}, stopPropagation() {}, target: el, currentTarget: el }); } catch (e) {}
    if (cap && typeof cap === 'object' && cap.screen) el.setAttribute('data-go', cap.screen);
    else if (cap !== undefined) el.setAttribute('data-local', '1');
  }
  P.setState = orig; window.scrollTo = os;

  const c = root.cloneNode(true);
  const bar = c.querySelector('.screen-pick');
  if (bar) bar.closest('[style*="sticky"]').remove();

  for (const el of [...c.querySelectorAll('[data-go]')]) {
    const r = routes[el.getAttribute('data-go')];
    const href = base + (r && !r.skip ? r.path : '');
    el.removeAttribute('data-go');
    if (el.tagName === 'A') { el.setAttribute('href', href); continue; }
    if (el.tagName === 'BUTTON') {
      const a = document.createElement('a');
      for (const at of el.attributes) if (at.name !== 'type') a.setAttribute(at.name, at.value);
      a.setAttribute('href', href);
      a.innerHTML = el.innerHTML;
      if (!/text-decoration/.test(a.getAttribute('style') || '')) a.style.textDecoration = 'none';
      el.replaceWith(a);
    } else {
      el.setAttribute('data-href', href);
    }
  }
  // служебные обёртки движка
  for (const x of [...c.querySelectorAll('span.sc-interp')]) x.replaceWith(...x.childNodes);
  // ссылки, которым в макете не назначен экран
  const byText = { 'Политика конфиденциальности': 'politika-konfidencialnosti/', 'Условия использования': 'usloviya-ispolzovaniya/', 'Карта сайта': 'karta-sajta/', 'Весь каталог': 'napravleniya/', 'Блог': 'blog/', 'Контакты': 'kontakty/' };
  for (const a of c.querySelectorAll('a[href="#"]')) {
    const t = a.textContent.trim();
    if (byText[t]) a.setAttribute('href', base + byText[t]);
    else if (a.closest('[data-track]')) a.setAttribute('href', base + (/рабочей точке/.test(t) ? routes.article.path : routes.blog.path));
  }
  for (const a of c.querySelectorAll('footer a')) if (a.textContent.trim() === 'Контакты') a.setAttribute('href', base + 'kontakty/');
  // «мёртвые» ссылки и кнопки без перехода — помечаем для site.js (демо-режим)
  for (const a of c.querySelectorAll('a[href="#"]')) { a.setAttribute('href', '#'); a.setAttribute('data-demo', '1'); }
  for (const b of c.querySelectorAll('button:not([data-local])')) b.setAttribute('data-demo', '1');
  for (const el of c.querySelectorAll('[data-dc-tpl],[data-local]')) { el.removeAttribute('data-dc-tpl'); el.removeAttribute('data-local'); }
  // относительные картинки → от корня сайта
  for (const el of c.querySelectorAll('[style*="img/"]')) el.setAttribute('style', el.getAttribute('style').replace(/url\((["']?)img\//g, 'url($1' + base + 'img/'));

  // типографика: неразрывные пробелы в разрядах, перед единицами и после коротких слов
  const walker = document.createTreeWalker(c, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement && /^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentElement.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  const NB = ' ', THIN = ' ';
  for (let n; (n = walker.nextNode());) {
    let t = n.nodeValue; if (!/\S/.test(t)) continue;
    for (let k = 0; k < 2; k++) t = t.replace(/(\d) (\d{3})(?!\d)/g, '$1' + THIN + '$2');
    t = t.replace(/(\d) (₽|кВт|м³\/ч|м³|м(?![а-яё])|шт\.|%|мм|бар|дн(?:ей|я)|мес\.?|мин(?![а-яё])|ч(?![а-яё])|с(?![а-яё])|млн|тыс\.?|°C)/g, '$1' + NB + '$2');
    t = t.replace(/(^|[\s(«])(в|и|с|к|о|у|а|на|по|от|до|за|из|не|без|для|при) /gi, '$1$2' + NB);
    t = t.replace(/ (—|–) /g, NB + '$1 ');
    if (t !== n.nodeValue) n.nodeValue = t;
  }

  const styles = [...document.head.querySelectorAll('style')].map(s => s.textContent).join('\n');
  const h1 = (c.querySelector('h1') || {}).textContent || '';
  const faq = [...c.querySelectorAll('details.faq-item')].map(d => ({ q: d.querySelector('summary').textContent.trim(), a: (d.querySelector('p') || {}).textContent || '' }));
  const crumbs = (() => {
    const row = [...c.querySelectorAll('div')].find(d => d.children.length >= 3 && d.firstElementChild && d.firstElementChild.textContent.trim() === 'Главная' && /\//.test(d.textContent) && d.textContent.length < 160);
    return row ? [...row.children].filter(x => x.textContent.trim() && x.textContent.trim() !== '/').map(x => ({ name: x.textContent.trim(), href: x.getAttribute('href') || x.getAttribute('data-href') || '' })) : [];
  })();
  return { html: c.innerHTML, styles, h1: h1.trim(), faq, crumbs };
}

function jsonLd(id, r, snap) {
  const out = [];
  const org = { '@type': 'Organization', '@id': url('#org'), name: 'ПРОМКОНТУР', url: url(''), logo: url('assets/logo.svg'), email: 'zakaz@promkontur.example' };
  if (id !== 'homeB') out.push({ '@context': 'https://schema.org', ...org });
  if (id === 'homeB') out.push({ '@context': 'https://schema.org', '@graph': [org, { '@type': 'WebSite', name: 'ПРОМКОНТУР', url: url(''), inLanguage: 'ru' }] });
  if (snap.crumbs.length > 1) {
    const last = snap.crumbs.length - 1;
    const items = snap.crumbs.map((cr, i) => ({ '@type': 'ListItem', position: i + 1, name: cr.name, item: i === 0 ? url('') : i === last ? url(r.path) : (cr.href && cr.href !== '#' ? ORIGIN + cr.href : null) }))
      .filter((it, i) => it.item || i === last);
    items.forEach((it, i) => { it.position = i + 1; if (!it.item) delete it.item; });
    out.push({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items });
  }
  if (id === 'product') out.push({ '@context': 'https://schema.org', '@type': 'Product', name: 'Насос центробежный Grundfos CR 32-4 A-F-A-E-HQQE', sku: '96122802', brand: { '@type': 'Brand', name: 'Grundfos' }, mpn: '96122802', description: r.desc, image: [url('img/p-cr32.jpg'), url('img/p-cr32-flange.jpg'), url('img/p-cr32-motor.jpg')], aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.7', bestRating: '5', reviewCount: '34' }, offers: { '@type': 'Offer', price: '104900', priceCurrency: 'RUB', availability: 'https://schema.org/InStock', itemCondition: 'https://schema.org/NewCondition', priceValidUntil: '2026-12-31', url: url(r.path), seller: { '@id': url('#org') } } });
  if (id === 'article') out.push({ '@context': 'https://schema.org', '@type': 'Article', headline: snap.h1, description: r.desc, datePublished: '2026-09-14', dateModified: DATE, mainEntityOfPage: url(r.path), inLanguage: 'ru', image: url('img/art-hero.jpg'), author: { '@type': 'Organization', name: 'ПРОМКОНТУР' }, publisher: org });
  if (snap.faq.length) out.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: snap.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) });
  return out.map(o => '<script type="application/ld+json">' + JSON.stringify(o).replace(/</g, '\\u003c') + '</script>').join('\n');
}

function page({ id, r, body, extraHead = '' }) {
  const canonical = url(r.path);
  const ogImg = url('img/' + ({ product: 'p-cr32', quote: 'p-lgcy75', article: 'art-hero', blog: 'blog-boiler', supplier: 'warehouse', direction: 'dir-pumps', brand: 'brand' }[id] || 'og-cover') + '.jpg');
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(r.title)}</title>
<meta name="description" content="${esc(r.desc)}">
${r.index ? '' : '<meta name="robots" content="noindex, follow">\n'}${r.path === '404.html' ? '' : `<link rel="canonical" href="${canonical}">`}
<meta property="og:type" content="${r.type === 'article' ? 'article' : 'website'}">
<meta property="og:site_name" content="ПРОМКОНТУР">
<meta property="og:locale" content="ru_RU">
<meta property="og:title" content="${esc(r.title)}">
<meta property="og:description" content="${esc(r.desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${ogImg}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#16263a">
<link rel="icon" href="${BASE}favicon.svg" type="image/svg+xml">
<link rel="icon" href="${BASE}favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="${BASE}apple-touch-icon.png">
<link rel="manifest" href="${BASE}site.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${BASE}assets/ds.css">
<link rel="stylesheet" href="${BASE}assets/app.css">
${extraHead}</head>
<body>
${body}
<script src="${BASE}assets/site.js" defer></script>
</body>
</html>
`;
}

(async () => {
  let server = null;
  if (!(await up())) {
    server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', SRC], { stdio: 'ignore' });
    for (let i = 0; i < 40 && !(await up()); i++) await new Promise(r => setTimeout(r, 250));
  }
  rmrf(OUT); fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });

  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(DOC, { waitUntil: 'networkidle0' });

  let styles = '';
  const report = [];
  for (const [id, r] of Object.entries(ROUTES)) {
    if (r.skip) continue;
    await p.evaluate(id => { for (const s of document.querySelectorAll('select')) for (const o of s.options) if (o.value === id) { s.value = id; s.dispatchEvent(new Event('change', { bubbles: true })); return; } }, id);
    await new Promise(res => setTimeout(res, 450));
    const snap = await p.evaluate(inPage, ROUTES, BASE);
    styles = snap.styles;
    const html = page({ id, r, body: snap.html, extraHead: jsonLd(id, r, snap) + '\n' });
    const file = path.join(OUT, r.path, 'index.html');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, html);
    report.push(`${(html.length / 1024).toFixed(0).padStart(4)} КБ  /${r.path}  ${snap.h1.slice(0, 60)}${snap.faq.length ? '  FAQ×' + snap.faq.length : ''}`);

    if (id === 'homeB') {
      // 404: каркас витрины без содержимого экрана
      const chrome = snap.html;
      const start = chrome.indexOf('<div data-screen-label=');
      const foot = chrome.lastIndexOf('<footer');
      if (start > 0 && foot > start) {
        const main = `<main style="max-width:1360px;margin:0 auto;padding:64px 28px 96px;display:flex;flex-direction:column;gap:16px;align-items:flex-start">
  <div class="mono" style="font-size:12px;text-transform:uppercase;color:var(--color-neutral-600)">Ошибка 404</div>
  <h1 style="font-size:44px;margin:0">Такой страницы нет</h1>
  <p style="font-size:17px;color:var(--color-neutral-700);max-width:640px;margin:0">Возможно, адрес изменился или позиция снята с публикации. Найдите оборудование по артикулу, фото шильдика или в каталоге.</p>
  <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">
    <a class="btn btn-primary" href="${BASE}napravleniya/" style="text-decoration:none">Каталог · 45 направлений</a>
    <a class="btn btn-secondary" href="${BASE}poisk-po-foto/" style="text-decoration:none">Поиск по фото шильдика</a>
    <a class="btn btn-secondary" href="${BASE}" style="text-decoration:none">На главную</a>
  </div>
</main>`;
        const head = chrome.slice(0, start);
        const tail = chrome.slice(foot);
        // head заканчивается внутри корневого контейнера экрана — закрывать ничего не нужно:
        // screen-блоки лежат внутри sc-if-обёрток, которые рендерятся без собственного тега.
        fs.writeFileSync(path.join(OUT, '404.html'), page({ id: '404', r: { path: '404.html', index: false, title: 'Страница не найдена — ПРОМКОНТУР', desc: 'Страница не найдена.' }, body: head + main + tail }));
        const wrap = (h1, inner) => `<main style="max-width:920px;margin:0 auto;padding:40px 28px 72px"><div class="mono" style="font-size:12px;text-transform:uppercase;color:var(--color-neutral-600)"><a href="${BASE}" style="color:inherit">Главная</a> / ${h1}</div><h1 style="font-size:40px;margin:8px 0 18px">${h1}</h1><div class="pk-prose">${inner}</div></main>`;
        for (const extra of require('./extra_pages')(BASE, ROUTES)) {
          const f = path.join(OUT, extra.path, 'index.html'); fs.mkdirSync(path.dirname(f), { recursive: true });
          fs.writeFileSync(f, page({ id: extra.path, r: extra, body: head + wrap(extra.h1, extra.html) + tail }));
          report.push(`       /${extra.path}  ${extra.h1}`);
        }
      }
    }
  }
  await b.close();
  if (server) server.kill();

  // ── ассеты ──
  const dsDir = fs.readdirSync(path.join(SRC, '_ds'))[0];
  fs.copyFileSync(path.join(SRC, '_ds', dsDir, 'styles.css'), path.join(OUT, 'assets', 'ds.css'));
  fs.writeFileSync(path.join(OUT, 'assets', 'app.css'), styles + '\n' + fs.readFileSync(path.join(__dirname, 'site', 'site.css'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'site', 'skin.css'), 'utf8') + '\n' + (fs.existsSync(path.join(SRC, 'icons.css')) ? fs.readFileSync(path.join(SRC, 'icons.css'), 'utf8') : ''));
  fs.copyFileSync(path.join(__dirname, 'site', 'site.js'), path.join(OUT, 'assets', 'site.js'));
  copyDir(path.join(SRC, 'img'), path.join(OUT, 'img'), s => s.includes(path.sep + 'src'));
  copyDir(path.join(__dirname, 'site', 'static'), OUT);
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

  const idx = Object.values(ROUTES).filter(r => r.index && !r.skip).concat(require('./extra_pages')(BASE, ROUTES).filter(r => r.index));
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    idx.map(r => `  <url><loc>${url(r.path)}</loc><lastmod>${DATE}</lastmod></url>`).join('\n') + '\n</urlset>\n');
  fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${url('sitemap.xml')}\n`);

  const old = FINAL + '.old-' + process.pid;
  if (fs.existsSync(FINAL)) fs.renameSync(FINAL, old);
  fs.renameSync(OUT, FINAL);
  rmrf(old);

  console.log(report.join('\n'));
  console.log(`\nстраниц: ${report.length}, в sitemap: ${idx.length}, ошибок в макете: ${errors.length}${errors.length ? '\n' + errors.slice(0, 5).join('\n') : ''}`);
})().catch(e => { console.error(e); process.exit(1); });

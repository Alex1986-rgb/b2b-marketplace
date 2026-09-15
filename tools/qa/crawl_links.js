#!/usr/bin/env node
/*
 * QA: обход всех страниц собранного сайта и проверка карточек/ссылок.
 *
 *   node tools/qa/crawl_links.js [--url=http://localhost:8151/b2b-marketplace/] [--site=site] [--out=docs/reports/qa-links.json] [--tabs=3] [--quiet]
 *
 * Без --url поднимает собственный статический сервер над site/ (база /b2b-marketplace/),
 * поэтому работает на любой пересборке без внешнего сервера.
 * Код выхода: 0 — ошибок нет, 1 — есть ошибки (предупреждения на код не влияют).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..', '..');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true]; }));
const SITE = path.resolve(ROOT, args.site || 'site');
const OUT = path.resolve(ROOT, args.out || 'docs/reports/qa-links.json');
const BASE = '/b2b-marketplace/';
const TABS = +args.tabs || 3;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const puppeteer = require(path.join(ROOT, 'node_modules', 'puppeteer-core'));

// ── утилиты ─────────────────────────────────────────────────────────────────
const norm = t => String(t || '').replace(/&nbsp;/g, ' ').replace(/[\s   ]+/g, ' ').replace(/ё/g, 'е').replace(/Ё/g, 'Е').trim().toLowerCase();
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const WB = 'a-z0-9а-я';
const nameRe = n => new RegExp('(^|[^' + WB + '])' + esc(norm(n)) + '(?![' + WB + '])');
const toks = t => norm(t).replace(/(\d)\s*[×хx*]\s*(?=\d)/g, '$1x').split(/[^a-z0-9а-я]+/).filter(Boolean);
const tokensIn = (name, text) => { const T = new Set(toks(text)); const N = toks(name); return N.length > 0 && N.every(x => T.has(x)); };
const stemOverlap = (a, b) => { const B = toks(b).filter(w => w.length >= 4).map(w => w.slice(0, 5)); return toks(a).filter(w => w.length >= 4).some(w => B.includes(w.slice(0, 5))); };
const short = (t, n = 90) => { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
const readJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const stripTags = h => h.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

function listPages(dir, rel = '') {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (f.isDirectory()) { if (!/^(assets|img|node_modules)$/.test(f.name)) out.push(...listPages(path.join(dir, f.name), rel + f.name + '/')); }
    else if (f.name === 'index.html') out.push(rel);
  }
  return out.sort();
}
function fileFor(rel) { // rel — путь от корня сайта без базы, без query/hash
  const p = path.join(SITE, decodeURIComponent(rel));
  if (rel === '' || rel.endsWith('/')) return fs.existsSync(path.join(p, 'index.html')) ? path.join(p, 'index.html') : null;
  if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  if (fs.existsSync(path.join(p, 'index.html'))) return path.join(p, 'index.html');
  return null;
}
const h1Cache = {};
function h1Of(rel) {
  if (rel in h1Cache) return h1Cache[rel];
  const f = fileFor(rel); let h = null, title = null;
  if (f) {
    const html = fs.readFileSync(f, 'utf8');
    const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i); if (m) h = stripTags(m[1]).replace(/\s+/g, ' ').trim();
    const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i); if (t) title = stripTags(t[1]).split(/\s[—|–-]\s/)[0].trim();
  }
  return (h1Cache[rel] = { h1: h, title });
}

// ── сущности: data/*.json + страницы, которых в данных нет ──────────────────
const TYPES = {
  products: { label: 'товар', file: 'products.json', page: e => `katalog/${e.category}/${e.slug}/`, pageRe: /^katalog\/[^/]+\/[^/]+\/$/, hubs: [/^katalog\/[^/]+\/$/, /^katalog\/$/, /^poisk\/$/] },
  articles: { label: 'статья', file: 'articles.json', page: e => `blog/${e.slug}/`, pageRe: /^blog\/[^/]+\/$/, hubs: [/^blog\/$/] },
  directions: { label: 'направление', file: 'directions.json', page: e => `napravleniya/${e.slug}/`, pageRe: /^napravleniya\/[^/]+\/$/, hubs: [/^napravleniya\/$/] },
  brands: { label: 'производитель', file: 'brands.json', page: e => `proizvoditeli/${e.slug}/`, pageRe: /^proizvoditeli\/[^/]+\/$/, hubs: [/^proizvoditeli\/$/] },
};
function loadEntities(pages) {
  const ents = [], dataFiles = {};
  for (const [type, T] of Object.entries(TYPES)) {
    let raw = readJson(path.join(ROOT, 'tools', 'data', T.file));
    if (raw && !Array.isArray(raw)) raw = Object.values(raw).find(Array.isArray) || [];
    dataFiles[type] = raw ? raw.length : null;
    const seen = new Set();
    for (const e of raw || []) {
      if (!e || !e.slug) continue;
      let pg = e.path || e.url || null;
      if (pg) pg = pg.replace(/^https?:\/\/[^/]+/, '').replace(BASE, '').replace(/^\//, '');
      if (!pg) { try { pg = T.page(e); } catch (x) { pg = null; } }
      if (pg && !pg.endsWith('/')) pg += '/';
      const names = [e.name, e.title, ...(Array.isArray(e.aliases) ? e.aliases : [])].filter(n => typeof n === 'string' && norm(n).length >= 3);
      ents.push({ type, slug: e.slug, page: pg, names: [...new Set(names)], h1: typeof e.h1 === 'string' ? e.h1 : null, fromData: true });
      seen.add(pg);
    }
    for (const p of pages) if (T.pageRe.test(p) && !seen.has(p)) { // страница есть, в данных нет
      const { h1, title } = h1Of(p);
      const names = [h1, title].filter(n => n && norm(n).length >= 3);
      ents.push({ type, slug: p.split('/').slice(-2)[0], page: p, names: [...new Set(names)], fromData: false });
    }
  }
  for (const e of ents) e.res = e.names.map(nameRe);
  return { ents, dataFiles };
}
const matchEnts = (list, text) => { const t = norm(text); return list.filter(e => e.res.some(r => r.test(t))); };

// ── статический сервер ──────────────────────────────────────────────────────
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json' };
function startServer() {
  return new Promise(res => {
    const srv = http.createServer((req, resp) => {
      let u = decodeURIComponent(req.url.split(/[?#]/)[0]);
      if (!u.startsWith(BASE)) { resp.writeHead(404); return resp.end('not found'); }
      const f = fileFor(u.slice(BASE.length));
      if (!f) { resp.writeHead(404, { 'content-type': 'text/html' }); return resp.end('<h1>404</h1>'); }
      resp.writeHead(200, { 'content-type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(resp);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

// ── сбор со страницы (выполняется в браузере) ───────────────────────────────
function collect() {
  const CARD = '.card, .blueprint, tr, li, article, [data-href]';
  const txt = el => (el ? (el.innerText || el.textContent || '') : '').replace(/\s+/g, ' ').trim();
  const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const desc = el => { if (!el) return ''; let s = el.tagName.toLowerCase(); if (el.classList.length) s += '.' + [...el.classList].slice(0, 2).join('.'); return s; };
  const ctxOf = el => {
    const self = el.matches('.card, .blueprint, [data-href]') ? el : null;
    const c = self || (el.parentElement && el.parentElement.closest(CARD));
    return c || null;
  };
  const inAreas = el => el.closest('header, nav, footer, .pk-drawer') ? 'nav' : 'main';
  const links = [];
  for (const el of document.querySelectorAll('a[href], [data-href]')) {
    const raw = el.getAttribute('href') !== null && el.tagName === 'A' ? el.getAttribute('href') : el.getAttribute('data-href');
    let abs = null; try { abs = new URL(raw, location.href).href; } catch (e) {}
    const c = ctxOf(el);
    links.push({ tag: el.tagName, kind: el.tagName === 'A' && el.hasAttribute('href') ? 'href' : 'data-href', raw, abs, text: txt(el).slice(0, 200), title: (() => { const c = el.matches('.card, .blueprint, [data-href]') ? el : null; if (!c) return ''; const t = c.querySelector('.card-title, h2, h3, h4'); if (t) return txt(t); for (const n of c.querySelectorAll('span, div, p, strong, b')) { if (n.children.length || n.matches('.mono, .tag, .ico')) continue; const s = txt(n); if (s.length >= 3) return s; } return ''; })(), ctx: c ? txt(c).slice(0, 600) : '', ctxSel: desc(c), cardLike: !!(c && c.matches('.card, .blueprint, [data-href], article')) || el.matches('.card, .blueprint'), area: inAreas(el), visible: vis(el), demo: el.hasAttribute('data-demo'), hasHeading: !!el.querySelector('h1,h2,h3,h4,h5,.title') });
  }
  const demos = [];
  for (const el of document.querySelectorAll('[data-demo], a[href="#"], a[href=""]')) {
    const c = ctxOf(el);
    demos.push({ tag: el.tagName, href: el.getAttribute('href'), text: txt(el).slice(0, 160), ctx: c ? txt(c).slice(0, 400) : '', ctxSel: desc(c), cardLike: el.matches('.card, .blueprint') || !!el.querySelector('h1,h2,h3,h4,h5,img,.title'), area: inAreas(el), visible: vis(el) });
  }
  // карточки, которые выглядят кликабельными (cursor:pointer), но никуда не ведут
  const deadCards = [];
  for (const el of document.querySelectorAll('.card, .blueprint')) {
    if (!vis(el)) continue;
    if (getComputedStyle(el).cursor !== 'pointer') continue;
    if (el.closest('a[href]:not([href="#"]), [data-href]') || el.querySelector('a[href]:not([href="#"]), [data-href]')) continue;
    deadCards.push({ sel: desc(el), text: txt(el).slice(0, 160) });
  }
  // карточки: название, кликабельно ли оно, какие ссылки внутри
  const cards = [];
  for (const el of document.querySelectorAll('.card, .blueprint')) {
    if (!vis(el) || el.closest('header, nav, footer, .pk-drawer') || el.parentElement.closest('.card, .blueprint')) continue;
    const tEl = el.querySelector('.card-title, h2, h3, h4');
    const title = tEl ? txt(tEl) : '';
    const wrapLink = el.closest('a[href]:not([href="#"]), [data-href]');
    const inner = [...el.querySelectorAll('a[href], [data-href]')].map(a => ({ text: txt(a).slice(0, 80), raw: a.tagName === 'A' ? a.getAttribute('href') : a.getAttribute('data-href'), abs: (() => { try { return new URL(a.tagName === 'A' ? a.getAttribute('href') : a.getAttribute('data-href'), location.href).href; } catch (e) { return null; } })(), coversTitle: !!(tEl && (a.contains(tEl))) }));
    cards.push({ sel: desc(el), title, text: txt(el).slice(0, 300), selfLink: !!wrapLink, selfHref: wrapLink ? (wrapLink.getAttribute('href') || wrapLink.getAttribute('data-href')) : null, selfAbs: wrapLink ? (wrapLink.href || new URL(wrapLink.getAttribute('data-href'), location.href).href) : null, inner });
  }
  const h1 = document.querySelector('h1');
  return { links, demos, deadCards, cards, h1: h1 ? txt(h1) : null, title: document.title };
}

const ACTION_RE = /(в корзину|корзин|купить|заказ|отправ|оформ|добав|сравн|войти|выйти|регистр|подпис|скача|загруз|показать|ещё|еще|сброс|найти|поиск|позвон|звонок|перезвон|получить|запрос|счёт|счет|сохран|подключ|принять|отклон|согласов|поделит|печать|копир|фильтр|сортир|далее|назад|вперёд|закрыть|открыть чат|написать|удалить|изменить|редакт|подробнее о демо|свернуть|развернуть|все \d|^[+−\-–×✕]$|^\d+$|^$)/i;

async function main() {
  const t0 = Date.now();
  const pages = listPages(SITE);
  if (!pages.length) { console.error('Нет страниц в ' + SITE); process.exit(2); }
  const { ents, dataFiles } = loadEntities(pages);
  const pageSet = new Set(pages);
  const isPrivate = p => /^(panel\/|kabinet)/.test(p);

  let srv = null, origin;
  if (args.url) { origin = String(args.url).replace(/\/b2b-marketplace\/?$/, '').replace(/\/$/, ''); }
  else { srv = await startServer(); origin = 'http://127.0.0.1:' + srv.address().port; }
  const toRel = abs => { // абсолютный URL → путь сайта без базы, либо null если внешний
    let u; try { u = new URL(abs); } catch (e) { return { external: true }; }
    if (!/^https?:$/.test(u.protocol)) return { external: true, scheme: u.protocol };
    if (u.origin !== new URL(origin).origin) return { external: true };
    if (!u.pathname.startsWith(BASE)) return { outside: true, pathname: u.pathname };
    return { rel: decodeURIComponent(u.pathname.slice(BASE.length)), hash: u.hash };
  };

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
  const issues = [];
  const add = (type, sev, o) => issues.push({ type, severity: sev, ...o });
  const incoming = {}; // rel → Set(from)
  const stats = { pages: pages.length, publicPages: 0, privatePages: 0, links: 0, cardLinks: 0, demoElements: 0, uniqueTargets: 0 };
  const targets = new Set();
  const h1Checked = new Set();

  // обход
  const queue = pages.slice();
  async function worker() {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    let failed = [];
    page.on('response', r => { if (r.status() >= 400) failed.push({ url: r.url(), status: r.status() }); });
    page.on('requestfailed', r => failed.push({ url: r.url(), status: r.failure() && r.failure().errorText }));
    while (queue.length) {
      const rel = queue.shift();
      const priv = isPrivate(rel);
      priv ? stats.privatePages++ : stats.publicPages++;
      failed = [];
      let data;
      try {
        await page.goto(origin + BASE + rel, { waitUntil: 'load', timeout: 30000 });
        await new Promise(r => setTimeout(r, 150));
        data = await page.evaluate(collect);
      } catch (e) { add('page_error', 'error', { page: rel, detail: String(e.message || e) }); continue; }
      for (const f of failed) if (!/favicon|fonts\.g/.test(f.url)) add('resource_404', 'warning', { page: rel, target: f.url.replace(origin, ''), detail: String(f.status) });

      for (const L of data.links) {
        stats.links++;
        const raw = (L.raw || '').trim();
        if (raw === '#' || raw === '') continue; // обрабатываются в demos
        if (/^(mailto|tel|javascript):/i.test(raw)) { if (/^javascript:/i.test(raw) && !priv) add('js_href', 'warning', { page: rel, text: short(L.text), target: raw }); continue; }
        const r = toRel(L.abs);
        if (r.external) continue;
        if (r.outside) { add('broken_link', 'error', { page: rel, text: short(L.text || L.ctx), target: r.pathname, detail: 'ссылка вне базы ' + BASE }); continue; }
        if (!r.rel.split('/').pop().includes('.') && r.rel !== '' && !r.rel.endsWith('/')) { /* без слеша — nginx отдаст редирект, считаем допустимым */ }
        const exists = !!fileFor(r.rel);
        const tgt = r.rel === '' || r.rel.endsWith('/') || !exists ? r.rel : r.rel;
        targets.add(tgt);
        if (!exists) { add('broken_link', 'error', { page: rel, text: short(L.text || L.ctx), card: short(L.ctx, 120), target: tgt, detail: 'цель не существует (404)' }); continue; }
        if (r.hash && r.hash.length > 1 && tgt === rel) { /* якорь на той же странице — проверим наличие id */ }
        if (tgt !== rel) (incoming[tgt] = incoming[tgt] || new Set()).add(rel);
        if (priv) continue;
        if (L.cardLike) stats.cardLinks++;

        // карточка-ссылка с названием сущности, у которой есть своя страница, ведёт в другое место
        if (L.title && L.area !== 'nav') {
          const tt = norm(L.title);
          const own = ents.filter(e => e.page && pageSet.has(e.page) && e.names.some(n => { const nn = norm(n); return tt === nn || tt.startsWith(nn + ' ') || tt.startsWith(nn + ':'); }));
          if (own.length && !own.some(e => e.page === tgt) && !own.some(e => e.page === rel)) {
            const e0 = own.sort((a, b) => Math.max(...b.names.map(n => n.length)) - Math.max(...a.names.map(n => n.length)))[0];
            add('card_wrong_target', 'error', { page: rel, text: short(L.title), cardSel: L.ctxSel, target: tgt, expected: [e0.page], detail: `карточка ${TYPES[e0.type].label === 'статья' ? 'статьи' : TYPES[e0.type].label + 'а'} «${short(L.title, 50)}» ведёт на ${tgt}, а её страница — ${e0.page}` });
          }
        }
        // «не та страница»: цель — страница сущности, а в карточке названа другая сущность того же типа
        const tEnt = ents.find(e => e.page === tgt);
        const ctxText = L.cardLike || L.ctx ? L.ctx || L.text : L.text;
        if (tEnt) {
          const same = ents.filter(e => e.type === tEnt.type);
          let m = matchEnts(same, ctxText);
          if (!m.length && ctxText !== L.text) m = matchEnts(same, L.text);
          // если в тексте найдено только «вложенное» имя (CR 32-4 ⊂ CR 32-4 A-F-A) — это не противоречие
          if (m.length && !m.includes(tEnt) && L.area !== 'nav' && tgt !== rel) {
            const ownM = matchEnts(same, L.text);
            if (!(ownM.length && ownM.includes(tEnt))) add('wrong_target', 'error', { page: rel, text: short(L.text), card: short(ctxText, 140), cardSel: L.ctxSel, target: tgt, expected: m.map(e => e.page || '(нет страницы: ' + e.slug + ')'), detail: `${TYPES[tEnt.type].label}: в карточке «${m.map(e => e.names[0]).join('», «')}», ссылка на «${tEnt.names[0]}»` });
          }
          if (!h1Checked.has(tgt)) { // сверка h1 цели с названием сущности
            h1Checked.add(tgt);
            const { h1 } = h1Of(tgt);
            if (!h1) add('target_h1_missing', 'error', { page: tgt, target: tgt, detail: 'на странице сущности нет h1' });
            else if (tEnt.fromData && !(tEnt.h1 && norm(tEnt.h1) === norm(h1)) && !tEnt.names.some(n => tokensIn(n, h1) || tokensIn(h1, n)))
              add('target_h1_mismatch', 'error', { page: tgt, target: tgt, detail: `h1 «${short(h1)}» не содержит названия «${tEnt.names[0]}»${tEnt.h1 ? ' и не равен h1 из данных «' + short(tEnt.h1) + '»' : ''}`, expected: tEnt.names });
          }
        } else if (L.area !== 'nav') {
          // карточка сущности ведёт на хаб, хотя у сущности есть своя страница
          for (const [type, T] of Object.entries(TYPES)) {
            if (!T.hubs.some(h => h.test(tgt))) continue;
            if (!L.cardLike && L.text.length < 30 && /(все|весь|каталог|назад|блог|направлени|производител|смотреть|перейти|ещё|еще)/i.test(L.text)) continue;
            const m = matchEnts(ents.filter(e => e.type === type), L.cardLike ? ctxText : L.text);
            const withPage = m.filter(e => e.page && pageSet.has(e.page) && e.page !== rel);
            if (withPage.length === 1 || (withPage.length > 1 && L.cardLike === false)) {
              add('card_to_hub', 'error', { page: rel, text: short(L.text), card: short(ctxText, 140), cardSel: L.ctxSel, target: tgt, expected: withPage.map(e => e.page), detail: `${T.label} «${withPage[0].names[0]}» ведёт на хаб вместо своей страницы` });
            }
          }
        }
      }

      // мёртвые ссылки / демо-элементы
      for (const d of data.demos) {
        stats.demoElements++;
        if (priv || !d.visible) continue;
        const text = d.text || '';
        const m = matchEnts(ents, text);
        if (m.length && !ACTION_RE.test(text.slice(0, 40))) {
          add('dead_entity_link', 'error', { page: rel, text: short(text), card: short(d.ctx, 120), expected: m.map(e => e.page), detail: `${d.tag}${d.href !== null ? ' href="' + d.href + '"' : ''} с названием «${m[0].names[0]}» никуда не ведёт` });
        } else if (d.cardLike && !ACTION_RE.test(text.slice(0, 40))) {
          add('dead_card', 'error', { page: rel, text: short(text), card: short(d.ctx, 120), detail: 'элемент-карточка (заголовок/картинка) без перехода' });
        } else if (d.tag === 'A' && !ACTION_RE.test(text)) {
          add('demo_link', 'warning', { page: rel, text: short(text), card: short(d.ctx, 100), detail: `ссылка href="${d.href}" без перехода (data-demo)` });
        }
      }
      if (!priv) {
        const CART_RE = /^(в корзину|добавить в корзину|быстрый счёт|\+?\s*(сравнить|к сравнению|добавить к сравнению))$/i;
        const sameTarget = {};
        for (const c of data.cards) {
          const label = c.title || c.text.slice(0, 60);
          if (c.selfLink) { const r = toRel(c.selfAbs); let q = ''; try { q = new URL(c.selfAbs).search; } catch (e) {} if (r.rel !== undefined) { const k = r.rel + q; (sameTarget[k] = sameTarget[k] || []).push(label); } continue; } // фильтр ?tip= — разные адреса
          const ent = matchEnts(ents.filter(e => e.type === 'products' || e.type === 'articles'), c.title || '');
          if (!ent.length) continue;
          const nav = c.inner.filter(i => i.raw && i.raw !== '#' && !/^(mailto|tel):/.test(i.raw));
          const toOwn = nav.filter(i => { const r = toRel(i.abs); return r.rel !== undefined && ent.some(e => e.page === r.rel); });
          const realOwn = toOwn.filter(i => !CART_RE.test(norm(i.text)));
          if (!realOwn.length) add('card_not_clickable', 'error', { page: rel, text: short(c.title), cardSel: c.sel, expected: ent.map(e => e.page), detail: toOwn.length ? `название/фото карточки не ссылка; href на свою страницу есть только у кнопки «${toOwn[0].text}», а её перехватывает site.js (добавляет в корзину) — карточка не открывается` : 'карточка товара/статьи не содержит перехода на свою страницу' });
        }
        for (const [tg, labels] of Object.entries(sameTarget)) {
          const uniqL = [...new Set(labels.map(norm))];
          if (uniqL.length >= 3) add('many_cards_same_target', /^(chat|zayavka-spiskom|korzina|kontakty|vhod)\//.test(tg) ? 'warning' : 'error', { page: rel, target: tg, text: `${uniqL.length} разных карточек`, detail: `${uniqL.length} разных карточек ведут на один адрес ${tg}: «${labels.slice(0, 4).map(l => short(l, 40)).join('», «')}»${labels.length > 4 ? '…' : ''}`, examples: labels.slice(0, 12) });
        }
      }
      if (!priv) for (const c of data.deadCards) add('dead_card', 'error', { page: rel, text: short(c.text), cardSel: c.sel, detail: 'cursor:pointer, но нет ссылки/data-href' });
      if (!args.quiet) process.stdout.write('.');
    }
    await page.close();
  }
  await Promise.all(Array.from({ length: TABS }, worker));
  if (!args.quiet) process.stdout.write('\n');
  stats.uniqueTargets = targets.size;

  // сироты и сущности без страниц
  for (const e of ents) {
    if (!e.page || !pageSet.has(e.page)) { add('entity_no_page', 'error', { page: e.page || '(не определена)', detail: `${TYPES[e.type].label} «${e.names[0] || e.slug}» (${e.slug}) — страницы нет` }); continue; }
    const inc = [...(incoming[e.page] || [])].filter(p => !isPrivate(p));
    if (!inc.length) add('orphan', 'error', { page: e.page, detail: `${TYPES[e.type].label} «${e.names[0] || e.slug}» — нет ни одной входящей ссылки с публичных страниц` });
    if (!e.fromData && dataFiles[e.type] !== null) add('page_not_in_data', 'warning', { page: e.page, detail: `страница есть, в tools/data/${TYPES[e.type].file} записи нет` });
  }
  for (const p of pages) if (!isPrivate(p) && p !== '' && p !== '404.html' && !ents.some(e => e.page === p) && !(incoming[p] && [...incoming[p]].some(x => !isPrivate(x))))
    add('orphan', 'warning', { page: p, detail: 'служебная/хаб-страница без входящих ссылок с публичных страниц' });

  // клик-тест: первая карточка на странице — клик по центру карточки (или по названию, если карточка не ссылка)
  const clickTests = [];
  const CT = [
    { name: 'первая карточка каталога', page: 'katalog/nasosy/', re: '^katalog/[^/]+/[^/]+/$' },
    { name: 'первая статья блога', page: 'blog/', re: '^blog/[^/]+/$' },
    { name: 'первый раздел направлений', page: 'napravleniya/', re: '^(napravleniya/[^/]+/|katalog/[^/]+/)$' },
  ];
  for (const width of [390, 1440]) for (const t of CT) {
    const res = { test: t.name, width, page: t.page };
    const page = await browser.newPage();
    try {
      await page.setViewport({ width, height: width < 768 ? 844 : 900, isMobile: width < 768, hasTouch: false });
      await page.goto(origin + BASE + t.page, { waitUntil: 'load', timeout: 30000 });
      await new Promise(r => setTimeout(r, 200));
      const found = await page.evaluate(() => {
        const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
        const txt = el => (el ? el.innerText || '' : '').replace(/\s+/g, ' ').trim();
        const h1 = document.querySelector('h1');
        const CART = /^(в корзину|добавить в корзину|быстрый счёт|\+?\s*(сравнить|к сравнению))$/i;
        for (const el of document.querySelectorAll('.card, .blueprint')) {
          if (el.closest('header, nav, footer, aside, .pk-drawer') || el.parentElement.closest('.card, .blueprint') || !vis(el)) continue;
          if (h1 && !(h1.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
          const tEl = el.querySelector('.card-title, h2, h3, h4') || (el.matches('a') ? el.querySelector('span span:last-child, span') : null);
          const title = tEl ? txt(tEl) : txt(el).slice(0, 60);
          if (!title) continue;
          const wrap = el.closest('a[href]:not([href="#"]), [data-href]');
          const clickEl = wrap ? el : (tEl || el);
          const innerLinks = [...el.querySelectorAll('a[href]:not([href="#"]), [data-href]')].map(a => ({ text: txt(a), href: a.href || a.getAttribute('data-href') }));
          clickEl.scrollIntoView({ block: 'center', inline: 'nearest' });
          clickEl.setAttribute('data-qa-click', '1');
          return { title, cardIsLink: !!wrap, href: wrap ? (wrap.href || new URL(wrap.getAttribute('data-href'), location.href).href) : null, innerLinks, cartOnly: !wrap && innerLinks.length > 0 && innerLinks.every(i => CART.test(i.text)) };
        }
        return null;
      });
      if (!found) { res.ok = false; res.detail = 'на странице не найдено ни одной карточки'; }
      else {
        Object.assign(res, { text: found.title, cardIsLink: found.cardIsLink });
        if (found.href) res.target = decodeURIComponent(new URL(found.href).pathname.slice(BASE.length));
        await new Promise(r => setTimeout(r, 300)); // досмотреть плавный скролл
        const hit = await page.evaluate(() => {
          const el = document.querySelector('[data-qa-click]'); const r = el.getBoundingClientRect();
          const x = Math.max(1, Math.min(window.innerWidth - 1, r.left + r.width / 2)), y = Math.max(1, Math.min(window.innerHeight - 1, r.top + r.height / 2));
          const h = document.elementFromPoint(x, y);
          const d = n => n ? n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (n.classList.length ? '.' + [...n.classList].slice(0, 2).join('.') : '') : 'null';
          return { x, y, ok: !!h && (el === h || el.contains(h) || h.contains(el)), hit: d(h) };
        });
        res.point = [Math.round(hit.x), Math.round(hit.y)];
        if (!hit.ok) { res.ok = false; res.detail = `центр карточки перекрыт элементом ${hit.hit}`; }
        else {
          const before = page.url();
          const nav = page.waitForNavigation({ timeout: 5000, waitUntil: 'domcontentloaded' }).catch(() => null);
          await page.mouse.click(hit.x, hit.y);
          await nav;
          const now = new URL(page.url()).pathname;
          res.landed = decodeURIComponent(now.slice(BASE.length));
          const innerGood = found.innerLinks.find(i => { try { const u = new URL(i.href); return new RegExp(t.re).test(decodeURIComponent(u.pathname.slice(BASE.length))) && !/^(в корзину|добавить в корзину|быстрый счёт)$/i.test(i.text); } catch (e) { return false; } });
          if (page.url() === before && innerGood) {
            const ok2 = await page.evaluate(href => { const a = [...document.querySelectorAll('[data-qa-click] a[href], [data-qa-click] [data-href]')].concat([...document.querySelectorAll('a[href], [data-href]')]).find(x => (x.href || x.getAttribute('data-href')) === href && x.closest('.card, .blueprint') === document.querySelector('[data-qa-click]').closest('.card, .blueprint')); if (!a) return null; a.scrollIntoView({ block: 'center' }); const r = a.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; const h = document.elementFromPoint(x, y); return { x, y, ok: !!h && (a === h || a.contains(h)) }; }, innerGood.href);
            if (ok2 && ok2.ok) { const nav2 = page.waitForNavigation({ timeout: 5000, waitUntil: 'domcontentloaded' }).catch(() => null); await page.mouse.click(ok2.x, ok2.y); await nav2; }
            res.landed = decodeURIComponent(new URL(page.url()).pathname.slice(BASE.length));
            res.ok = page.url() !== before && new RegExp(t.re).test(res.landed);
            res.partial = true;
            res.detail = res.ok ? `название/карточка не кликается, открывается только ссылкой «${short(innerGood.text, 30)}» → ${res.landed}` : `ни название, ни ссылка «${short(innerGood.text, 30)}» не открывают страницу`;
          } else if (page.url() === before) {
            res.ok = false;
            res.detail = found.cartOnly ? `клик по названию «${short(found.title, 40)}» не открывает товар: переход есть только у кнопки «${found.innerLinks[0].text}», которую site.js превращает в «добавить в корзину»` : `клик по ${found.cardIsLink ? 'карточке' : 'названию'} не привёл к переходу${found.innerLinks.length ? ' (ссылки внутри: ' + found.innerLinks.map(i => '«' + short(i.text, 25) + '»').join(', ') + ')' : ''}`;
          } else if (!new RegExp(t.re).test(res.landed)) { res.ok = false; res.detail = 'переход не на страницу сущности: ' + res.landed; }
          else {
            const h1 = await page.$eval('h1', e => e.innerText).catch(() => null); res.h1 = h1;
            if (!h1) { res.ok = false; res.detail = 'на целевой странице нет h1'; }
            else if (!stemOverlap(found.title, h1) && !tokensIn(found.title, h1)) { res.ok = false; res.detail = `не та страница: карточка «${short(found.title, 50)}» → ${res.landed} с h1 «${short(h1, 60)}»`; }
            else res.ok = true;
          }
        }
      }
    } catch (e) { res.ok = false; res.detail = String(e.message || e); }
    await page.close();
    clickTests.push(res);
    if (res.ok && res.partial) add('click_test_partial', 'warning', { page: t.page, text: res.text, target: res.landed, detail: `${t.name} @${width}px: ${res.detail}` });
    if (!res.ok) add('click_test', 'error', { page: t.page, text: res.text, target: res.landed || res.target, detail: `${t.name} @${width}px: ${res.detail}` });
  }

  await browser.close();
  if (srv) srv.close();

  // дедупликация одинаковых проблем (одна и та же карточка на странице)
  const seen = new Set(); const uniq = [];
  for (const i of issues) { const k = [i.type, i.page, i.target, i.text, i.detail].join('|'); if (!seen.has(k)) { seen.add(k); uniq.push(i); } }
  const byType = {};
  for (const i of uniq) { byType[i.type] = byType[i.type] || { severity: i.severity, count: 0 }; byType[i.type].count++; }
  const errors = uniq.filter(i => i.severity === 'error').length, warnings = uniq.length - errors;
  const report = { generatedAt: new Date().toISOString(), site: SITE, origin: origin + BASE, durationSec: Math.round((Date.now() - t0) / 1000), dataFiles, entities: Object.fromEntries(Object.keys(TYPES).map(t => [t, ents.filter(e => e.type === t).length])), stats, summary: { errors, warnings, byType }, clickTests, issues: uniq };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));

  // печать сводки
  console.log(`\nQA ссылок — ${report.origin}`);
  console.log(`Страниц: ${stats.pages} (публичных ${stats.publicPages}, закрытых ${stats.privatePages}); ссылок: ${stats.links}, в карточках: ${stats.cardLinks}; уникальных целей: ${stats.uniqueTargets}; демо-элементов: ${stats.demoElements}`);
  console.log(`Данные: ${Object.entries(dataFiles).map(([k, v]) => `${k}=${v === null ? 'нет файла' : v}`).join(', ')}; сущностей (с учётом страниц): ${Object.entries(report.entities).map(([k, v]) => k + '=' + v).join(', ')}`);
  console.log(`Ошибок: ${errors}, предупреждений: ${warnings}`);
  for (const [t, v] of Object.entries(byType).sort((a, b) => b[1].count - a[1].count)) console.log(`  ${v.severity === 'error' ? 'ERR ' : 'warn'} ${t}: ${v.count}`);
  console.log('Клик-тесты:');
  for (const c of clickTests) console.log(`  ${c.ok ? (c.partial ? 'PART' : 'OK  ') : 'FAIL'} ${c.width}px ${c.test} «${short(c.text, 40)}»: ${c.landed || c.target || '-'}${c.detail ? ' — ' + c.detail : ''}`);
  const top = uniq.filter(i => i.severity === 'error').slice(0, 25);
  if (top.length) { console.log('Первые ошибки:'); for (const i of top) console.log(`  [${i.type}] /${i.page}${i.text ? ' «' + i.text + '»' : ''}${i.target ? ' → ' + i.target : ''}${i.expected ? ' (ожидалось ' + [].concat(i.expected).join(', ') + ')' : ''} — ${i.detail || ''}`); }
  console.log('JSON: ' + path.relative(ROOT, OUT));
  process.exit(errors ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(2); });

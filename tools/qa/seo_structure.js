#!/usr/bin/env node
/*
 * QA: структура заголовков и внутренняя перелинковка собранного сайта (без браузера, по файлам site/).
 *
 *   node tools/qa/seo_structure.js [--site=site] [--out=docs/reports/seo-structure.json] [--label=до] [--quiet]
 *
 * Считает по каждой странице: число h1, пропуски уровней (h2→h4, h1→h3), заголовки внутри header/footer/nav,
 * пустые заголовки, дубли текста h1, внутренние ссылки исходящие (уникальные цели) и входящие, сироты,
 * «пустые» анкоры (подробнее/тут/открыть/→), ссылки на текущую страницу, контекстные ссылки a.pk-ilink.
 * Публичные страницы — всё, кроме panel/ и kabinet*; noindex отмечается отдельно.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { parse } = require('node-html-parser');

const ROOT = path.resolve(__dirname, '..', '..');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true]; }));
const SITE = path.resolve(ROOT, args.site || 'site');
const OUT = path.resolve(ROOT, args.out || 'docs/reports/seo-structure.json');
const BASE = args.base || '/b2b-marketplace/';

const norm = t => String(t || '').replace(/&nbsp;|&#160;/g, ' ').replace(/[\s  ]+/g, ' ').trim().toLowerCase();
const isClosed = k => /^(panel\/|kabinet)/.test(k);
const WEAK = /^(подробнее|тут|здесь|открыть|перейти|читать|читать далее|далее|ещё|еще|смотреть|посмотреть|все|click|more|→|›|»|>)$/i;

function listPages(dir, rel = '') {
  const out = [];
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (f.isDirectory()) { if (!/^(assets|img|node_modules)$/.test(f.name)) out.push(...listPages(path.join(dir, f.name), rel + f.name + '/')); }
    else if (f.name === 'index.html') out.push(rel);
  }
  return out;
}

// href → ключ страницы (путь от корня сайта) или null для внешних/служебных
function hrefKey(href, cur) {
  if (!href) return null;
  href = href.trim();
  if (/^(mailto:|tel:|javascript:|data:|#)/i.test(href)) return null;
  if (/^https?:\/\//i.test(href)) {
    const m = href.match(/^https?:\/\/alex1986-rgb\.github\.io(\/.*)$/i);
    if (!m) return null; href = m[1];
  }
  let p = href.split('#')[0].split('?')[0];
  if (!p.startsWith('/')) { // относительная
    const dir = '/' + BASE.replace(/^\/|\/$/g, '') + '/' + cur.replace(/[^/]*$/, '');
    p = path.posix.normalize(dir + p);
  }
  if (!p.startsWith(BASE)) return null;
  let k = decodeURIComponent(p.slice(BASE.length));
  if (/\.(png|jpe?g|webp|svg|pdf|xml|json|txt|css|js|ico|xlsx?)$/i.test(k)) return null;
  if (k && !k.endsWith('/') && !/\.html$/.test(k)) k += '/';
  k = k.replace(/index\.html$/, '');
  return k;
}

function ancestors(el) { const a = []; let p = el.parentNode; while (p && p.tagName) { a.push(p); p = p.parentNode; } return a; }

function analyze(key, html) {
  const root = parse(html, { comment: false, blockTextElements: { script: false, style: false, noscript: false, pre: true } });
  const robots = root.querySelector('meta[name="robots"]');
  const noindex = !!(robots && /noindex/i.test(robots.getAttribute('content') || ''));
  const r = { key, closed: isClosed(key), noindex, h1: 0, gaps: [], inChrome: [], empty: 0, dupH1: [], out: [], weak: [], self: 0, ilinks: 0, headings: [] };
  const hs = root.querySelectorAll('h1,h2,h3,h4,h5,h6');
  let h1text = null, prev = 0;
  for (const h of hs) {
    const lvl = +h.tagName[1];
    const anc = ancestors(h);
    const chrome = anc.find(a => /^(HEADER|FOOTER|NAV)$/.test(a.tagName));
    const text = norm(h.text);
    r.headings.push('h' + lvl + (chrome ? '@' + chrome.tagName.toLowerCase() : '') + ' ' + text.slice(0, 60));
    if (lvl === 1) { r.h1++; if (h1text === null) h1text = text; }
    if (!text) r.empty++;
    if (chrome) { r.inChrome.push('h' + lvl + ' в ' + chrome.tagName.toLowerCase() + ': ' + text.slice(0, 50)); continue; }
    if (prev && lvl > prev + 1) r.gaps.push('h' + prev + '→h' + lvl + ': ' + text.slice(0, 50));
    else if (!prev && lvl > 2) r.gaps.push('старт→h' + lvl + ': ' + text.slice(0, 50));
    prev = lvl;
  }
  if (h1text) for (const h of hs) if (h.tagName !== 'H1' && norm(h.text) === h1text) r.dupH1.push(h.tagName.toLowerCase());
  const outSet = new Set();
  for (const a of root.querySelectorAll('a[href]')) {
    const k = hrefKey(a.getAttribute('href'), key);
    const t = norm(a.text).replace(/[→›»]+$/, '').trim();
    const label = a.getAttribute('aria-label') || a.getAttribute('title');
    if (!label && (WEAK.test(norm(a.text)) || WEAK.test(t))) r.weak.push(norm(a.text) + ' → ' + a.getAttribute('href'));
    if (/\bpk-ilink\b/.test(a.getAttribute('class') || '')) r.ilinks++;
    if (k === null) continue;
    if (k === key) { r.self++; continue; }
    outSet.add(k);
  }
  r.out = [...outSet];
  return r;
}

function main() {
  if (!fs.existsSync(SITE)) { console.error('Нет папки ' + SITE); process.exit(2); }
  const keys = listPages(SITE).sort();
  if (fs.existsSync(path.join(SITE, '404.html'))) keys.push('404.html');
  const pages = {};
  for (const k of keys) pages[k] = analyze(k, fs.readFileSync(path.join(SITE, k === '404.html' ? k : k + 'index.html'), 'utf8'));
  // входящие: уникальные страницы-источники (публичные индексируемые и все)
  for (const k of keys) { pages[k].inPublic = 0; pages[k].inAll = 0; }
  for (const k of keys) for (const t of pages[k].out) if (pages[t]) {
    pages[t].inAll++;
    if (!pages[k].closed && !pages[k].noindex) pages[t].inPublic++;
  }
  const pub = keys.filter(k => !pages[k].closed);
  const idx = pub.filter(k => !pages[k].noindex);
  const type = k => k === '' ? 'главная' : k === '404.html' ? '404' : /^katalog\/[^/]+\/[^/]+\/$/.test(k) ? 'товар' : /^katalog\//.test(k) ? 'каталог' : /^napravleniya\/[^/]+\//.test(k) ? 'направление' : /^napravleniya\/$/.test(k) ? 'все направления' : /^proizvoditeli\/[^/]+\//.test(k) ? 'производитель' : /^blog\/[^/]+\//.test(k) ? 'статья' : 'прочие';
  const sum = list => {
    const s = { pages: list.length, h1_not_1: 0, h1_zero: 0, h1_multi: 0, gaps: 0, pages_with_gaps: 0, in_chrome: 0, pages_in_chrome: 0, empty: 0, dup_h1: 0, weak: 0, self_links: 0, ilinks: 0, pages_with_ilinks: 0, out_avg: 0, in_avg: 0, orphans: [] };
    for (const k of list) {
      const p = pages[k];
      if (p.h1 !== 1) s.h1_not_1++; if (p.h1 === 0) s.h1_zero++; if (p.h1 > 1) s.h1_multi++;
      s.gaps += p.gaps.length; if (p.gaps.length) s.pages_with_gaps++;
      s.in_chrome += p.inChrome.length; if (p.inChrome.length) s.pages_in_chrome++;
      s.empty += p.empty; s.dup_h1 += p.dupH1.length; s.weak += p.weak.length; s.self_links += p.self;
      s.ilinks += p.ilinks; if (p.ilinks) s.pages_with_ilinks++;
      s.out_avg += p.out.length; s.in_avg += p.inPublic;
      if (p.inPublic === 0 && k !== '' && k !== '404.html') s.orphans.push(k);
    }
    s.out_avg = +(s.out_avg / (list.length || 1)).toFixed(1); s.in_avg = +(s.in_avg / (list.length || 1)).toFixed(1);
    s.ilinks_per_page = +(s.ilinks / (list.length || 1)).toFixed(2);
    return s;
  };
  const byType = {};
  for (const k of idx) { const t = type(k); (byType[t] = byType[t] || { pages: 0, in_sum: 0, in_min: 1e9, out_sum: 0, ilinks: 0 }); const b = byType[t]; b.pages++; b.in_sum += pages[k].inPublic; b.in_min = Math.min(b.in_min, pages[k].inPublic); b.out_sum += pages[k].out.length; b.ilinks += pages[k].ilinks; }
  for (const t in byType) { const b = byType[t]; b.in_avg = +(b.in_sum / b.pages).toFixed(1); b.out_avg = +(b.out_sum / b.pages).toFixed(1); b.ilinks_avg = +(b.ilinks / b.pages).toFixed(2); delete b.in_sum; delete b.out_sum; }
  const report = { label: args.label || null, date: new Date().toISOString(), site: path.relative(ROOT, SITE), total: keys.length, public: sum(pub), indexable: sum(idx), closed: sum(keys.filter(k => pages[k].closed)), byType, pages };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 1));

  if (!args.quiet) {
    const P = report.public, I = report.indexable, C = report.closed;
    const line = (n, s) => console.log(`${n.padEnd(12)} стр ${String(s.pages).padStart(3)} | h1≠1: ${s.h1_not_1} (0: ${s.h1_zero}, >1: ${s.h1_multi}) | пропуски: ${s.gaps} на ${s.pages_with_gaps} стр | в шапке/подвале/nav: ${s.in_chrome} на ${s.pages_in_chrome} стр | пустые: ${s.empty} | дубли h1: ${s.dup_h1} | слабые анкоры: ${s.weak} | на себя: ${s.self_links} | pk-ilink: ${s.ilinks} (${s.ilinks_per_page}/стр) | исх ср: ${s.out_avg} | вх ср: ${s.in_avg} | сироты: ${s.orphans.length}`);
    console.log('SEO-структура' + (args.label ? ' [' + args.label + ']' : '') + ': ' + keys.length + ' страниц');
    line('публичные', P); line('индексир.', I); line('закрытые', C);
    console.log('Входящие по типам (индексируемые):');
    for (const t in byType) console.log(`  ${t.padEnd(16)} стр ${byType[t].pages}, вх ср ${byType[t].in_avg}, мин ${byType[t].in_min}, исх ср ${byType[t].out_avg}, pk-ilink ср ${byType[t].ilinks_avg}`);
    if (I.orphans.length) console.log('Сироты (нет входящих с индексируемых): ' + I.orphans.join(', '));
    console.log('JSON: ' + path.relative(ROOT, OUT));
  }
}
main();

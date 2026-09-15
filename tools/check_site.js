#!/usr/bin/env node
// Проверка собранного site/: внутренние ссылки, картинки, мета, ошибки консоли и горизонтальное переполнение (1440 и 390).
//   node tools/check_site.js [--no-browser]
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const SITE = path.join(__dirname, '..', 'site');
const BASE = process.env.BASE || '/b2b-marketplace/';
const PORT = 8152;

const pages = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (f.endsWith('.html')) pages.push(p); } })(SITE);

const exists = href => {
  const clean = decodeURIComponent(href.split('#')[0].split('?')[0]);
  if (!clean.startsWith(BASE)) return true;
  const rel = clean.slice(BASE.length);
  const f = path.join(SITE, rel);
  return fs.existsSync(rel === '' || rel.endsWith('/') ? path.join(f, 'index.html') : f);
};

let bad = 0; const demo = {}; const titles = new Map();
for (const p of pages) {
  const html = fs.readFileSync(p, 'utf8');
  const rel = '/' + path.relative(SITE, p);
  const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(m => m[1]).concat([...html.matchAll(/url\((?:&quot;|["'])?([^)"'&]+)/g)].map(m => m[1]));
  const broken = [...new Set(refs.filter(h => h.startsWith(BASE) && !exists(h)))];
  if (broken.length) { bad++; console.log('✗ битые ссылки', rel, broken.slice(0, 6).join(' ')); }
  const t = (html.match(/<title>([^<]*)<\/title>/) || [])[1];
  const d = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1];
  if (!t || !d) { bad++; console.log('✗ нет title/description', rel); }
  if (t) { if (titles.has(t)) { bad++; console.log('✗ дубль title', rel, titles.get(t)); } titles.set(t, rel); }
  const h1 = (html.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1 && !rel.includes('mobilnye')) console.log('! h1 ×' + h1, rel);
  for (const m of html.matchAll(/<(a|button)([^>]*data-demo[^>]*)>([\s\S]*?)<\/\1>/g)) {
    const txt = m[3].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
    if (txt) demo[txt] = (demo[txt] || 0) + 1;
  }
}
console.log(`страниц: ${pages.length}, с проблемами разметки: ${bad}`);
const top = Object.entries(demo).sort((a, b) => b[1] - a[1]).slice(0, 40);
console.log('демо-кнопки/ссылки без перехода (топ):', top.map(([k, v]) => `${k}×${v}`).join(' · '));

if (process.argv.includes('--no-browser')) process.exit(bad ? 1 : 0);

(async () => {
  const puppeteer = require('puppeteer-core');
  const root = path.join(__dirname, '..', '.tmp-www');
  fs.rmSync(root, { recursive: true, force: true }); fs.mkdirSync(root, { recursive: true });
  fs.symlinkSync(SITE, path.join(root, BASE.replace(/\//g, '')));
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', root], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
  let issues = 0;
  for (const [w, label] of [[1440, 'desktop'], [390, 'mobile']]) {
    const pg = await b.newPage(); await pg.setViewport({ width: w, height: 900 });
    const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => m.type() === 'error' && errs.push(m.text()));
    pg.on('requestfailed', r => errs.push('FAIL ' + r.url()));
    pg.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
    for (const p of pages) {
      const rel = path.relative(SITE, p).replace(/index\.html$/, '');
      errs.length = 0;
      await pg.goto(`http://localhost:${PORT}${BASE}${rel}`, { waitUntil: 'networkidle0' });
      const over = await pg.evaluate(() => {
        const W = document.documentElement.clientWidth;
        const scroller = e => { for (let x = e.parentElement; x; x = x.parentElement) { const o = getComputedStyle(x).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') return true; } return false; };
        return [...document.querySelectorAll('body *')].filter(e => e.getClientRects().length && !e.classList.contains('corner') && e.getBoundingClientRect().right > W + 2 && !scroller(e))
          .slice(0, 3).map(e => e.tagName + '«' + (e.textContent || '').trim().slice(0, 30) + '»' + Math.round(e.getBoundingClientRect().right));
      });
      const e = [...new Set(errs)].filter(x => !/fonts\.g/.test(x));
      if (over.length || e.length) { issues++; console.log(`✗ ${label} /${rel}`, over.join(' | '), e.slice(0, 3).join(' ; ')); }
    }
    await pg.close();
  }
  await b.close(); srv.kill(); fs.rmSync(root, { recursive: true, force: true });
  console.log(`браузерная проверка: страниц с проблемами ${issues}`);
  process.exit(bad || issues ? 1 : 0);
})();

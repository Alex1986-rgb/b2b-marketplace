#!/usr/bin/env node
/* Lighthouse-прогон ключевых страниц ПРОМКОНТУРА: мобильный (throttling по умолчанию) и десктоп.
   node tools/qa/lighthouse.js [--base http://localhost:8151/b2b-marketplace/] [--out dir] [--only mobile|desktop] [--runs 1]
                               [--serve <папка сайта> [--gzip]]  ← свой статик-сервер на порту из --base (gzip как на GitHub Pages)
   Пишет <out>/lh-summary.json (оценки, метрики, топ-аудиты) и печатает таблицу. Сырые LHR — <out>/raw/*.json. */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const BASE = arg('base', 'http://localhost:8151/b2b-marketplace/');
const OUT = path.resolve(arg('out', path.join(__dirname, '..', '..', 'docs', 'reports', '_lighthouse')));
const ONLY = arg('only', '');
const RUNS = +arg('runs', '1');
const SERVE = arg('serve', '');
const GZIP = args.includes('--gzip');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const PAGES = [
  '',
  'katalog/nasosy/',
  'katalog/nasosy/grundfos-cr-32-4/',
  'katalog/podshipniki/skf-6205-2rs/',
  'napravleniya/',
  'napravleniya/kompressory/',
  'blog/kavitaciya-pochemu-razrushaetsya-rabochee-koleso/',
  'proizvoditeli/',
  'kontakty/',
];

// статик-сервер: /b2b-marketplace/* → папка сайта; --gzip сжимает text/* как GitHub Pages
function serve(dir, port, gzip) {
  const http = require('http'), zlib = require('zlib');
  const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
  const prefix = new URL(BASE).pathname;
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (!p.startsWith(prefix)) { rsp.writeHead(404); return rsp.end(); }
      p = path.join(dir, path.normalize('/' + p.slice(prefix.length)));
      if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
      if (!fs.existsSync(p)) { rsp.writeHead(404); return rsp.end(); }
      const type = TYPES[path.extname(p)] || 'application/octet-stream';
      let body = fs.readFileSync(p);
      const head = { 'Content-Type': type, 'Cache-Control': 'max-age=600' };
      if (gzip && /text|javascript|json|svg|xml|manifest/.test(type) && /gzip/.test(req.headers['accept-encoding'] || '')) { body = zlib.gzipSync(body, { level: 6 }); head['Content-Encoding'] = 'gzip'; head.Vary = 'Accept-Encoding'; }
      rsp.writeHead(200, head); rsp.end(body);
    }).listen(port, () => res(srv));
  });
}

const median = a => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

(async () => {
  const { default: lighthouse, desktopConfig } = await import('lighthouse');
  const chromeLauncher = await import('chrome-launcher');
  fs.mkdirSync(path.join(OUT, 'raw'), { recursive: true });
  const server = SERVE ? await serve(path.resolve(SERVE), +new URL(BASE).port || 80, GZIP) : null;
  const chrome = await chromeLauncher.launch({ chromePath: CHROME, chromeFlags: ['--headless=new', '--no-first-run', '--disable-extensions'] });
  const profiles = [['mobile', undefined], ['desktop', desktopConfig]].filter(([n]) => !ONLY || n === ONLY);
  const summary = { base: BASE, gzip: GZIP, served: SERVE || null, date: new Date().toISOString(), pages: {} };
  try {
    for (const p of PAGES) {
      for (const [prof, config] of profiles) {
        const runs = [];
        for (let r = 0; r < RUNS; r++) {
          const res = await lighthouse(BASE + p, { port: chrome.port, output: 'json', logLevel: 'error' }, config);
          runs.push(res.lhr);
        }
        const lhrs = runs;
        const lhr = lhrs[lhrs.length - 1];
        fs.writeFileSync(path.join(OUT, 'raw', (p.replace(/\//g, '_') || 'home') + '.' + prof + '.json'), JSON.stringify(lhr));
        const sc = k => Math.round(median(lhrs.map(l => (l.categories[k].score || 0) * 100)));
        const num = k => median(lhrs.map(l => (l.audits[k] && l.audits[k].numericValue) || 0));
        const a = lhr.audits;
        const top = Object.values(a)
          .filter(x => x.details && (x.details.overallSavingsMs > 0 || x.details.overallSavingsBytes > 0) && x.score !== null && x.score < 1)
          .map(x => ({ id: x.id, title: x.title, ms: Math.round(x.details.overallSavingsMs || 0), kb: Math.round((x.details.overallSavingsBytes || 0) / 1024) }))
          .sort((x, y) => y.ms - x.ms || y.kb - x.kb).slice(0, 6);
        const row = {
          perf: sc('performance'), a11y: sc('accessibility'), bp: sc('best-practices'), seo: sc('seo'),
          fcp: Math.round(num('first-contentful-paint')), lcp: Math.round(num('largest-contentful-paint')),
          tbt: Math.round(num('total-blocking-time')), cls: +num('cumulative-layout-shift').toFixed(3),
          si: Math.round(num('speed-index')), tti: Math.round(num('interactive')),
          maxFid: Math.round(num('max-potential-fid')),
          dom: ((((a['dom-size-insight'] || {}).details || {}).items || [])[0] || {}).value?.value ?? null,
          renderBlockingMs: Math.round((((a['render-blocking-insight'] || {}).details || {}).items || []).reduce((s, x) => s + (x.wastedMs || 0), 0)),
          renderBlocking: ((((a['render-blocking-insight'] || {}).details || {}).items) || []).map(x => ({ url: x.url.replace(/^https?:\/\/[^/]+/, ''), kb: Math.round((x.totalBytes || 0) / 1024), ms: Math.round(x.wastedMs || 0) })),
          transferKb: Math.round(((a['total-byte-weight'] || {}).numericValue || 0) / 1024),
          lcpElement: ((((a['lcp-breakdown-insight'] || {}).details || {}).items || []).find(x => x.type === 'node') || {}).snippet?.slice(0, 120) || '',
          top,
        };
        (summary.pages['/' + p] = summary.pages['/' + p] || {})[prof] = row;
        console.log(`${prof.padEnd(7)} P${String(row.perf).padStart(3)} A${row.a11y} BP${row.bp} SEO${row.seo}  FCP ${row.fcp} LCP ${row.lcp} TBT ${row.tbt} CLS ${row.cls}  DOM ${row.dom}  RB ${row.renderBlockingMs}ms  ${row.transferKb}KB  /${p}`);
      }
    }
  } finally {
    await chrome.kill();
    if (server) server.close();
  }
  fs.writeFileSync(path.join(OUT, 'lh-summary.json'), JSON.stringify(summary, null, 2));
  console.log('\n→ ' + path.join(OUT, 'lh-summary.json'));
})().catch(e => { console.error(e); process.exit(1); });

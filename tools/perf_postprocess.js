/* Перф-пост-обработка готовой папки сайта (вызывается ОДИН раз после сборки, до подмены site/).
   postprocessSite(siteDir, opts) → отчёт-объект. Ничего не знает о генераторах, работает по готовым файлам.

   Что делает:
   1. fonts   — @import Google Fonts из ds.css переносится в <link> в <head> (минус звено «HTML → ds.css →
                fonts.css»); при fontsAsync (по умолчанию) — неблокирующая загрузка media=print→all + <noscript>.
   2. inline  — частые inline style="…" (≥ minRepeat по сайту) выносятся в классы .s<N> в assets/inline.css.
                Эквивалентность каскада: правило `:where(.sN){prop:val !important}` стоит ПЕРВЫМ стилем страницы.
                inline-стиль (normal) бьёт все обычные авторские правила и проигрывает любым авторским !important;
                наш класс с !important бьёт все обычные и проигрывает любым !important (специфичность 0 и самое
                раннее место → проигрывает даже `*{…!important}`). Не выносятся (проверка программная):
                  - значения, которые матчит хоть один селектор [style…] из CSS (app.css, ds.css, <style> страниц) и JS;
                  - значения, которые JS читает регуляркой по getAttribute('style') (список JS_STYLE_PROBES);
                  - свойства, анимируемые в @keyframes (анимация бьёт inline, но не !important), и их шорткаты;
                  - url(), !important, сущности кроме &quot;/&amp;, фигурные скобки;
                  - элементы с data-bg / data-photo (JS ставит el.style.backgroundImage);
                  - страницы, где подключены скрипты кроме site.js/search.js/auth.js или есть исполняемый inline-JS
                    (кабинеты/панель/поставщик копируют и переписывают style через JS).
   3. css     — минификация app.css / ds.css / inline.css (комментарии/пробелы, без переписывания значений),
                удаление более ранних точных дублей верхнеуровневых блоков (оставляется последний — каскад тот же).
*/
const fs = require('fs');
const path = require('path');

// скрипты, проверенные на работу со style (catalog.js не читает и не пишет style — проверено 15.09.26)
const SAFE_SCRIPTS = new Set(['site.js', 'search.js', 'auth.js', 'catalog.js']);
// регулярки, которыми site.js/search.js/auth.js проверяют getAttribute('style') — такие значения не трогаем
const JS_STYLE_PROBES = [/url\(/i, /width:\s*14px/, /z-index/, /margin-left:\s*auto/, /position:\s*absolute/];

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

const decode = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

// ── [style…] селекторы из CSS/JS ─────────────────────────────────────────────
function styleAttrSelectors(text) {
  const out = [];
  const re = /\[\s*style\s*(?:([~|^$*]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s\]]+))\s*([iIsS])?)?\s*\]/g;
  for (const m of text.matchAll(re)) out.push({ op: m[1] || '', val: (m[2] ?? m[3] ?? m[4] ?? '').replace(/\\(.)/g, '$1'), i: /i/i.test(m[5] || '') });
  return out;
}
function attrMatches(sel, value) {
  let v = value, x = sel.val;
  if (sel.i) { v = v.toLowerCase(); x = x.toLowerCase(); }
  switch (sel.op) {
    case '': return true; // [style] — любой элемент с атрибутом
    case '=': return v === x;
    case '*=': return x !== '' && v.includes(x);
    case '^=': return x !== '' && v.startsWith(x);
    case '$=': return x !== '' && v.endsWith(x);
    case '~=': return v.split(/\s+/).includes(x);
    case '|=': return v === x || v.startsWith(x + '-');
  }
  return true;
}

// ── разбор объявлений inline-стиля ───────────────────────────────────────────
function splitDecls(s) {
  const out = []; let depth = 0, q = '', cur = '';
  for (const ch of s) {
    if (q) { cur += ch; if (ch === q) q = ''; continue; }
    if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
    if (ch === '(') depth++; else if (ch === ')') depth--;
    if (ch === ';' && depth === 0) { if (cur.trim()) out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (q || depth) return null;
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function keyframeProps(css) {
  const props = new Set();
  for (const m of css.matchAll(/@(?:-webkit-)?keyframes\s+[^{]+\{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/g))
    for (const d of m[1].matchAll(/([a-z-]+)\s*:/g)) props.add(d[1]);
  return props;
}

// ── минификация CSS ──────────────────────────────────────────────────────────
function topBlocks(css) {
  const blocks = []; let depth = 0, start = 0, q = '';
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = ''; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === '/' && css[i + 1] === '*') { const e = css.indexOf('*/', i + 2); i = e < 0 ? css.length : e + 1; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { blocks.push(css.slice(start, i + 1)); start = i + 1; } }
    else if (c === ';' && depth === 0) { blocks.push(css.slice(start, i + 1)); start = i + 1; }
  }
  if (css.slice(start).trim()) blocks.push(css.slice(start));
  return blocks;
}
function dedupeBlocks(css) {
  const blocks = topBlocks(css);
  const last = new Map();
  blocks.forEach((b, i) => last.set(b.trim(), i));
  let removed = 0;
  const kept = blocks.filter((b, i) => {
    const t = b.trim();
    if (!t || /^@(import|charset|namespace|layer)\b/i.test(t)) return true; // порядок @layer/@import значим
    if (last.get(t) !== i) { removed++; return false; }
    return true;
  });
  return { css: kept.join(''), removed };
}
function fallbackMinify(css) {
  // только то, что не меняет смысл: комментарии, пробелы вокруг { } ; , > и перед !important, «;» перед «}»
  let out = '', q = '';
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (q) { out += c; if (c === '\\') { out += css[++i] || ''; } else if (c === q) q = ''; continue; }
    if (c === '"' || c === "'") { q = c; out += c; continue; }
    if (c === '/' && css[i + 1] === '*') { const e = css.indexOf('*/', i + 2); i = e < 0 ? css.length : e + 1; continue; }
    if (/\s/.test(c)) {
      let j = i; while (j < css.length && /\s/.test(css[j])) j++;
      const prev = out[out.length - 1], next = css[j];
      if (!(prev === undefined || /[{};,>]/.test(prev) || next === undefined || /[{};,>!]/.test(next))) out += ' ';
      i = j - 1; continue;
    }
    if (c === '}' && out[out.length - 1] === ';' && !/:$/.test(out.slice(0, -1))) out = out.slice(0, -1);
    out += c;
  }
  return out;
}
// Намеренно без «умных» минификаторов (lightningcss/csso): они переписывают значения (color-mix → hex,
// слияние шорткатов), это даёт расхождения computed style. Разница в gzip ~0.4 КБ на app.css.
function minifyCss(css) {
  return dedupeBlocks(fallbackMinify(css));
}

// ── основное ─────────────────────────────────────────────────────────────────
function postprocessSite(siteDir, opts = {}) {
  const o = { minRepeat: 20, fonts: true, fontsAsync: true, inline: true, css: true, log: console.log, ...opts };
  const assets = path.join(siteDir, 'assets');
  const all = walk(siteDir);
  const htmlFiles = all.filter(f => f.endsWith('.html'));
  const rep = { pages: htmlFiles.length, inline: {}, css: {}, fonts: {} };
  const read = f => fs.readFileSync(f, 'utf8');
  const html = new Map(htmlFiles.map(f => [f, read(f)]));

  // 1. шрифты: @import из ds.css → <link> в HTML
  const dsFile = path.join(assets, 'ds.css');
  let fontLink = '';
  if (o.fonts && fs.existsSync(dsFile)) {
    let ds = read(dsFile);
    const m = ds.match(/@import\s+url\((['"]?)(https:\/\/fonts\.googleapis\.com\/[^'")]+)\1\)\s*;?/);
    if (m) {
      ds = ds.replace(m[0], '');
      fs.writeFileSync(dsFile, ds);
      const href = m[2].replace(/&/g, '&amp;');
      // fontsAsync: CSS шрифтов не блокирует первую отрисовку (display=swap уже в URL), без JS — обычная загрузка
      fontLink = o.fontsAsync
        ? `<link rel="stylesheet" href="${href}" media="print" onload="this.media='all'">\n<noscript><link rel="stylesheet" href="${href}"></noscript>`
        : `<link rel="stylesheet" href="${href}">`;
      rep.fonts.movedImport = m[2];
    }
  }

  // 2. inline-стили → классы
  let inlineCss = '';
  if (o.inline && fs.existsSync(path.join(assets, 'inline.css'))) { rep.inline.skipped = 'assets/inline.css уже есть — повторный прогон'; o.inline = false; }
  if (o.inline) {
    const cssTexts = all.filter(f => f.endsWith('.css')).map(read);
    const jsTexts = all.filter(f => f.endsWith('.js')).map(read);
    const pageStyles = [];
    for (const h of html.values()) for (const m of h.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) pageStyles.push(m[1]);
    const selectors = [...cssTexts, ...pageStyles, ...jsTexts].flatMap(styleAttrSelectors);
    const animated = new Set([...cssTexts, ...pageStyles].flatMap(t => [...keyframeProps(t)]));
    const animConflict = prop => prop === 'all' || [...animated].some(a => a === prop || a.startsWith(prop + '-') || prop.startsWith(a + '-'));

    const verdict = new Map(); // raw style value → null (нельзя) | нормализованные объявления
    const judge = raw => {
      if (verdict.has(raw)) return verdict.get(raw);
      let res = null;
      const val = decode(raw);
      const ok = raw.trim() && !/&(?!quot;|amp;|#39;)/.test(raw) && !/[{}<>\\]|!\s*important|url\(|expression|@/i.test(val)
        && !selectors.some(s => attrMatches(s, val)) && !JS_STYLE_PROBES.some(r => r.test(val));
      if (ok) {
        const decls = splitDecls(val);
        if (decls && decls.length && decls.every(d => /^-{0,2}[a-zA-Z][\w-]*\s*:\s*\S/.test(d))) {
          const props = decls.map(d => d.slice(0, d.indexOf(':')).trim().toLowerCase());
          if (!props.some(animConflict)) res = decls.map(d => { const i = d.indexOf(':'); return d.slice(0, i).trim() + ':' + d.slice(i + 1).trim() + '!important'; }).join(';');
        }
      }
      verdict.set(raw, res);
      return res;
    };

    const TAG = /<([a-zA-Z][\w-]*)((?:\s+[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>/g;
    const eligible = f => {
      const h = html.get(f);
      const scripts = [...h.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
      return scripts.every(([, attrs, body]) => {
        const src = attrs.match(/\bsrc="([^"]*)"/);
        if (src) return SAFE_SCRIPTS.has(path.basename(src[1].split('?')[0]));
        const type = (attrs.match(/\btype="([^"]*)"/) || [])[1] || '';
        return /json/i.test(type) || !body.trim();
      });
    };
    // куски HTML вне <script>/<style>/<textarea>/комментариев
    const segments = h => h.split(/(<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<textarea\b[\s\S]*?<\/textarea>|<!--[\s\S]*?-->)/i);

    const counts = new Map();
    const pages = htmlFiles.filter(eligible);
    rep.inline.eligiblePages = pages.length;
    rep.inline.skippedPages = htmlFiles.length - pages.length;
    for (const f of pages)
      segments(html.get(f)).forEach((seg, i) => {
        if (i % 2) return;
        for (const m of seg.matchAll(TAG)) {
          const attrs = m[2];
          if (/\sdata-(bg|photo)\b/.test(attrs)) continue;
          const s = attrs.match(/\sstyle="([^"]*)"/);
          if (s) counts.set(s[1], (counts.get(s[1]) || 0) + 1);
        }
      });

    const chosen = [...counts].filter(([raw, n]) => n >= o.minRepeat && judge(raw)).sort((a, b) => b[1] - a[1]);
    // имена классов .s0, .s1… — проверяем, что не заняты
    const taken = new Set();
    for (const h of html.values()) for (const m of h.matchAll(/\sclass="([^"]*)"/g)) for (const c of m[1].split(/\s+/)) if (/^s\d+$/.test(c)) taken.add(c);
    for (const t of [...all.filter(f => /\.(css|js)$/.test(f)).map(read)]) for (const m of t.matchAll(/\.(s\d+)\b/g)) taken.add(m[1]);
    const cls = new Map(); let n = 0;
    for (const [raw] of chosen) { while (taken.has('s' + n)) n++; cls.set(raw, 's' + n++); }
    inlineCss = chosen.map(([raw]) => `:where(.${cls.get(raw)}){${judge(raw)}}`).join('\n') + '\n';
    rep.inline.classes = cls.size;
    rep.inline.candidates = [...counts].filter(([, c]) => c >= o.minRepeat).length;
    rep.inline.rejected = rep.inline.candidates - cls.size;

    let replaced = 0, bytesBefore = 0, bytesAfter = 0;
    for (const f of pages) {
      const src = html.get(f);
      const out = segments(src).map((seg, i) => i % 2 ? seg : seg.replace(TAG, (m, tag, attrs, slash) => {
        const s = attrs.match(/\sstyle="([^"]*)"/);
        if (!s || !cls.has(s[1]) || /\sdata-(bg|photo)\b/.test(attrs)) return m;
        const c = cls.get(s[1]);
        let a = attrs.replace(s[0], '');
        if (/\sclass="/.test(a)) a = a.replace(/\sclass="([^"]*)"/, (x, v) => ` class="${v ? v + ' ' : ''}${c}"`);
        else a += ` class="${c}"`;
        replaced++;
        return `<${tag}${a}${slash ? ' /' : ''}>`;
      })).join('');
      bytesBefore += Buffer.byteLength(src); bytesAfter += Buffer.byteLength(out);
      html.set(f, out);
    }
    rep.inline.replacedAttrs = replaced;
    rep.inline.htmlKbSaved = Math.round((bytesBefore - bytesAfter) / 1024);
  }

  // вставка ссылок в <head>: шрифты и inline.css — ПЕРВЫМИ стилями страницы
  const base = (() => { const h = html.values().next().value || ''; const m = h.match(/href="([^"]*)assets\/(?:ds|app)\.css"/); return m ? m[1] : '/'; })();
  const inlineHref = inlineCss.trim() ? `${base}assets/inline.css` : '';
  for (const [f, h] of html) {
    if (!/<\/head>/i.test(h)) continue;
    const links = [fontLink, inlineHref && /\bclass="[^"]*\bs\d+\b/.test(h) ? `<link rel="stylesheet" href="${inlineHref}">` : ''].filter(Boolean);
    if (!links.length) { fs.writeFileSync(f, h); continue; }
    const headEnd = h.search(/<\/head>/i);
    const firstStyle = h.slice(0, headEnd).search(/<style\b|<link\b[^>]*rel="stylesheet"/i);
    const at = firstStyle >= 0 ? firstStyle : headEnd;
    fs.writeFileSync(f, h.slice(0, at) + links.join('\n') + '\n' + h.slice(at));
  }

  // 3. CSS
  if (inlineCss.trim()) fs.writeFileSync(path.join(assets, 'inline.css'), inlineCss);
  if (o.css) for (const name of ['inline.css', 'ds.css', 'app.css']) {
    const f = path.join(assets, name);
    if (!fs.existsSync(f)) continue;
    const before = fs.statSync(f).size;
    const { css, removed } = minifyCss(read(f));
    fs.writeFileSync(f, css);
    rep.css[name] = { kbBefore: Math.round(before / 1024), kbAfter: Math.round(Buffer.byteLength(css) / 1024), dupBlocksRemoved: removed };
  }
  if (o.log) o.log('perf_postprocess: ' + JSON.stringify(rep));
  return rep;
}

module.exports = { postprocessSite, _internal: { styleAttrSelectors, attrMatches, splitDecls, dedupeBlocks, minifyCss, fallbackMinify } };

if (require.main === module) {
  const dir = process.argv[2];
  if (!dir) { console.error('usage: node tools/perf_postprocess.js <siteDir-копия>'); process.exit(1); }
  postprocessSite(path.resolve(dir));
}

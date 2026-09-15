// SEO-пост-обработка готового HTML страницы (вызывается из tools/build_site.js для каждой записываемой страницы).
//
//   require('./seo_postprocess')(html, { BASE, ROUTES, LINKS, key }) → html
//
// Что делает (правки точечные: разметка режется по позициям из парсера, остальной HTML не пересериализуется):
//  a) иерархия заголовков — ровно один h1; заголовки в header/footer/nav → div; уровни без пропусков
//     (уровень = min(исходный, предыдущий+1)); заголовки карточек (.card-title, первый «заголовочный» span
//     в a.card/a.blueprint/.card) → h3/h4. Вид сохраняется: сменившему тег элементу ставится класс pk-o<исходный уровень>,
//     а в <head> (перед ds.css) — маленький <style>, который возвращает исходные размеры, в т. ч. мобильные !important.
//  b) контекстная перелинковка в текстах (SEO-блок, FAQ, статьи): первое упоминание бренда/направления/товара/статьи
//     из ctx.LINKS → <a class="pk-ilink">; лимиты: 1 ссылка на цель, 8 на страницу, 2 на абзац, без ссылок на себя
//     и на цели, на которые уже ссылается основной контент; только точное имя (без падежных форм).
//  c) rel="noopener" у внешних ссылок, aria-label у ссылок без текста и у «Открыть/Подробнее/→».
// Функция чистая; при любой ошибке возвращает исходный html.
'use strict';
const { parse } = require('node-html-parser');

const DS = { 1: 42, 2: 32, 3: 25, 4: 20, 5: 16, 6: 13 };
const MAX_PAGE = 8, MAX_PARA = 2;
const HEAD_RE = /^H[1-6]$/;
const WEAK = /^(подробнее|тут|здесь|открыть|перейти|читать|читать далее|далее|ещё|еще|смотреть|посмотреть|→|›|»)$/i;
const WB = 'a-z0-9а-яё';
const ILINK_STYLE = 'color:var(--color-accent-700);text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:3px';

// стиль, возвращающий вид элементам, у которых сменился тег (вставляется перед ds.css → классы app.css сильнее при равной специфичности)
const HX_CSS = [
  '.pk-o1,.pk-o2,.pk-o3,.pk-o4,.pk-o5,.pk-o6{font-family:var(--font-heading);font-weight:var(--font-heading-weight);line-height:1.12;letter-spacing:-0.015em;margin:0 0 var(--space-2)}',
  '.pk-o1{font-size:42px}.pk-o2{font-size:32px}.pk-o3{font-size:25px}.pk-o4{font-size:20px}.pk-o5{font-size:16px}.pk-o6{font-size:13px;letter-spacing:.08em;text-transform:uppercase}',
  '.pk-prose .pk-o1{font-size:42px;margin:0 0 var(--space-2)}.pk-prose .pk-o2{font-size:22px;margin:28px 0 10px}.pk-prose .pk-o3{font-size:25px;margin:0 0 var(--space-2)}.pk-prose .pk-o4{font-size:20px;margin:0 0 var(--space-2)}.pk-prose .pk-o5{font-size:16px;margin:0 0 var(--space-2)}.pk-prose .pk-o6{font-size:13px;margin:0 0 var(--space-2)}',
  '.pk-prose-col>.pk-o2{max-width:760px}.pk-prose-col>h2.pk-hx:not(.pk-o2){max-width:none}',
  '.pk-hcard{display:inline;font-size:inherit;line-height:inherit;letter-spacing:inherit;margin:0}',
  '@media (max-width:760px){.pk-o1{font-size:clamp(26px,7.4vw,34px)!important;line-height:1.15!important}.pk-o2{font-size:clamp(22px,6vw,26px)!important}',
  'h1.pk-hx:not(.pk-o1):not(.pk-o2),h2.pk-hx:not(.pk-o1):not(.pk-o2){font-size:var(--pk-fs)!important}',
  '.split>:first-child>.pk-o3,.split>:first-child>figure~.pk-o3~*{order:2}}',
].join('');

const norm = t => t.toLowerCase().replace(/ё/g, 'е');
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const escAttr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const ancestors = el => { const a = []; let p = el.parentNode; while (p && p.tagName) { a.push(p); p = p.parentNode; } return a; };
const cls = el => ' ' + (el.getAttribute && el.getAttribute('class') || '') + ' ';
const hasCls = (el, c) => cls(el).includes(' ' + c + ' ');
const styleOf = el => (el.getAttribute && el.getAttribute('style')) || '';
const textOf = el => el.text.replace(/[\s  ]+/g, ' ').trim();

// ── позиции тегов в исходной строке ──
function startTagEnd(html, from) { // индекс после '>' открывающего тега с учётом кавычек
  let q = null;
  for (let i = from + 1; i < html.length; i++) {
    const c = html[i];
    if (q) { if (c === q) q = null; }
    else if (c === '"' || c === "'") q = c;
    else if (c === '>') return i + 1;
  }
  return -1;
}
function tagSpans(html, el) {
  const [s, e] = el.range || [];
  if (s == null || html[s] !== '<') return null;
  const se = startTagEnd(html, s);
  const name = el.rawTagName.toLowerCase();
  const close = '</' + name + '>';
  if (se < 0 || html.slice(e - close.length, e).toLowerCase() !== close) return null;
  return { s, se, cs: e - close.length, e, name };
}
function rewriteStart(raw, oldName, newName, addClass, addStyle, extraAttrs) {
  let t = raw.replace(new RegExp('^<' + oldName, 'i'), '<' + newName);
  if (/^h[1-6]$/.test(newName)) t = t.replace(/(\saria-level\s*=\s*")\d(")/i, '$1' + newName[1] + '$2'); // role=heading: уровень в ARIA = новый тег
  if (addClass) {
    if (/\sclass\s*=\s*"/i.test(t)) t = t.replace(/(\sclass\s*=\s*")([^"]*)"/i, (m, a, v) => a + (v ? v + ' ' : '') + addClass + '"');
    else t = t.replace(/\s*\/?>$/, m => ' class="' + addClass + '"' + m);
  }
  if (addStyle) {
    if (/\sstyle\s*=\s*"/i.test(t)) t = t.replace(/(\sstyle\s*=\s*")([^"]*)"/i, (m, a, v) => a + (v && !/;\s*$/.test(v) ? v + ';' : v) + addStyle + '"');
    else t = t.replace(/\s*\/?>$/, m => ' style="' + addStyle + '"' + m);
  }
  if (extraAttrs) t = t.replace(/\s*\/?>$/, m => extraAttrs + m);
  return t;
}

// ── a) заголовки ──
function headings(html, root, ctx, edits, pub, isPanel) {
  const all = root.querySelectorAll('h1,h2,h3,h4,h5,h6');
  const info = el => {
    const anc = ancestors(el);
    return { anc, chrome: anc.find(a => /^(HEADER|FOOTER|NAV)$/.test(a.tagName)), inSummary: anc.some(a => a.tagName === 'SUMMARY') };
  };
  let changed = false;
  const mainH1 = all.find(h => h.tagName === 'H1' && !info(h).chrome && !info(h).inSummary);

  // кандидаты-заголовки карточек (только публичные страницы)
  const cards = new Set();
  if (pub) {
    const add = sp => { if (sp && !HEAD_RE.test(sp.tagName)) cards.add(sp); };
    for (const t of root.querySelectorAll('.card-title')) {
      const card = ancestors(t).find(a => /^(A|DIV|ARTICLE|LI)$/.test(a.tagName) && (hasCls(a, 'card') || hasCls(a, 'blueprint')));
      if (card && card.querySelector('h1,h2,h3,h4,h5,h6')) continue;
      add(t);
    }
    for (const card of root.querySelectorAll('a.card, a.blueprint, .card')) {
      if (card.querySelector('h1,h2,h3,h4,h5,h6,.card-title')) continue;
      const sp = card.querySelectorAll('span').find(s => /font-family:\s*var\(--font-heading\)/.test(styleOf(s)) && /font-weight:\s*600/.test(styleOf(s)));
      if (sp) add(sp);
    }
  }
  const isCardOk = sp => {
    const t = textOf(sp);
    if ((t.match(/[a-zа-яё]/gi) || []).length < 3 || /₽|%/.test(t) || /^[\d\s.,+×x–—-]+(\s*\S{1,4})?$/i.test(t)) return false;
    const par = sp.parentNode;
    if (!par || par.tagName === 'LI' || par.tagName === 'P' || hasCls(par, 'gal')) return false;
    const a = ancestors(sp);
    if (a.some(x => /^(HEADER|FOOTER|NAV|SUMMARY|BUTTON|TABLE|LABEL|H[1-6])$/.test(x.tagName))) return false;
    return !sp.querySelector('div,p,ul,ol,table,h1,h2,h3,h4,h5,h6');
  };

  // обход в порядке документа: настоящие заголовки + карточки
  const seq = [];
  const walk = n => { for (const c of n.childNodes) { if (c.nodeType !== 1) continue; if (HEAD_RE.test(c.tagName) || cards.has(c)) seq.push(c); walk(c); } };
  walk(root);

  let prev = 1;
  for (const el of seq) {
    const sp = tagSpans(html, el);
    if (!sp) continue;
    const raw = html.slice(sp.s, sp.se);
    if (cards.has(el)) {
      if (prev < 2 || !isCardOk(el)) continue;
      const lvl = Math.min(prev === 3 || prev >= 4 ? 4 : 3, prev + 1);
      edits.push([sp.s, sp.se, rewriteStart(raw, sp.name, 'h' + lvl, 'pk-hcard')], [sp.cs, sp.e, '</h' + lvl + '>']);
      changed = true;
      continue;
    }
    const orig = +el.tagName[1];
    const { chrome, inSummary } = info(el);
    if (inSummary) continue;
    const fsInline = (styleOf(el).match(/font-size:\s*([^;]+)/) || [])[1];
    const fsVar = '--pk-fs:' + (fsInline ? fsInline.trim() : DS[orig] + 'px');
    if (chrome) { // не заголовок: div (span, если родитель строчный)
      const inline = /^(A|SPAN|BUTTON|LABEL|P|STRONG|EM|B|I)$/.test(el.parentNode.tagName);
      const tag = inline ? 'span' : 'div';
      edits.push([sp.s, sp.se, rewriteStart(raw, sp.name, tag, 'pk-hx pk-o' + orig + (inline ? '" data-pk-block="1' : ''), inline ? 'display:block' : '')], [sp.cs, sp.e, '</' + tag + '>']);
      changed = true;
      continue;
    }
    let lvl = orig === 1 ? (el === mainH1 ? 1 : 2) : orig;
    if (!isPanel) lvl = lvl === 1 ? 1 : Math.min(lvl, prev + 1); // panel/: admin.js ищет h2/h3 — уровни там не трогаем
    if (lvl !== orig) {
      const addStyle = lvl <= 2 && orig >= 3 ? fsVar : '';
      edits.push([sp.s, sp.se, rewriteStart(raw, sp.name, 'h' + lvl, 'pk-hx pk-o' + orig, addStyle)], [sp.cs, sp.e, '</h' + lvl + '>']);
      changed = true;
    }
    prev = lvl;
  }
  return changed;
}

// ── b) контекстная перелинковка ──
function buildMatchers(LINKS) {
  const list = [];
  for (const type of ['products', 'brands', 'directions', 'articles']) {
    for (const it of (LINKS && LINKS[type]) || []) {
      if (!it || !it.href) continue;
      for (const n0 of it.names || []) {
        const n = norm(String(n0).replace(/[\s  ]+/g, ' ').trim());
        if (n.length < 3) continue;
        let body = escRe(n).replace(/ /g, '[\\s\\u00A0\\u202F]+');
        // словоформы не склоняем: падежная форма («насосов») без именительного в том же абзаце даёт спорные ссылки
        list.push({ href: it.href, type, len: n.length, re: new RegExp('(^|[^' + WB + '])(' + body + ')(?![' + WB + ']|-\\d)', 'gi') });
      }
    }
  }
  return list.sort((a, b) => b.len - a.len);
}
const MATCH_CACHE = new WeakMap();

// декодированный текст узла с картой позиций в исходную строку
function decodeRaw(raw) {
  let out = '', map = [];
  for (let i = 0; i < raw.length;) {
    if (raw[i] === '&') {
      const m = raw.slice(i, i + 12).match(/^&(#x?[0-9a-f]+|[a-z]+\d*);/i);
      if (m) {
        const ent = m[1].toLowerCase();
        const ch = ent === 'nbsp' || ent === '#160' || ent === '#xa0' ? ' ' : ent === 'amp' ? '&' : ent === 'quot' ? '"' : '';
        out += ch; map.push([i, i + m[0].length]); i += m[0].length; continue;
      }
    }
    out += raw[i]; map.push([i, i + 1]); i++;
  }
  return { text: out, map };
}

function contextLinks(html, root, ctx, edits) {
  const BASE = ctx.BASE || '/';
  const selfHref = BASE + (ctx.key || '');
  let matchers = ctx.LINKS && MATCH_CACHE.get(ctx.LINKS);
  if (!matchers) { matchers = buildMatchers(ctx.LINKS); if (ctx.LINKS && typeof ctx.LINKS === 'object') MATCH_CACHE.set(ctx.LINKS, matchers); }
  if (!matchers.length) return 0;

  const hrefNorm = h => (h || '').split('#')[0].split('?')[0];
  const used = new Set([selfHref]);
  for (const a of root.querySelectorAll('a[href]')) {
    if (ancestors(a).some(x => /^(HEADER|FOOTER|NAV)$/.test(x.tagName))) continue;
    used.add(hrefNorm(a.getAttribute('href')));
  }

  // текстовые блоки
  const blocks = [];
  const seen = new Set();
  const push = el => { if (!seen.has(el)) { seen.add(el); blocks.push(el); } };
  for (const el of root.querySelectorAll('p, li')) {
    const anc = ancestors(el);
    const inText = hasCls(el, 'seo-p') ||
      anc.some(a => hasCls(a, 'pk-seo') || hasCls(a, 'pk-prose') || hasCls(a, 'pk-prose-col') || a.tagName === 'ARTICLE' || (a.tagName === 'DETAILS' && (hasCls(a, 'seo-more') || (hasCls(a, 'faq-item') && el.tagName === 'P'))));
    if (!inText) continue;
    if (anc.some(a => /^(HEADER|FOOTER|NAV|A|BUTTON|SUMMARY|TABLE|FORM|LABEL|H[1-6])$/.test(a.tagName))) continue;
    if (el.querySelector('p, li')) { if (el.tagName === 'LI') continue; }
    push(el);
  }
  blocks.sort((a, b) => a.range[0] - b.range[0]);

  let total = 0;
  for (const block of blocks) {
    if (total >= MAX_PAGE) break;
    // текстовые узлы блока, не внутри ссылок/кнопок/кода
    const nodes = [];
    const walk = n => { for (const c of n.childNodes) { if (c.nodeType === 3) nodes.push(c); else if (c.nodeType === 1 && !/^(A|BUTTON|SUMMARY|CODE|KBD|SCRIPT|STYLE|H[1-6]|TH|SELECT|TEXTAREA|P|LI|UL|OL)$/.test(c.tagName) && !hasCls(c, 'mono')) walk(c); } };
    walk(block);
    let inPara = 0;
    for (const tn of nodes) {
      if (inPara >= MAX_PARA || total >= MAX_PAGE) break;
      const [s, e] = tn.range || [];
      if (s == null) continue;
      const raw = html.slice(s, e);
      if (!/[a-zа-яё]/i.test(raw)) continue;
      const { text, map } = decodeRaw(raw);
      const cands = [];
      for (const m of matchers) {
        if (used.has(m.href)) continue;
        m.re.lastIndex = 0;
        let r;
        while ((r = m.re.exec(text))) {
          const st = r.index + r[1].length, en = st + r[2].length;
          cands.push({ st, en, m });
          break; // первое упоминание в узле
        }
      }
      if (!cands.length) continue;
      cands.sort((a, b) => a.st - b.st || (b.en - b.st) - (a.en - a.st));
      const taken = [];
      for (const c of cands) {
        if (inPara >= MAX_PARA || total >= MAX_PAGE) break;
        if (used.has(c.m.href)) continue;
        if (taken.some(t => c.st < t.en && t.st < c.en)) continue;
        // при пересечении предпочитаем более длинное имя: проверим, нет ли длиннее, начинающегося внутри
        const longer = cands.find(o => o !== c && o.st < c.en && c.st < o.en && (o.en - o.st) > (c.en - c.st) && !used.has(o.m.href));
        if (longer) continue;
        taken.push(c); used.add(c.m.href); inPara++; total++;
        const rs = s + map[c.st][0], re = s + map[c.en - 1][1];
        edits.push([rs, rs, `<a href="${escAttr(c.m.href)}" class="pk-ilink" style="${ILINK_STYLE}">`], [re, re, '</a>']);
      }
    }
  }
  return total;
}

// ── c) мелкие правки ссылок ──
function linkFixes(html, root, ctx, edits) {
  for (const a of root.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href') || '';
    const sp = a.range && html[a.range[0]] === '<' ? [a.range[0], startTagEnd(html, a.range[0])] : null;
    if (!sp || sp[1] < 0) continue;
    let raw = html.slice(sp[0], sp[1]), nr = raw;
    if (/^https?:\/\//i.test(href) && !/^https?:\/\/alex1986-rgb\.github\.io\//i.test(href)) {
      const rel = a.getAttribute('rel');
      if (rel == null) nr = nr.replace(/\s*>$/, ' rel="noopener">');
      else if (!/\bnoopener\b/i.test(rel)) nr = nr.replace(/(\srel\s*=\s*")([^"]*)"/i, (m, p, v) => p + (v ? v + ' ' : '') + 'noopener"');
    }
    if (!textOf(a) && !a.getAttribute('aria-label') && !a.getAttribute('title') && !a.querySelector('img[alt]')) {
      const card = ancestors(a).find(x => hasCls(x, 'card') || hasCls(x, 'blueprint') || /^(ARTICLE|LI)$/.test(x.tagName));
      const t = card && (card.querySelector('h1,h2,h3,h4,h5,h6,.card-title') || card.querySelectorAll('span').find(s => /font-family:\s*var\(--font-heading\)/.test(styleOf(s))));
      const label = t && textOf(t);
      if (label) nr = nr.replace(/\s*>$/, ` aria-label="${escAttr(label)}">`);
    }
    // «Открыть», «Подробнее», «→» без контекста: aria-label «Открыть: <строка таблицы / заголовок карточки>»
    const vis = textOf(a);
    if (vis && WEAK.test(vis.replace(/\s*[→›»]+$/, '').trim() || vis) && !a.getAttribute('aria-label') && !a.getAttribute('title') && !/aria-label=/.test(nr)) {
      const anc = ancestors(a);
      const tr = anc.find(x => x.tagName === 'TR');
      let ctxText = '';
      if (tr) { const td = tr.querySelectorAll('td,th').find(c => !c.querySelector('a,button') && textOf(c)); ctxText = td ? textOf(td) : ''; }
      if (!ctxText) {
        const card = anc.find(x => hasCls(x, 'card') || hasCls(x, 'blueprint') || /^(ARTICLE|LI)$/.test(x.tagName));
        const t = card && (card.querySelector('h1,h2,h3,h4,h5,h6,.card-title') || card.querySelectorAll('span').find(s => /font-family:\s*var\(--font-heading\)/.test(styleOf(s))));
        ctxText = t ? textOf(t) : '';
      }
      if (ctxText && ctxText.length < 120) nr = nr.replace(/\s*>$/, ` aria-label="${escAttr((vis.replace(/\s*[→›»]+$/, '').trim() || 'Перейти') + ': ' + ctxText)}">`);
    }
    if (nr !== raw) edits.push([sp[0], sp[1], nr]);
  }
}

function applyEdits(html, edits) {
  // сортировка по позиции; пересекающиеся замены отбрасываются (вставки нулевой длины допустимы на границах)
  edits.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const ok = [];
  let lastEnd = -1;
  for (const e of edits) {
    if (e[0] < lastEnd) continue;
    ok.push(e); lastEnd = Math.max(lastEnd, e[1]);
  }
  let out = '', pos = 0;
  for (const [s, e, rep] of ok) { out += html.slice(pos, s) + rep; pos = e; }
  return out + html.slice(pos);
}

module.exports = function seoPostprocess(html, ctx) {
  try {
    if (typeof html !== 'string' || html.length < 50) return html;
    ctx = ctx || {};
    const key = String(ctx.key || '');
    const closed = /^(panel\/|kabinet)/.test(key);
    const isPanel = /^panel\//.test(key);
    const root = parse(html, { comment: true, blockTextElements: { script: true, noscript: true, style: true, pre: true } });
    const edits = [];
    const hxChanged = headings(html, root, ctx, edits, !closed, isPanel);
    if (!closed) contextLinks(html, root, ctx, edits);
    linkFixes(html, root, ctx, edits);
    let out = edits.length ? applyEdits(html, edits) : html;
    // ссылки на текущую страницу: aria-current="page" (меню, крошки, подвал)
    if (ctx.BASE != null && key !== '404.html') {
      const self = String(ctx.BASE) + key;
      const esc = self.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      out = out.replace(new RegExp('<a\\b([^>]*?)href="' + esc + '"([^>]*)>', 'g'), (m, a1, a2) => /aria-current=/.test(m) ? m : `<a${a1}href="${self}" aria-current="page"${a2}>`);
    }
    if (out === html) return html;
    if (hxChanged && !out.includes('id="pk-seo-hx"')) {
      const tag = `<style id="pk-seo-hx">${HX_CSS}</style>\n`;
      const at = out.search(/<link[^>]+rel="stylesheet"/i);
      const head = out.indexOf('</head>');
      if (at >= 0 && (head < 0 || at < head)) out = out.slice(0, at) + tag + out.slice(at);
      else if (head >= 0) out = out.slice(0, head) + tag + out.slice(head);
    }
    return out;
  } catch (e) {
    return html;
  }
};
module.exports.HX_CSS = HX_CSS;

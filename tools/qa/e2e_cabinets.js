#!/usr/bin/env node
/*
 * QA: сквозная проверка трёх кабинетов ПРОМКОНТУРА (закупщик, поставщик, оператор).
 *
 *   node tools/qa/e2e_cabinets.js [--url=http://localhost:8151/b2b-marketplace/]
 *        [--only=login,crawl,scenarios,visual,a11y]   какие блоки гонять (по умолчанию все)
 *        [--vp=1440,390]                               ширины для обхода кликов
 *        [--pages=kabinet/zakazy]                      фильтр страниц (подстрока пути, через запятую)
 *        [--full]                                      кликать все однотипные страницы (заказы/заявки/сделки/клиенты),
 *                                                      иначе — по 2 первых из группы, остальные только загрузка+ссылки
 *        [--shots]                                     сохранить скриншоты в docs/reports/img-e2e/
 *        [--out=docs/reports/e2e-cabinets.json]
 *
 * Сайт должен быть доступен по --url (python3 -m http.server над папкой, где b2b-marketplace → site).
 * Для каждого видимого интерактивного элемента: клик/изменение → переход (с кодом ответа), тост, модалка,
 * изменение DOM, запись в localStorage, скачивание, ошибка JS или НИЧЕГО (мёртвый).
 * Навигацию перехватываем (запрос отменяется, адрес проверяется HTTP-запросом) — страница не перезагружается.
 * localStorage перед каждой страницей восстанавливается снимком: только сессия нужной роли.
 * Код выхода: 0 — нет мёртвых/ошибок JS/404/провалов сценариев, 1 — есть.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..', '..');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true]; }));
const URL0 = (args.url || 'http://localhost:8151/b2b-marketplace/').replace(/\/?$/, '/');
const ORIGIN = new URL(URL0).origin;
const BASE = new URL(URL0).pathname;
const SITE = path.join(ROOT, 'site');
const OUT = path.resolve(ROOT, args.out || 'docs/reports/e2e-cabinets.json');
const SHOTS = path.join(ROOT, 'docs/reports/img-e2e');
const ONLY = new Set(String(args.only || 'login,crawl,scenarios,visual,a11y').split(','));
const VPS = String(args.vp || '1440,390').split(',').map(Number);
const PAGE_FILTER = args.pages ? String(args.pages).split(',') : null;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const puppeteer = require(path.join(ROOT, 'node_modules', 'puppeteer-core'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const short = (t, n = 80) => { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
const log = (...a) => { if (!args.quiet) console.log(...a); };

// ── страницы ────────────────────────────────────────────────────────────────
function listPages(dir, rel) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (f.isDirectory()) out.push(...listPages(path.join(dir, f.name), rel + f.name + '/'));
    else if (f.name === 'index.html') out.push(rel);
  }
  return out.sort();
}
const ROLE_OF = rel => rel.startsWith('kabinet-postavshchika/') ? 'vendor' : rel.startsWith('kabinet/') ? 'buyer' : rel.startsWith('panel/') ? 'operator' : null;
const GROUP_OF = rel => { const m = rel.match(/^(kabinet\/zakaz|kabinet-postavshchika\/zayavka|panel\/sdelki|panel\/klienty)\/[^/]+\/$/); return m ? m[1] : null; };
function closedPages() {
  return ['kabinet/', 'kabinet-postavshchika/', 'panel/'].flatMap(p => listPages(path.join(SITE, p), p));
}

// ── HTTP-проверка адресов ───────────────────────────────────────────────────
const statusCache = new Map();
function httpStatus(u) {
  const url = new URL(u, URL0); url.hash = '';
  const key = url.origin + url.pathname; // query статическому серверу не важен
  if (url.origin !== ORIGIN) return Promise.resolve(0);
  if (statusCache.has(key)) return statusCache.get(key);
  const p = new Promise(res => {
    const req = http.request(key, { method: 'GET' }, r => { r.resume(); res(r.statusCode); });
    req.on('error', () => res(-1)); req.setTimeout(8000, () => { req.destroy(); res(-2); }); req.end();
  });
  statusCache.set(key, p);
  return p;
}

// ── код внутри страницы ─────────────────────────────────────────────────────
// Ставится до загрузки: перехват скачиваний, window.open, печати, буфера, счётчик мутаций.
const PRELUDE = () => {
  window.__qa = { dl: [], open: [], print: 0, clip: [], blobs: 0, muts: [], errors: [] };
  const Q = window.__qa;
  const oc = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { if (this.hasAttribute('download') || /^blob:|^data:/.test(this.href)) { Q.dl.push(this.getAttribute('download') || this.href.slice(0, 40)); return; } return oc.apply(this, arguments); };
  document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[download]'); if (a) { Q.dl.push(a.getAttribute('download') || 'file'); e.preventDefault(); } }, true);
  const oo = window.open; window.open = function (u) { Q.open.push(String(u)); return null; };
  window.print = () => { Q.print++; };
  const cou = URL.createObjectURL; URL.createObjectURL = function () { Q.blobs++; return cou.apply(URL, arguments); };
  try { if (navigator.clipboard) navigator.clipboard.writeText = t => { Q.clip.push(String(t).slice(0, 60)); return Promise.resolve(); }; } catch (e) {}
  const oe = document.execCommand; document.execCommand = function (c) { if (c === 'copy') Q.clip.push('execCommand'); return oe.apply(document, arguments); };
  window.addEventListener('error', e => Q.errors.push(String(e.message)));
  const startObs = () => {
    new MutationObserver(list => {
      for (const m of list) {
        const t = m.target.nodeType === 1 ? m.target : m.target.parentElement;
        if (!t || (t.closest && t.closest('.pk-qa-ignore'))) continue;
        Q.muts.push({ type: m.type, attr: m.attributeName, tag: t.tagName, cls: String(t.className || '').slice(0, 40), added: m.addedNodes.length, removed: m.removedNodes.length });
        if (Q.muts.length > 400) Q.muts.shift();
      }
    }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  };
  if (document.documentElement) startObs(); else document.addEventListener('DOMContentLoaded', startObs);
};

// Список видимых интерактивных элементов с подписью (по ней элемент находится заново после перерисовки).
const ENUM = (opts) => {
  const SEL = 'a[href], button, [role="button"], input:not([type="hidden"]), select, textarea, summary, [data-href], label';
  const vis = e => {
    if (e.closest('[hidden], template, .pk-umenu')) return false;
    const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false;
    const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return false;
    for (let p = e; p; p = p.parentElement) { const s = getComputedStyle(p); if (s.display === 'none' || +s.opacity === 0) return false; if (p.tagName === 'DETAILS' && !p.open && e.tagName !== 'SUMMARY' && !e.closest('summary')) return false; }
    return true;
  };
  const text = e => (e.getAttribute('aria-label') || e.textContent || e.value || e.getAttribute('placeholder') || e.getAttribute('title') || '').replace(/\s+/g, ' ').trim().slice(0, 70);
  const set = new Set(document.querySelectorAll(SEL));
  // элементы с курсором-рукой, не вложенные в интерактивные
  if (opts.pointer) {
    for (const e of document.body.querySelectorAll('div, span, li, td, tr, th, img, svg, p, strong, section, article, h2, h3, h4')) {
      if (e.closest(SEL)) continue;
      const cs = getComputedStyle(e); if (cs.cursor !== 'pointer') continue;
      const par = e.parentElement; if (par && getComputedStyle(par).cursor === 'pointer') continue;
      set.add(e);
    }
  }
  const list = [], seen = {};
  for (const e of set) {
    // label вокруг input — кликаем сам input; label без курсора-руки не берём
    if (e.tagName === 'LABEL' && (e.querySelector('input,select,textarea') || getComputedStyle(e).cursor !== 'pointer')) continue;
    if (!vis(e)) continue;
    const tag = e.tagName.toLowerCase();
    const kind = tag === 'input' ? 'input:' + (e.type || 'text') : tag === 'a' ? 'a' : e.matches('[role="button"]') ? 'role-button' : e.matches('[data-href]') && !/^(button|summary|select|textarea|label)$/.test(tag) ? 'data-href' : /^(button|summary|select|textarea|label)$/.test(tag) ? tag : 'pointer-' + tag;
    const href = e.getAttribute('href') || e.getAttribute('data-href') || '';
    const sig = kind + '|' + text(e) + '|' + href + '|' + (e.name || '') + '|' + (e.getAttribute('data-act') || e.getAttribute('data-cab-act') || e.getAttribute('data-tab') || '');
    seen[sig] = (seen[sig] || 0) + 1;
    const r = e.getBoundingClientRect();
    const zone = e.closest('header') ? 'header' : e.closest('footer') ? 'footer' : e.closest('nav, aside') ? 'nav' : e.closest('main, #main') ? 'main' : 'body';
    list.push({ sig: sig + '#' + seen[sig], kind, text: text(e), href, zone, demo: e.hasAttribute('data-demo'), disabled: !!e.disabled, cursor: getComputedStyle(e).cursor, w: Math.round(r.width), h: Math.round(r.height), labelled: kind.startsWith('input') || tag === 'select' || tag === 'textarea' ? !!(e.labels && e.labels.length || e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || e.getAttribute('title')) : true, iconOnly: /^(button|a|role-button)$/.test(kind) && !(e.textContent || '').trim() && !e.getAttribute('aria-label') && !e.getAttribute('title') });
    if (opts.mark) e.setAttribute('data-qa-i', list.length - 1);
  }
  return list;
};

// Найти элемент по подписи и отметить его атрибутом data-qa-target
const FIND = (sig) => {
  document.querySelectorAll('[data-qa-target]').forEach(e => e.removeAttribute('data-qa-target'));
  const list = window.__qaEnum({ pointer: true, mark: true });
  const i = list.findIndex(x => x.sig === sig);
  if (i < 0) return null;
  const e = document.querySelector('[data-qa-i="' + i + '"]');
  document.querySelectorAll('[data-qa-i]').forEach(x => x.removeAttribute('data-qa-i'));
  e.setAttribute('data-qa-target', '1');
  e.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
  // строка-ссылка: кликаем по первой ячейке без полей ввода, как человек по названию
  const cell = e.tagName === 'TR' ? [...e.cells].find(c => !c.querySelector('input, select, button, a, label')) : null;
  const r = (cell || e).getBoundingClientRect();
  const cx = cell ? r.left + Math.min(12, r.width / 2) : r.left + Math.min(r.width / 2, Math.max(4, r.width - 4)), cy = r.top + r.height / 2;
  const offscreen = cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight;
  const top = offscreen ? null : document.elementFromPoint(cx, cy);
  const covered = top && top !== e && !e.contains(top) && !(cell && cell.contains(top)) && !(top.closest && top.closest('label') && top.closest('label').control === e) ? (top.tagName.toLowerCase() + (top.className ? '.' + String(top.className).split(' ')[0] : '') + ' «' + (top.textContent || '').trim().slice(0, 30) + '»') : '';
  return { x: cx, y: cy, covered, offscreen, href: e.getAttribute('href') || '', tag: e.tagName, type: e.type || '', options: e.tagName === 'SELECT' ? [...e.options].map(o => o.value) : null, value: e.value, checked: e.checked };
};

// Снимок состояния страницы до/после действия
const STATE = () => {
  const vis = e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05; };
  const toasts = [...document.querySelectorAll('.pk-toast, [class*="toast"], [role="alert"], .pk-cab-toast, .pv-toast, .pk-adm-toast, [role="status"]')]
    .filter(e => vis(e) && (e.textContent || '').trim() && !e.closest('.pk-gate')).map(e => (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 140));
  const dialogs = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"], dialog[open], .modal, [class*="modal"]')].filter(vis).map(e => ({ label: (e.getAttribute('aria-label') || (e.querySelector('h1,h2,h3') || {}).textContent || '').trim().slice(0, 60), modal: e.getAttribute('aria-modal'), role: e.getAttribute('role') || e.tagName.toLowerCase() }));
  const ls = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); ls[k] = localStorage.getItem(k); }
  const a = document.activeElement;
  return { url: location.href, toasts, dialogs, ls, scroll: Math.round(scrollY), focus: a ? a.tagName + '|' + (a.id || '') + '|' + (a.textContent || a.value || '').trim().slice(0, 20) : '', mutN: window.__qa ? window.__qa.muts.length : 0 };
};

// ── браузер ─────────────────────────────────────────────────────────────────
const RESULT = { started: new Date().toISOString(), url: URL0, login: [], pages: [], links404: [], jsErrors: [], scenarios: [], visual: [], a11y: [], summary: {} };

async function newPage(browser, width) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: width < 600 ? 844 : 900, deviceScaleFactor: 1, isMobile: width < 600, hasTouch: false });
  await page.evaluateOnNewDocument(PRELUDE);
  await page.evaluateOnNewDocument(`window.__qaEnum = ${ENUM.toString()};`);
  page.__ctx = { errors: [], bad: [], navs: [], dialogs: [], intercept: false };
  page.on('pageerror', e => page.__ctx.errors.push({ type: 'pageerror', text: short(e.message, 200) }));
  page.on('console', m => { if (m.type() === 'error') { const t = m.text(); if (!/Failed to load resource/.test(t)) page.__ctx.errors.push({ type: 'console', text: short(t, 200) }); } });
  page.on('response', r => { if (r.status() >= 400 && r.url().startsWith(ORIGIN)) page.__ctx.bad.push({ status: r.status(), url: r.url().replace(ORIGIN, '') }); });
  page.on('requestfailed', r => { const f = r.failure(); if (f && !/ERR_ABORTED|ERR_BLOCKED/.test(f.errorText) && r.url().startsWith(ORIGIN)) page.__ctx.bad.push({ status: f.errorText, url: r.url().replace(ORIGIN, '') }); });
  page.on('dialog', async d => { page.__ctx.dialogs.push(d.type() + ': ' + short(d.message(), 100)); try { await d.dismiss(); } catch (e) {} });
  await page.setRequestInterception(true);
  page.on('request', req => {
    if (page.__ctx.intercept && req.isNavigationRequest() && req.frame() === page.mainFrame()) { page.__ctx.navs.push(req.url()); req.abort('aborted').catch(() => {}); return; }
    req.continue().catch(() => {});
  });
  return page;
}

async function setSession(page, role, extraLs) {
  // пустая служебная страница того же origin → чистим localStorage и кладём сессию
  await page.goto(ORIGIN + BASE + 'robots.txt', { waitUntil: 'domcontentloaded' });
  await page.evaluate((role, extra) => {
    localStorage.clear();
    const P = {
      buyer: { role: 'buyer', name: 'Кузнецов Андрей', company: 'ООО «Метизный завод»', phone: '+7 910 000-00-14', initials: 'КА', title: 'закупщик' },
      vendor: { role: 'vendor', name: 'Семёнова Ольга', company: 'ООО «Гидромаш»', phone: '+7 916 000-00-27', initials: 'ГМ', title: 'поставщик' },
      operator: { role: 'operator', name: 'Петров А.', company: 'ПРОМКОНТУР', phone: '+7 495 000-00-01', initials: 'ПА', title: 'админ' }
    };
    if (role) localStorage.setItem('pk:session', JSON.stringify(Object.assign({}, P[role], { since: new Date().toISOString() })));
    for (const k in (extra || {})) localStorage.setItem(k, extra[k]);
  }, role, extraLs || null);
}

async function openPage(page, rel, role) {
  page.__ctx.intercept = false;
  await setSession(page, role);
  const resp = await page.goto(URL0 + rel, { waitUntil: 'networkidle2', timeout: 30000 }).catch(e => ({ status: () => 'ERR ' + e.message }));
  await sleep(250);
  return resp;
}

function diffLs(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].filter(k => a[k] !== b[k]);
}
function summarizeMuts(muts) {
  const m = muts.filter(x => !(x.type === 'attributes' && /^(data-qa-|style$)/.test(x.attr || '') && x.attr !== 'style') && !(x.attr || '').startsWith('data-qa-'));
  const c = {};
  for (const x of m) { const k = x.type === 'attributes' ? x.tag.toLowerCase() + '[' + x.attr + ']' : x.type === 'childList' ? x.tag.toLowerCase() + '(+' + x.added + '/-' + x.removed + ')' : 'text'; c[k] = (c[k] || 0) + 1; }
  return { n: m.length, top: Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => k + '×' + v).join(', ') };
}

const SKIP_TEXT = /^(выйти|сбросить демо-данные)$/i;
const STUB_RE = /Демонстрационная версия: действие показано в макете|данные никуда не отправляются|Готово \(демо-режим\)|выполнено в демо-режиме|Демо-режим: .*не (скачивается|выгружается|формируется)/;

async function clickOne(page, rel, role, el, vp) {
  const ctx = page.__ctx;
  const errs0 = ctx.errors.length, bad0 = ctx.bad.length, dlg0 = ctx.dialogs.length;
  let loc = await page.evaluate(FIND, el.sig);
  if (!loc) { // после предыдущих действий элемент пропал — открываем страницу заново
    await openPage(page, rel, role);
    loc = await page.evaluate(FIND, el.sig);
    if (!loc) return { result: 'NOT_FOUND' };
  }
  await sleep(60);
  const before = await page.evaluate(STATE);
  const q0 = await page.evaluate(() => (__qa.muts.length = 0, { dl: __qa.dl.length, open: __qa.open.length, print: __qa.print, clip: __qa.clip.length }));
  ctx.navs = []; ctx.intercept = true;
  const pagesBefore = (await page.browser().pages()).length;
  let action = 'click';
  try {
    if (el.kind === 'select') {
      const other = (loc.options || []).find(v => v !== loc.value);
      if (other == null) action = 'select-one-option';
      else { await page.select('[data-qa-target]', other); action = 'select→' + other; }
    } else if (/^input:(text|search|number|tel|email|date|url|password)$|^textarea$/.test(el.kind)) {
      await page.click('[data-qa-target]').catch(() => page.focus('[data-qa-target]'));
      await page.evaluate(() => { const e = document.querySelector('[data-qa-target]'); if (e && e.select) try { e.select(); } catch (x) {} });
      const v = el.kind === 'input:number' ? '7' : el.kind === 'input:date' ? '01.10.2026' : el.kind === 'input:email' ? 'qa@test.ru' : el.kind === 'input:tel' ? '9161234567' : '12';
      await page.keyboard.type(v, { delay: 5 });
      await page.keyboard.press('Tab');
      action = 'type «' + v + '» + Tab';
    } else if (loc.covered || loc.offscreen) {
      await page.evaluate(() => document.querySelector('[data-qa-target]').click());
      action = loc.offscreen ? 'js-click (вне экрана)' : 'js-click (перекрыт)';
    } else {
      await page.mouse.click(loc.x, loc.y);
    }
  } catch (e) { return { result: 'CLICK_ERROR', detail: short(e.message, 120) }; }
  await sleep(450);
  const pagesAfter = await page.browser().pages();
  let newTab = null;
  if (pagesAfter.length > pagesBefore) { const t = pagesAfter[pagesAfter.length - 1]; newTab = t.url(); await t.close().catch(() => {}); }
  let after;
  try { after = await page.evaluate(STATE); } catch (e) { await sleep(800); after = await page.evaluate(STATE).catch(() => null); }
  // отложенная реакция (синхронизация, setTimeout): если ничего не видно — ждём ещё
  if (after && !ctx.navs.length && after.toasts.join() === before.toasts.join() && after.dialogs.length === before.dialogs.length && !(await page.evaluate(() => __qa.muts.length).catch(() => 1))) {
    await sleep(1300); after = await page.evaluate(STATE).catch(() => after);
  }
  ctx.intercept = false;
  const q1 = await page.evaluate(() => ({ dl: __qa.dl.slice(-2), dlN: __qa.dl.length, open: __qa.open.slice(-1), openN: __qa.open.length, print: __qa.print, clipN: __qa.clip.length, muts: __qa.muts.slice() })).catch(() => ({ muts: [] }));
  const muts = summarizeMuts(q1.muts || []);
  const r = { action, covered: loc.covered || undefined };
  const newToasts = after ? after.toasts.filter(t => !before.toasts.includes(t)) : [];
  const newDialogs = after ? after.dialogs.length > before.dialogs.length : false;
  const lsKeys = after ? diffLs(before.ls, after.ls).filter(k => k !== 'pk:qa') : [];
  const navs = ctx.navs.filter(u => !/robots\.txt/.test(u));
  const hashNav = after && after.url !== before.url;
  if (navs.length) {
    const u = navs[navs.length - 1];
    const st = await httpStatus(u);
    const cur = new URL(before.url);
    const nu = new URL(u);
    r.nav = u.replace(ORIGIN, ''); r.status = st;
    r.result = st === 404 ? 'NAV_404' : nu.origin !== ORIGIN ? 'NAV_EXTERNAL' : (nu.pathname === cur.pathname && nu.search === cur.search) ? 'NAV_SELF' : 'NAV';
    if (/\/vhod\//.test(nu.pathname) && !/vhod/.test(el.href) && !/роль|войти/i.test(el.text)) r.result = 'NAV_TO_LOGIN';
  } else if (newTab) { r.result = 'NEW_TAB'; r.nav = newTab; }
  else if (q1.dlN > q0.dl) { r.result = 'DOWNLOAD'; r.detail = q1.dl.join(', '); }
  else if (q1.openN > q0.open) { r.result = 'WINDOW_OPEN'; r.detail = q1.open.join(''); }
  else if (q1.print > q0.print) { r.result = 'PRINT'; }
  else if (ctx.dialogs.length > dlg0) { r.result = 'NATIVE_DIALOG'; r.detail = ctx.dialogs.slice(dlg0).join(' | '); }
  else if (newDialogs) { r.result = 'MODAL'; r.detail = after.dialogs.map(d => d.label).join(' | '); }
  else if (newToasts.length) { r.result = STUB_RE.test(newToasts.join(' ')) ? 'STUB_TOAST' : 'TOAST'; r.detail = newToasts.join(' | '); }
  else if (q1.clipN > q0.clip) { r.result = 'COPY'; }
  else if (/^(mailto|tel):/.test(loc.href)) { r.result = 'MAILTO'; r.detail = loc.href; }
  else if (hashNav) { r.result = 'HASH'; r.detail = after.url.replace(ORIGIN, ''); }
  else if (muts.n > 0) { r.result = 'DOM'; r.detail = muts.top; }
  else if (lsKeys.length) { r.result = 'LS_ONLY'; }
  else if (after && after.scroll !== before.scroll && !/^input|select|textarea/.test(el.kind)) { r.result = 'SCROLL'; }
  else if (/^input|^select|^textarea/.test(el.kind)) { r.result = 'INPUT_NO_REACTION'; }
  else if (el.kind === 'label') { r.result = after && after.focus !== before.focus ? 'FOCUS' : 'DEAD'; }
  else r.result = el.disabled ? 'DISABLED' : 'DEAD';
  if (lsKeys.length) r.ls = lsKeys;
  if (r.result === 'TOAST' || r.result === 'STUB_TOAST') { if (muts.n > 3) r.dom = muts.top; }
  if (ctx.errors.length > errs0) { r.jsErrors = ctx.errors.slice(errs0).map(e => e.text); }
  if (ctx.bad.length > bad0) { r.bad = ctx.bad.slice(bad0); }
  // вернуть страницу в исходное состояние, если открылась модалка/поменялась страница
  if (r.result === 'MODAL') {
    const esc = await page.evaluate(() => document.activeElement && (document.activeElement.closest('[role="dialog"],dialog,[class*="modal"]') ? 'in' : 'out'));
    await page.keyboard.press('Escape'); await sleep(250);
    const still = await page.evaluate(STATE).catch(() => null);
    r.modalFocus = esc; r.modalEsc = still ? still.dialogs.length <= before.dialogs.length : null;
    if (!r.modalEsc) await openPage(page, rel, role);
  } else if (after && after.url.split('#')[0] !== before.url.split('#')[0]) {
    await openPage(page, rel, role);
  }
  // сбрасываем тосты, чтобы не путали следующий клик
  await page.evaluate(() => document.querySelectorAll('.pk-toast.on').forEach(t => t.classList.remove('on'))).catch(() => {});
  return r;
}

async function crawl(browser) {
  let pages = closedPages();
  if (PAGE_FILTER) pages = pages.filter(p => PAGE_FILTER.some(f => p.includes(f)));
  const groupSeen = {}, chromeSeen = new Map();
  for (const vp of VPS) {
    const page = await newPage(browser, vp);
    for (const rel of pages) {
      const role = ROLE_OF(rel);
      const g = GROUP_OF(rel);
      const full = args.full || !g || (groupSeen[vp + g] = (groupSeen[vp + g] || 0) + 1) <= 2;
      page.__ctx.errors = []; page.__ctx.bad = [];
      const t0 = Date.now();
      const resp = await openPage(page, rel, role);
      const info = { rel, vp, role, status: resp && resp.status ? resp.status() : null, finalUrl: page.url().replace(ORIGIN, ''), loadErrors: [], elements: [], clicked: full };
      if (!page.url().includes(rel)) info.redirected = true;
      const list = await page.evaluate(() => window.__qaEnum({ pointer: true }));
      info.loadErrors = page.__ctx.errors.slice(); info.loadBad = page.__ctx.bad.slice();
      info.title = await page.evaluate(() => { const h = document.querySelector('h1'); return h ? h.textContent.replace(/\s+/g, ' ').trim() : ''; });
      // адреса всех ссылок — HTTP-проверка
      for (const el of list) {
        if (el.href && !/^(#|mailto:|tel:|javascript:)/.test(el.href)) {
          const st = await httpStatus(el.href);
          if (st === 404) RESULT.links404.push({ page: rel, vp, text: el.text, href: el.href });
        }
      }
      if (full) {
        for (const el of list) {
          const ck = vp + '|' + role + '|' + el.zone + '|' + el.sig;
          if ((el.zone === 'header' || el.zone === 'footer' || (el.zone === 'body' && el.kind === 'a')) && chromeSeen.has(ck)) { info.elements.push(Object.assign({}, el, { result: 'DUP_CHROME', same: chromeSeen.get(ck) })); continue; }
          if (SKIP_TEXT.test(el.text)) { info.elements.push(Object.assign({}, el, { result: 'SKIPPED' })); continue; }
          let r;
          try { r = await clickOne(page, rel, role, el, vp); } catch (e) { r = { result: 'CRAWLER_ERROR', detail: short(e.message, 150) }; try { await openPage(page, rel, role); } catch (x) {} }
          info.elements.push(Object.assign({}, el, r));
          if (el.zone === 'header' || el.zone === 'footer' || (el.zone === 'body' && el.kind === 'a')) chromeSeen.set(ck, r.result);
        }
      } else info.elements = list.map(el => Object.assign({}, el, { result: 'NOT_CLICKED' }));
      info.ms = Date.now() - t0;
      RESULT.pages.push(info);
      const dead = info.elements.filter(e => e.result === 'DEAD').length, stub = info.elements.filter(e => e.result === 'STUB_TOAST').length;
      const errs = info.loadErrors.length + info.elements.reduce((a, e) => a + (e.jsErrors ? e.jsErrors.length : 0), 0);
      log(`[${vp}] ${rel.padEnd(48)} эл:${String(list.length).padStart(3)} мёртв:${dead} заглушек:${stub} JS:${errs} ${full ? '' : '(только загрузка)'} ${(info.ms / 1000).toFixed(0)}с`);
      fs.writeFileSync(OUT, JSON.stringify(RESULT, null, 1));
    }
    await page.close();
  }
}

// ── 1. Вход как человек ─────────────────────────────────────────────────────
async function loginFlows(browser) {
  const L = RESULT.login;
  const step = (name, ok, detail) => { L.push({ name, ok: !!ok, detail: detail || '' }); log((ok ? '  ✓ ' : '  ✗ ') + name + (detail ? ' — ' + short(detail, 140) : '')); };
  const page = await newPage(browser, 1440);
  await setSession(page, null);
  await page.goto(URL0, { waitUntil: 'networkidle2' });
  // где на главной «Войти»
  const entry = await page.evaluate(() => [...document.querySelectorAll('a, button')].filter(a => /войти|вход|кабинет/i.test(a.textContent) && a.getBoundingClientRect().width > 0).map(a => ({ t: a.textContent.replace(/\s+/g, ' ').trim(), href: a.getAttribute('href'), y: Math.round(a.getBoundingClientRect().top), fs: getComputedStyle(a).fontSize })));
  step('Главная: видны ссылки входа', entry.some(e => /войти/i.test(e.t)), JSON.stringify(entry));
  const vhodLink = await page.$$eval('a', as => { const a = as.find(x => /^войти$/i.test(x.textContent.trim()) && x.getBoundingClientRect().width > 0); if (a) { a.setAttribute('data-qa-login', '1'); return a.getAttribute('href'); } return null; });
  if (vhodLink) { await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2' }), page.click('[data-qa-login]')]); }
  step('Клик «Войти» ведёт на /vhod/', /\/vhod\/?$/.test(new URL(page.url()).pathname), page.url());
  const vhodInfo = await page.evaluate(() => ({ h1: (document.querySelector('h1') || {}).textContent, roles: [...document.querySelectorAll('.pk-role')].map(b => b.textContent), note: (document.querySelector('.pk-demo-note') || {}).textContent, codeHint: document.body.innerText.includes('4815') }));
  step('На /vhod/ есть переключатель ролей', vhodInfo.roles.length === 3, JSON.stringify(vhodInfo));
  if (ONLY.has('shots')) {}
  if (args.shots) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, 'vhod-1440.png'), fullPage: false }); }

  const HOME = { buyer: 'kabinet/', vendor: 'kabinet-postavshchika/', operator: 'panel/avtopilot/' };
  const LABEL = { buyer: 'Закупщик', vendor: 'Поставщик', operator: 'Оператор' };
  for (const role of ['buyer', 'vendor', 'operator']) {
    await setSession(page, null);
    await page.goto(URL0 + 'vhod/', { waitUntil: 'networkidle2' });
    await page.evaluate(l => { const b = [...document.querySelectorAll('.pk-role')].find(x => x.textContent.trim() === l); if (b) b.click(); }, LABEL[role]);
    // «Получить код» без номера
    const getCode = await page.$('.pk-getcode');
    if (!getCode) { step(role + ': кнопка «Получить код»', false, 'нет .pk-getcode'); continue; }
    await getCode.click(); await sleep(150);
    const emptyErr = await page.evaluate(() => (document.querySelector('.pk-autherr') || {}).textContent || '');
    step(role + ': пустой телефон → ошибка', /номер/i.test(emptyErr), emptyErr);
    await page.type('[data-pk="phone"]', '9161234567');
    const masked = await page.$eval('[data-pk="phone"]', i => i.value);
    step(role + ': маска телефона', /^\+7 \(916\) 123-45-67$/.test(masked), masked);
    await page.click('.pk-getcode'); await sleep(150);
    const box = await page.evaluate(() => (document.querySelector('.pk-codebox') || {}).textContent || '');
    step(role + ': код показан на экране', /4\s?8\s?1\s?5/.test(box), box);
    await page.type('[data-pk="code"]', '1111'); await sleep(200);
    const wrong = await page.evaluate(() => [...document.querySelectorAll('.pk-autherr')].map(e => e.textContent).join(' | '));
    step(role + ': неверный код → ошибка, остаёмся', /неверный/i.test(wrong) && /vhod/.test(page.url()), wrong);
    await page.$eval('[data-pk="code"]', i => { i.value = ''; });
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 }).catch(() => null), page.type('[data-pk="code"]', '4815')]);
    await sleep(300);
    const p = new URL(page.url()).pathname;
    step(role + ': код 4815 → свой раздел', p === BASE + HOME[role], p);
    const head = await page.evaluate(() => { const b = document.querySelector('.pk-ubtn'); return b ? b.textContent.trim() + ' / ' + b.getAttribute('aria-label') : 'нет кнопки пользователя'; });
    step(role + ': в шапке кнопка пользователя', !/нет/.test(head), head);
    // чужие разделы
    for (const other of ['buyer', 'vendor', 'operator'].filter(r => r !== role)) {
      await page.goto(URL0 + HOME[other], { waitUntil: 'networkidle2' }); await sleep(300);
      const u = new URL(page.url());
      const txt = await page.evaluate(() => { const a = document.querySelector('.pk-already'); return a && !a.hidden ? a.textContent : ''; });
      step(`${role}: открыть чужой раздел ${HOME[other]} → вход с пояснением`, /vhod/.test(u.pathname), u.pathname + u.search + ' · ' + txt);
    }
  }
  // Сменить роль из меню пользователя
  await setSession(page, 'buyer');
  await page.goto(URL0 + 'kabinet/', { waitUntil: 'networkidle2' });
  const menuOk = await page.evaluate(() => { const b = document.querySelector('.pk-ubtn'); if (!b) return null; b.click(); return [...document.querySelectorAll('.pk-umenu-item')].map(i => i.textContent.trim()); });
  step('Меню пользователя открывается', menuOk && menuOk.length > 2, JSON.stringify(menuOk));
  if (menuOk) {
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2' }), page.evaluate(() => [...document.querySelectorAll('.pk-umenu-item')].find(i => /сменить роль/i.test(i.textContent)).click())]);
    const sw = await page.evaluate(() => ({ url: location.pathname + location.search, h1: (document.querySelector('h1') || {}).textContent, already: (document.querySelector('.pk-already') || {}).textContent, role: (document.querySelector('.pk-role.on') || {}).textContent }));
    step('«Сменить роль» → /vhod/ с текущей сессией', /vhod/.test(sw.url), JSON.stringify(sw));
    // переключиться на поставщика: кликаем роль и «Войти в демо без кода»
    await page.evaluate(() => [...document.querySelectorAll('.pk-role')].find(b => /Поставщик/.test(b.textContent)).click());
    const sw2 = await page.evaluate(() => (document.querySelector('.pk-already') || {}).textContent);
    step('«Сменить роль»: при выборе другой роли видно, как переключиться', /поставщик|войти/i.test(sw2 || ''), sw2);
    await page.evaluate(() => { const b = [...document.querySelectorAll('.pk-linkbtn')].find(x => /без кода/.test(x.textContent)); if (b) b.click(); });
    await sleep(900);
    step('«Войти в демо без кода» за поставщика → кабинет поставщика', /kabinet-postavshchika/.test(page.url()), page.url().replace(ORIGIN, ''));
  }
  // Выход
  await setSession(page, 'operator');
  await page.goto(URL0 + 'panel/crm/', { waitUntil: 'networkidle2' });
  const out = await page.evaluate(() => { const b = document.querySelector('.pk-ubtn'); if (!b) return false; b.click(); const x = [...document.querySelectorAll('.pk-umenu-item')].find(i => /выйти/i.test(i.textContent)); if (!x) return false; x.click(); return true; });
  await sleep(1200);
  const afterOut = await page.evaluate(() => ({ url: location.pathname, session: localStorage.getItem('pk:session') }));
  step('Выход из панели → главная, сессия удалена', out && afterOut.url === BASE && !afterOut.session, JSON.stringify(afterOut));
  // без сессии — любой закрытый раздел → вход с next и возврат после входа
  await setSession(page, null);
  await page.goto(URL0 + 'kabinet/dokumenty/', { waitUntil: 'networkidle2' }); await sleep(300);
  const g = new URL(page.url());
  step('Без входа /kabinet/dokumenty/ → /vhod/?next=…', /vhod/.test(g.pathname) && /next=/.test(g.search), g.pathname + g.search);
  const gateFlash = await page.evaluate(() => document.querySelector('h1') ? document.querySelector('h1').textContent : '');
  await page.type('[data-pk="phone"]', '9161234567').catch(() => {});
  await page.click('.pk-getcode').catch(() => {});
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 }).catch(() => null), page.type('[data-pk="code"]', '4815').catch(() => {})]);
  await sleep(300);
  step('После входа возврат на исходную страницу (next)', /kabinet\/dokumenty/.test(page.url()), page.url().replace(ORIGIN, '') + ' · h1 входа: ' + gateFlash);
  // Регистрация компании
  await setSession(page, null);
  await page.goto(URL0 + 'vhod/', { waitUntil: 'networkidle2' });
  const reg = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => /^зарегистрировать/i.test(x.textContent.trim()));
    if (!b) return { found: false };
    const card = b.closest('.blueprint') || b.parentNode;
    return { found: true, inputs: [...card.querySelectorAll('input')].map(i => ({ ph: i.placeholder, label: i.labels && i.labels[0] ? i.labels[0].textContent.trim() : '', v: i.value })) };
  });
  step('Регистрация: форма найдена', reg.found, JSON.stringify(reg.inputs));
  if (reg.found) {
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /^зарегистрировать/i.test(x.textContent.trim())); b.setAttribute('data-qa-reg', '1'); b.click(); });
    await sleep(200);
    const errs = await page.evaluate(() => [...document.querySelectorAll('.pk-autherr')].map(e => e.textContent));
    step('Регистрация: пустая форма → ошибки полей', errs.length > 0, errs.join(' | '));
    await page.evaluate(() => {
      const card = document.querySelector('[data-qa-reg]').closest('.blueprint') || document.querySelector('[data-qa-reg]').parentNode;
      const set = (i, v) => { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(i, v); i.dispatchEvent(new Event('input', { bubbles: true })); };
      for (const i of card.querySelectorAll('input')) { if (/цифр/.test(i.placeholder)) set(i, '7707123458'); else if (i.getAttribute('data-pk') === 'reg-phone') set(i, '9161234567'); else if (/имя/i.test(i.placeholder)) set(i, 'Иванов Пётр, снабжение'); else if (/@/.test(i.placeholder)) set(i, 'ivanov@test.ru'); }
    });
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 }).catch(() => null), page.click('[data-qa-reg]')]);
    await sleep(300);
    const s = await page.evaluate(() => ({ url: location.pathname, session: JSON.parse(localStorage.getItem('pk:session') || 'null'), shown: document.querySelector('.pk-ubtn') ? document.querySelector('.pk-ubtn').textContent : '', userInPage: document.body.innerText.includes('Иванов') }));
    step('Регистрация → кабинет закупщика с новой компанией (по ИНН из демо-справочника)', /kabinet\/$/.test(s.url) && s.session && /Иванов/.test(s.session.name) && s.session.inn === '7707123458' && /Северный механический/.test(s.session.company) && s.session.newCompany === true, JSON.stringify({ url: s.url, name: s.session && s.session.name, company: s.session && s.session.company, header: s.shown }));
    step('Регистрация: в кабинете отражено новое имя/компания (не демо «Метизный завод»)', s.userInPage, 'в тексте кабинета «Иванов»: ' + s.userInPage);
  }
  // Мобильный вход: как найти «Войти» на 390
  const m = await newPage(browser, 390);
  await setSession(m, null);
  await m.goto(URL0, { waitUntil: 'networkidle2' });
  const mob = await m.evaluate(() => [...document.querySelectorAll('a, button')].filter(a => /войти|вход/i.test(a.textContent) || /меню/i.test(a.getAttribute('aria-label') || '')).map(a => ({ t: a.textContent.replace(/\s+/g, ' ').trim().slice(0, 30), aria: a.getAttribute('aria-label'), vis: a.getBoundingClientRect().width > 0 && getComputedStyle(a).visibility !== 'hidden', inDrawer: !!a.closest('.pk-drawer') })));
  step('390: «Войти» видна без открытия меню', mob.some(x => /войти/i.test(x.t) && x.vis && !x.inDrawer), JSON.stringify(mob));
  // Ссылки на вход из подвала/страниц «поставщикам»
  const hints = [];
  for (const rel of ['', 'postavshchikam/', 'o-servise/']) {
    await setSession(m, null);
    await m.goto(URL0 + rel, { waitUntil: 'domcontentloaded' });
    hints.push(rel + ': ' + JSON.stringify(await m.evaluate(() => [...document.querySelectorAll('a')].filter(a => /vhod|kabinet|panel/.test(a.getAttribute('href') || '')).map(a => a.textContent.replace(/\s+/g, ' ').trim().slice(0, 30) + ' → ' + a.getAttribute('href')))));
  }
  step('Точки входа в кабинеты на витрине (для справки)', true, hints.join(' ;; '));
  const panelLinks = await m.evaluate(() => 0);
  await m.close(); await page.close();
}

// ── 3. Сценарии по ТЗ ───────────────────────────────────────────────────────
async function scenarios(browser) {
  const S = RESULT.scenarios;
  const check = (role, name, ok, detail) => { S.push({ role, name, ok: !!ok, detail: short(typeof detail === 'string' ? detail : JSON.stringify(detail), 400) }); log((ok ? '  ✓ ' : '  ✗ ') + `[${role}] ${name}` + (detail ? ' — ' + short(typeof detail === 'string' ? detail : JSON.stringify(detail), 160) : '')); };
  const page = await newPage(browser, 1440);
  const go = async rel => { await page.goto(URL0 + rel, { waitUntil: 'networkidle2' }); await sleep(350); };
  const ev = (fn, ...a) => page.evaluate(fn, ...a);
  const clickText = async (sel, re, scope) => ev((sel, src, flags, scope) => { const re = new RegExp(src, flags); const root = scope ? document.querySelector(scope) : document; const b = [...root.querySelectorAll(sel)].find(x => re.test(x.textContent.replace(/\s+/g, ' ').trim()) && x.getBoundingClientRect().width > 0 && !x.disabled); if (!b) return false; b.click(); return true; }, sel, re.source, re.flags, scope || null);
  const toastText = () => ev(() => [...document.querySelectorAll('.pk-toast')].map(t => t.textContent).join(' | '));
  const money = s => +String(s || '').replace(/[^\d]/g, '') || 0;
  const errs0 = () => page.__ctx.errors.length;

  // ═══ ЗАКУПЩИК ═══
  await setSession(page, 'buyer');
  // B1: счётчики меню = строки
  await go('kabinet/zakazy/');
  const navCounts = await ev(() => Object.fromEntries([...document.querySelectorAll('[data-cab-count]')].map(e => [e.getAttribute('data-cab-count'), +e.textContent.trim() || 0])));
  const countOn = {
    orders: ['kabinet/zakazy/', () => document.querySelectorAll('table.pk-cab-orders tbody tr').length],
    approvals: ['kabinet/soglasovanie/', () => document.querySelectorAll('.pk-cab-appr.is-wait, .pk-cab-appr.is-returned').length],
    regular: ['kabinet/regulyarnye-zakupki/', () => document.querySelectorAll('.pk-cab-reg').length],
    quotes: ['kabinet/zaprosy-kp/', () => [...document.querySelectorAll('.pk-cab-quote')].filter(q => !/Принято|Отозван/.test((q.querySelector('.tag') || {}).textContent || '')).length],
    documents: ['kabinet/dokumenty/', () => document.querySelectorAll('table.pk-cab-docs tbody tr').length],
    specs: ['kabinet/specifikacii/', () => document.querySelectorAll('.pk-cab-spec').length],
    employees: ['kabinet/sotrudniki/', () => document.querySelectorAll('table.pk-cab-emps tbody tr').length]
  };
  const actual = {};
  for (const k of Object.keys(countOn)) { await go(countOn[k][0]); actual[k] = await ev(countOn[k][1]); }
  for (const k of Object.keys(countOn)) check('buyer', `Счётчик меню «${k}» = строк на странице`, navCounts[k] === actual[k], `меню ${navCounts[k]} · на странице ${actual[k]}`);
  // счётчики меню: одинаковы на обзоре (макет) и во вложенных страницах
  await go('kabinet/');
  const legacy = await ev(() => [...document.querySelectorAll('nav a')].filter(a => a.querySelector('.mono')).map(a => ({ t: a.textContent.replace(/\d+\s*$/, '').replace(/\s+/g, ' ').trim(), n: +(a.querySelector('.mono').textContent.trim()) || 0, key: (a.querySelector('[data-cab-legacy-count]') || {}).getAttribute ? a.querySelector('[data-cab-legacy-count]').getAttribute('data-cab-legacy-count') : null })));
  const legacyBad = legacy.filter(x => x.key && navCounts[x.key] !== x.n);
  check('buyer', 'Меню обзора и вложенных страниц: одинаковые счётчики', !legacyBad.length, legacy.map(x => x.t + ' ' + x.n).join(', '));
  const navItems = async rel => { await go(rel); return ev(() => [...document.querySelectorAll('#main nav a, main nav a, aside nav a')].map(a => a.textContent.replace(/\d+\s*$/, '').replace(/\s+/g, ' ').trim()).filter(Boolean)); };
  const n1 = await navItems('kabinet/'), n2 = await navItems('kabinet/zakazy/');
  check('buyer', 'Меню обзора = меню вложенных страниц (одни и те же пункты)', JSON.stringify(n1.filter(x => !/Главная|Кабинет/.test(x))) === JSON.stringify(n2.filter(x => !/Главная|Кабинет/.test(x))), 'обзор: ' + n1.join(', ') + ' ;; разделы: ' + n2.join(', '));
  // обзор: KPI «в пути» и «запросы КП» = данные разделов
  await go('kabinet/');
  const kpi = await ev(() => [...document.querySelectorAll('#main .blueprint')].map(b => b.innerText.replace(/\s+/g, ' ').trim()).filter(t => /КП в работе|в пути/.test(t) && t.length < 40));
  const kpiQ = +((kpi.find(t => /КП в работе/.test(t)) || '').match(/^\d+/) || [])[0];
  check('buyer', 'Обзор: «запросы КП в работе» = счётчик раздела', kpiQ === navCounts.quotes, kpi.join(' ; '));
  // B2: статусы списка = карточка заказа; сумма позиций = итог
  await go('kabinet/zakazy/');
  const list = await ev(() => [...document.querySelectorAll('table.pk-cab-orders tbody tr')].map(tr => ({ id: tr.querySelector('a').textContent.trim(), href: tr.querySelector('a').getAttribute('href'), st: tr.querySelector('.tag').textContent.trim(), sum: tr.lastElementChild.textContent.trim() })));
  const bad = [];
  for (const o of list) {
    await page.goto(ORIGIN + o.href, { waitUntil: 'networkidle2' }); await sleep(250);
    const d = await ev(() => {
      const items = [...document.querySelectorAll('table.pk-cab-items tbody tr')].map(tr => tr.lastElementChild.textContent);
      const tag = document.querySelector('.pk-cab-orderhead .tag');
      const tot = document.querySelector('.pk-cab-total .mono');
      // макет ПК-10428: другая вёрстка
      const legacyTags = [...document.querySelectorAll('#main .tag')].map(t => t.textContent.trim());
      const legacyTotal = [...document.querySelectorAll('#main *')].filter(e => /^Итого/.test(e.textContent.trim()) && e.children.length < 3).map(e => (e.nextElementSibling || e.parentElement).textContent).pop();
      return { items, st: tag ? tag.textContent.trim() : null, total: tot ? tot.textContent : null, legacy: !document.querySelector('.pk-cab-orderhead'), legacyTags, legacyTotal, h1: (document.querySelector('h1') || {}).textContent };
    });
    const sumItems = d.items.reduce((a, x) => a + money(x), 0);
    if (d.legacy) { bad.push(`${o.id}: открывается макетная страница ${o.href} (другая вёрстка; статусы ${d.legacyTags.slice(0, 3).join('/')}, итого ${short(d.legacyTotal, 30)})`); continue; }
    if (d.st !== o.st) bad.push(`${o.id}: статус в списке «${o.st}», в карточке «${d.st}»`);
    if (money(d.total) !== money(o.sum)) bad.push(`${o.id}: сумма в списке ${o.sum}, итог в карточке ${d.total}`);
    if (sumItems !== money(d.total)) bad.push(`${o.id}: сумма позиций ${sumItems} ≠ итог ${d.total}`);
  }
  check('buyer', 'Заказы: статус и сумма в списке = карточка; сумма позиций = итог (' + list.length + ' заказов)', !bad.length, bad.join(' ; '));
  // обзор: таблица заказов — статус = список
  await go('kabinet/');
  const ov = await ev(() => [...document.querySelectorAll('#main table')].filter(t => /Номер/.test(t.tHead ? t.tHead.textContent : '')).flatMap(t => [...t.tBodies[0].rows].map(r => ({ id: r.cells[0].textContent.trim(), st: (r.querySelector('.tag') || {}).textContent }))));
  const ovBad = ov.filter(x => /^ПК-/.test(x.id)).filter(x => { const l = list.find(y => y.id === x.id); return !l || l.st !== x.st; });
  check('buyer', 'Обзор: статусы заказов = список заказов', !ovBad.length, ov.map(x => x.id + ':' + x.st).join(', '));

  // B3: согласование до заказа
  await setSession(page, 'buyer');
  await go('kabinet/soglasovanie/');
  const apprBefore = await ev(() => +document.querySelector('[data-cab-count="approvals"]').textContent);
  const ordersBefore = await ev(() => +document.querySelector('[data-cab-count="orders"]').textContent);
  const docsBefore = await ev(() => +document.querySelector('[data-cab-count="documents"]').textContent);
  const noComment = await ev(() => { const b = [...document.querySelectorAll('.pk-cab-appr button')].find(x => /^Отклонить$/.test(x.textContent.trim())); if (!b) return null; b.click(); return (document.querySelector('.pk-err') || {}).textContent || ''; });
  check('buyer', 'Согласование: «Отклонить» без комментария → ошибка', /причин/i.test(noComment || ''), noComment);
  let steps = 0, finalToast = '';
  for (; steps < 6; steps++) {
    const r = await ev(() => { const c = document.querySelector('.pk-cab-appr.is-wait'); if (!c) return null; const id = c.querySelector('.mono').textContent.split('·')[0].trim(); const b = [...c.querySelectorAll('button')].find(x => /^Согласовать/.test(x.textContent.trim())); const t = b.textContent.trim(); b.click(); return { id, t }; });
    if (!r) break;
    await sleep(200);
    finalToast = await toastText();
    if (/оформить заказ/i.test(r.t)) break;
  }
  const newOrder = (finalToast.match(/ПК-\d+/) || [])[0];
  check('buyer', 'Согласование: заявка проходит маршрут и оформляет заказ', !!newOrder, finalToast);
  await page.reload({ waitUntil: 'networkidle2' }); await sleep(300);
  const after = await ev(() => ({ a: +document.querySelector('[data-cab-count="approvals"]').textContent, o: +document.querySelector('[data-cab-count="orders"]').textContent, d: +document.querySelector('[data-cab-count="documents"]').textContent }));
  check('buyer', 'После оформления: счётчики заказов +1, документов +1 (после перезагрузки)', after.o === ordersBefore + 1 && after.d === docsBefore + 1, { ordersBefore, docsBefore, apprBefore, after });
  if (newOrder) {
    await go('kabinet/zakazy/');
    const row = await ev(id => { const tr = [...document.querySelectorAll('table.pk-cab-orders tbody tr')].find(t => t.textContent.includes(id)); return tr ? { href: tr.querySelector('a').getAttribute('href'), st: tr.querySelector('.tag').textContent, sum: tr.lastElementChild.textContent } : null; }, newOrder);
    check('buyer', `Новый заказ ${newOrder} есть в списке`, !!row, row);
    if (row) {
      const st = await httpStatus(row.href); await page.goto(ORIGIN + row.href, { waitUntil: 'networkidle2' }); await sleep(300);
      const h1 = await ev(() => (document.querySelector('h1') || {}).textContent);
      check('buyer', `Карточка нового заказа открывается (${row.href})`, st === 200 && /Заказ ПК/.test(h1 || ''), `HTTP ${st} · h1 «${h1}»`);
    }
    await go('kabinet/dokumenty/');
    const doc = await ev(id => [...document.querySelectorAll('table.pk-cab-docs tbody tr')].some(t => t.textContent.includes(id)), newOrder);
    check('buyer', 'Счёт по новому заказу есть в «Счета и УПД»', doc, '');
    await go('kabinet/');
    const ovHas = await ev(id => document.querySelector('#main').textContent.includes(id), newOrder);
    check('buyer', 'Обзор кабинета показывает новый заказ', ovHas, 'таблица обзора — статичные строки макета');
  }
  // пустое состояние согласования
  await go('kabinet/soglasovanie/');
  for (let i = 0; i < 12; i++) {
    const r = await ev(() => { const c = document.querySelector('.pk-cab-appr.is-wait, .pk-cab-appr.is-returned'); if (!c) return false; const b = [...c.querySelectorAll('button')].find(x => /^(Согласовать|Уточнить)/.test(x.textContent.trim())); if (!b) return false; b.click(); return true; });
    if (!r) break; await sleep(120);
  }
  const emptyTxt = await ev(() => (document.querySelector('.pk-cab-empty') || {}).textContent || '');
  const cnt0 = await ev(() => (document.querySelector('[data-cab-count="approvals"]') || {}).textContent);
  check('buyer', 'Согласование: когда всё решено — понятное пустое состояние, счётчик 0', /согласован/i.test(emptyTxt) && /^0?$/.test(String(cnt0).trim()), `«${emptyTxt}» · счётчик «${cnt0}»`);

  // B4: запрос КП из кнопки «Новый запрос КП» на странице заказов
  await setSession(page, 'buyer');
  await go('kabinet/zakazy/');
  await clickText('a, button', /^Новый запрос КП$/, '#main');
  await sleep(900);
  const formOpen = await ev(() => ({ url: location.pathname + location.hash, form: !!document.querySelector('#pk-cab-q-name') }));
  check('buyer', '«Новый запрос КП» со страницы заказов открывает форму', formOpen.form, formOpen);
  if (!formOpen.form) { await go('kabinet/zaprosy-kp/'); await clickText('a, button', /^Новый запрос КП$/, '#main'); await sleep(300); }
  const q0 = await ev(() => +document.querySelector('[data-cab-count="quotes"]').textContent);
  await ev(() => { const f = document.querySelector('#pk-cab-q-name'); if (f) f.value = 'QA: насос на оборотную воду 40 м3/ч'; });
  await clickText('button', /^Создать запрос$/);
  await sleep(300); await page.reload({ waitUntil: 'networkidle2' }); await sleep(300);
  const q1 = await ev(() => ({ n: +document.querySelector('[data-cab-count="quotes"]').textContent, has: document.body.textContent.includes('QA: насос') }));
  check('buyer', 'Запрос КП создан, счётчик +1, сохраняется после перезагрузки', q1.has && q1.n === q0 + 1, { q0, q1 });
  const accept = await clickText('button', /^Принять КП$/);
  await sleep(250);
  const accT = await toastText();
  check('buyer', '«Принять КП» оформляет заказ', accept && /оформлен заказ ПК-/.test(accT), accT);

  // B5: регулярные — выключить → обзор отражает
  await setSession(page, 'buyer');
  await go('kabinet/');
  const tagBefore = await ev(() => [...document.querySelectorAll('#main .tag')].map(t => t.textContent).find(t => /^Включена|^Выключена/.test(t)));
  await go('kabinet/regulyarnye-zakupki/');
  await ev(() => { const sw = document.querySelector('.pk-cab-reg input[type=checkbox]:checked'); sw.click(); });
  await sleep(250);
  await go('kabinet/');
  const tagAfter = await ev(() => [...document.querySelectorAll('#main .tag')].map(t => t.textContent).find(t => /^Включена|^Выключена/.test(t)));
  check('buyer', 'Автозакупка: выключение в разделе видно на обзоре', tagBefore !== tagAfter, `${tagBefore} → ${tagAfter}`);
  await go('kabinet/regulyarnye-zakupki/');
  const o0 = await ev(() => +document.querySelector('[data-cab-count="orders"]').textContent);
  await ev(() => { const b = [...document.querySelectorAll('.pk-cab-reg button')].find(x => /Сформировать счёт/.test(x.textContent) && !x.closest('.pk-cab-reg').querySelector('.pk-cab-warn')); b && b.click(); });
  await sleep(250);
  const regT = await toastText(); const o1 = await ev(() => +document.querySelector('[data-cab-count="orders"]').textContent);
  check('buyer', '«Сформировать счёт сейчас» → заказ, счётчик заказов +1', o1 === o0 + 1, regT + ` · ${o0}→${o1}`);

  // B6: сотрудники, спецификации, реквизиты
  await setSession(page, 'buyer');
  await go('kabinet/sotrudniki/');
  const e0 = await ev(() => document.querySelectorAll('table.pk-cab-emps tbody tr').length);
  await clickText('a, button', /Добавить сотрудника|Пригласить|Новый сотрудник/, '#main');
  await sleep(250);
  const empForm = await ev(() => !!document.querySelector('#pk-cab-e-name'));
  if (empForm) { await page.type('#pk-cab-e-name', 'Тестов Тест Тестович'); await clickText('button', /^Добавить$/); await sleep(250); }
  await page.reload({ waitUntil: 'networkidle2' }); await sleep(250);
  const e1 = await ev(() => ({ rows: document.querySelectorAll('table.pk-cab-emps tbody tr').length, nav: +document.querySelector('[data-cab-count="employees"]').textContent }));
  check('buyer', 'Сотрудник добавляется, строк и счётчик +1 после перезагрузки', empForm && e1.rows === e0 + 1 && e1.nav === e1.rows, { e0, e1, empForm });
  await go('kabinet/rekvizity/');
  await ev(() => { const i = document.querySelector('[data-k="rq-name"]'); i.value = 'ООО «QA Завод»'; });
  await clickText('button', /^Сохранить реквизиты$/); await sleep(300);
  const rqT = await toastText();
  await go('kabinet/zakazy/');
  const compShown = await ev(() => ({ side: (document.querySelector('[data-cab-company]') || {}).textContent, header: (document.querySelector('.pk-ubtn') || {}).textContent }));
  await go('kabinet/');
  const compOv = await ev(() => document.querySelector('#main').textContent.includes('QA Завод'));
  check('buyer', 'Реквизиты: новое название видно в меню разделов, на обзоре и в шапке', /QA Завод/.test(compShown.side || '') && compOv && /QA Завод/.test(compShown.header || ''), Object.assign({ toast: rqT, overview: compOv }, compShown));
  // уведомления сохраняются
  await go('kabinet/uvedomleniya/');
  const nb = await ev(() => { const c = document.querySelector('main input[type=checkbox], #main input[type=checkbox]'); if (!c) return null; c.click(); return c.checked; });
  await page.reload({ waitUntil: 'networkidle2' }); await sleep(300);
  const na = await ev(() => { const c = document.querySelector('main input[type=checkbox], #main input[type=checkbox]'); return c ? c.checked : null; });
  check('buyer', 'Уведомления: переключатель сохраняется после перезагрузки', nb !== null && nb === na, { clicked: nb, afterReload: na });
  const inputsN = await ev(() => [...document.querySelectorAll('#main input:not([type=checkbox]), #main select')].map(i => (i.labels && i.labels[0] ? i.labels[0].textContent.trim() : i.placeholder) + '=' + i.value));
  await ev(() => { const i = document.querySelector('#main input:not([type=checkbox]), #main select'); if (i) { i.value = i.tagName === 'SELECT' ? (i.options[1] || i.options[0]).value : '5%'; i.dispatchEvent(new Event('change', { bubbles: true })); } });
  await page.reload({ waitUntil: 'networkidle2' }); await sleep(300);
  const inputsN2 = await ev(() => [...document.querySelectorAll('#main input:not([type=checkbox]), #main select')].map(i => (i.labels && i.labels[0] ? i.labels[0].textContent.trim() : i.placeholder) + '=' + i.value));
  check('buyer', 'Уведомления: поля (тихие часы/порог цены) сохраняются после перезагрузки', JSON.stringify(inputsN) !== JSON.stringify(inputsN2) || !inputsN.length, { before: inputsN.slice(0, 4), after: inputsN2.slice(0, 4) });

  // ═══ ПОСТАВЩИК ═══
  await setSession(page, 'vendor');
  await go('kabinet-postavshchika/zayavki/');
  const vnav = await ev(() => Object.fromEntries([...document.querySelectorAll('[data-ven-count]')].map(e => [e.getAttribute('data-ven-count') + '@' + e.closest('a').textContent.replace(/\d+/g, '').trim(), e.hidden ? 0 : +e.textContent || 0])));
  const vrows = await ev(() => { const rows = [...document.querySelectorAll('[data-ven-orders] tr')]; const by = {}; rows.forEach(r => { const t = (r.querySelector('.tag') || {}).textContent; by[t] = (by[t] || 0) + 1; }); return { total: rows.length, by, chips: [...document.querySelectorAll('[data-ven-chips] [data-st]')].map(b => b.textContent.replace(/\s+/g, ' ').trim()) }; });
  const newNav = Object.entries(vnav).find(([k]) => /^new@/.test(k));
  check('vendor', 'Счётчик «Заявки» в меню = число строк со статусом «Новая»', newNav && newNav[1] === (vrows.by['Новая'] || 0), { nav: vnav, rows: vrows.by });
  await go('kabinet-postavshchika/');
  const vov = await ev(() => ({ nav: [...document.querySelectorAll('nav.blueprint a')].map(a => a.textContent.replace(/\s+/g, ' ').trim() + ' → ' + (a.getAttribute('href') || '').replace('/b2b-marketplace/', '')), rows: [...document.querySelectorAll('#main table')].filter(t => /Заявка/i.test(t.tHead ? t.tHead.textContent : '')).flatMap(t => [...t.tBodies[0].rows].map(r => r.cells[0].textContent.replace(/\s+/g, ' ').trim().slice(0, 7) + ':' + ((r.querySelector('.tag') || {}).textContent || '').trim())) }));
  await go('kabinet-postavshchika/zayavki/');
  const vsub = await ev(() => [...document.querySelectorAll('aside a, nav a')].filter(a => a.closest('.blueprint')).map(a => a.textContent.replace(/\d+/g, '').replace(/\s+/g, ' ').trim()));
  await go('kabinet-postavshchika/');
  const vovNames = vov.nav.map(x => x.split(' → ')[0].replace(/\d+/g, '').trim());
  check('vendor', 'Сводка и разделы: одинаковое меню', JSON.stringify(vovNames.slice().sort()) === JSON.stringify(vsub.slice().sort()), 'сводка: ' + vovNames.join(', ') + ' ;; разделы: ' + vsub.join(', '));
  const otgr = await ev(() => { const a = [...document.querySelectorAll('.pv-stat-link')].find(x => /к отгрузке/.test(x.textContent)); return a ? a.textContent.replace(/\s+/g, ' ').trim() + ' → ' + a.getAttribute('href').replace('/b2b-marketplace/', '') : null; });
  if (otgr) { const n = +(otgr.match(/^(\d+)/) || [])[1]; await page.goto(URL0 + otgr.split(' → ')[1], { waitUntil: 'networkidle2' }); await sleep(300); const shown = await ev(() => document.querySelectorAll('[data-ven-orders] tr').length); check('vendor', '«Отгрузки» в сводке: цифра в меню = строк по ссылке', n === shown, `в меню ${n}, по ссылке ${shown} строк`); }
  check('vendor', 'Сводка: таблица заявок = список заявок (новые ЗВ-4822/4823 видны)', vov.rows.some(r => /4823/.test(r)), vov.rows.join(', '));
  // подтвердить новую заявку
  await go('kabinet-postavshchika/zayavki/');
  const firstNew = await ev(() => { const b = document.querySelector('[data-ven-act="confirm"]'); if (!b) return null; const id = b.getAttribute('data-id'); b.click(); return id; });
  await sleep(300);
  const dlg = await ev(() => { const d = document.querySelector('dialog[open]'); return d ? { title: d.querySelector('h2').textContent, focusIn: d.contains(document.activeElement) } : null; });
  check('vendor', 'Подтверждение открывает диалог с фокусом внутри', dlg && dlg.focusIn, dlg);
  await page.keyboard.press('Escape'); await sleep(200);
  const escClosed = await ev(() => !document.querySelector('dialog[open]'));
  check('vendor', 'Диалог закрывается по Esc', escClosed, '');
  await ev(id => document.querySelector(`[data-ven-act="confirm"][data-id="${id}"]`).click(), firstNew); await sleep(250);
  await ev(() => document.querySelector('dialog[open] button[type=submit]').click()); await sleep(300);
  await page.reload({ waitUntil: 'networkidle2' }); await sleep(300);
  const stList = await ev(id => { const r = [...document.querySelectorAll('[data-ven-orders] tr')].find(tr => tr.textContent.includes(id)); return r ? (r.querySelector('.tag') || {}).textContent : null; }, firstNew);
  const navNew = await ev(() => { const e = [...document.querySelectorAll('[data-ven-count="new"]')][0]; return e ? (e.hidden ? 0 : +e.textContent) : null; });
  check('vendor', `Подтверждённая ${firstNew}: статус «Подтверждена» после перезагрузки, счётчик новых −1`, stList === 'Подтверждена' && navNew === (vrows.by['Новая'] || 0) - 1, { stList, navNew });
  const slug = firstNew ? firstNew.toLowerCase().replace('зв-', 'zv-') : '';
  await go('kabinet-postavshchika/zayavka/' + slug + '/');
  const card = await ev(() => ({ tags: [...document.querySelectorAll('[data-ven-order] .tag')].map(t => t.textContent.trim()), hist: /Подтверждена/.test((document.querySelector('[data-ven-order]') || {}).textContent || '') }));
  check('vendor', `Карточка ${firstNew}: статус = список, история содержит действие`, card.tags.includes('Подтверждена') && card.hist, card);
  await go('kabinet-postavshchika/');
  const ovSt = await ev(id => { const r = [...document.querySelectorAll('#main table tr')].find(tr => tr.textContent.includes(id)); return r ? (r.querySelector('.tag') || {}).textContent : 'нет строки'; }, firstNew);
  check('vendor', `Сводка: статус ${firstNew} = список`, ovSt === 'Подтверждена', ovSt);
  // прайс: правка → сохранить → перезагрузка → сводка
  await go('kabinet-postavshchika/prajs/');
  const p0 = await ev(() => { const i = document.querySelector('.pv-cell[data-f="price"]'); return { id: i.getAttribute('data-row'), v: i.value, name: i.closest('tr').textContent.replace(/\s+/g, ' ').slice(0, 40), sku: (i.closest('tr').querySelector('.mono') || {}).textContent }; });
  await page.click(`.pv-cell[data-f="price"][data-row="${p0.id}"]`, { clickCount: 3 }); await page.keyboard.type('77777');
  await ev(() => document.querySelector('[data-ven-save]').click()); await sleep(300);
  await page.reload({ waitUntil: 'networkidle2' }); await sleep(300);
  const p1 = await ev(id => { const i = document.querySelector(`.pv-cell[data-f="price"][data-row="${id}"]`); return { v: i && i.value, src: i && (i.closest('tr').querySelector('.pv-src') || {}).textContent }; }, p0.id);
  check('vendor', 'Прайс: правка цены сохраняется, источник «ручная правка»', money(p1.v) === 77777 && /ручн/.test(p1.src || ''), { p0, p1 });
  await go('kabinet-postavshchika/');
  const ovPrice = await ev(sku => { const r = [...document.querySelectorAll('#main table tr')].find(tr => sku && tr.textContent.includes(sku.trim())); return r ? [...r.querySelectorAll('input, [data-f="price"]')].map(i => i.value != null ? i.value : i.textContent) : null; }, p0.sku);
  check('vendor', 'Сводка: цена позиции = прайс-редактор', ovPrice && money(ovPrice[0]) === 77777, { sku: p0.sku, ovPrice });
  // расчёты: сумма к оплате = сумма заявок «К расчёту»
  await go('kabinet-postavshchika/zayavki/?st=' + encodeURIComponent('К расчёту'));
  const toPay = await ev(() => [...document.querySelectorAll('[data-ven-orders] tr')].reduce((a, r) => a + (+([...r.cells].map(c => c.textContent).find(t => /₽/.test(t)) || '').replace(/[^\d]/g, '') || 0), 0));
  await go('kabinet-postavshchika/raschety/');
  const settle = await ev(() => [...document.querySelectorAll('[data-ven-stats] .pv-stat')].map(s => s.textContent.replace(/\s+/g, ' ').trim()));
  check('vendor', 'Расчёты: «к оплате» = сумма заявок «К расчёту»', settle[0] && money(settle[0].split('₽')[0]) === toPay, { toPay, settle });
  const payNav = await ev(() => { const e = document.querySelector('[data-ven-count="pay"]'); return e ? +e.textContent || 0 : null; });
  const payN = settle.slice(0, 2).reduce((a, t) => a + (+((t.match(/·\s*(\d+)/) || [])[1]) || 0), 0);
  check('vendor', 'Счётчик «Расчёты» в меню = заявок «к оплате» + «ждут УПД»', payNav === payN, { payNav, payN });
  // настройки: минимальная сумма → сводка
  await go('kabinet-postavshchika/nastrojki/');
  await page.click('[name=minSum]', { clickCount: 3 }); await page.keyboard.type('25000');
  await ev(() => document.querySelector('[data-ven-settings]').requestSubmit()); await sleep(300);
  await go('kabinet-postavshchika/');
  const ovMin = await ev(() => { const m = document.querySelector('[data-ven-minsum]'); if (m) return m.textContent; const f = [...document.querySelectorAll('.field')].find(x => /Минимальная сумма/.test(x.textContent)); return f ? f.querySelector('input').value : null; });
  check('vendor', 'Настройки: минимальная сумма заказа = поле на сводке', money(ovMin) === 25000, { ovMin });
  await go('kabinet-postavshchika/vygruzka/');
  const feedFmt = await ev(() => ({ fmt: (document.querySelector('input[name=format]:checked') || {}).value, sched: (document.querySelector('[name=schedule]') || {}).value }));
  await go('kabinet-postavshchika/');
  const ovFeed = await ev(() => [...document.querySelectorAll('#main select, [data-ven-schedule], [data-ven-format]')].map(s => s.value != null ? s.value : s.textContent));
  check('vendor', 'Выгрузка: формат и частота = поля «Состояние выгрузки» на сводке', ovFeed.join(' ').includes(feedFmt.sched || '§'), { feedFmt, ovFeed });

  // ═══ ОПЕРАТОР ═══
  await setSession(page, 'operator');
  await go('panel/crm/');
  const kb = await ev(() => [...document.querySelectorAll('.pk-kb-col')].map(c => ({ t: c.getAttribute('aria-label'), counter: (c.querySelector('.mono') || {}).textContent, cards: c.querySelectorAll('.pk-kb-card').length })));
  check('operator', 'CRM: число в заголовке колонки = карточек в колонке', kb.every(c => +String(c.counter).split('·')[0] === c.cards), kb.map(c => `${c.t}: ${c.counter} / карточек ${c.cards}`).join(' ; '));
  const mv = await ev(() => { const c = document.querySelector('.pk-kb-col[data-col="0"] .pk-kb-card'); const t = c.getAttribute('data-deal'); c.querySelector('.pk-kb-move').click(); return t; });
  await sleep(250);
  await ev(() => { const d = [...document.querySelectorAll('[role=dialog], dialog')].find(x => x.querySelector('input[name=col]')); d.querySelector('input[name=col][value="2"]').click(); [...d.querySelectorAll('button')].find(b => /^Переместить$/.test(b.textContent.trim())).click(); });
  await sleep(400);
  await page.reload({ waitUntil: 'networkidle2' }); await sleep(300);
  const mvCol = await ev(id => { const c = document.querySelector(`.pk-kb-card[data-deal="${id}"]`); return c ? c.parentElement.getAttribute('data-col') : null; }, mv);
  check('operator', 'CRM: перемещение сделки сохраняется после перезагрузки', mvCol === '2', { deal: mv, col: mvCol });
  if (/^sd-/.test(mv)) {
    await go('panel/sdelki/' + mv + '/');
    const stage = await ev(() => { const s = document.querySelector('[data-deal-stage]'); return s ? s.options[s.selectedIndex].text : null; });
    check('operator', `Страница сделки ${mv}: этап = колонка канбана`, /Переговор/.test(stage || ''), stage);
  } else check('operator', 'Первая сделка «Входящих» имеет страницу сделки', false, 'id ' + mv + ' — без /panel/sdelki/ страницы');
  await go('panel/zhurnal/');
  const j = await ev(() => [...document.querySelectorAll('[data-j-body] tr')].slice(0, 3).map(r => r.textContent.replace(/\s+/g, ' ').trim().slice(0, 100)));
  check('operator', 'Журнал изменений отражает перемещение сделки', j.some(x => /Сделка/.test(x) && /Переговоры/.test(x)), j);
  const roll = await ev(() => { const b = [...document.querySelectorAll('[data-j-body] button')].find(x => /Откатить/.test(x.textContent)); if (!b) return false; b.click(); return true; });
  await sleep(300);
  await go('panel/crm/');
  const rolledCol = await ev(id => { const c = document.querySelector(`.pk-kb-card[data-deal="${id}"]`); return c ? c.parentElement.getAttribute('data-col') : null; }, mv);
  check('operator', 'Откат в журнале возвращает сделку в исходную колонку', roll && rolledCol === '0', { roll, rolledCol });
  // автопилот: очередь
  await go('panel/avtopilot/');
  const q = await ev(() => { const h = [...document.querySelectorAll('h3')].find(x => /^Ждёт человека/.test(x.textContent)); const rows = document.querySelectorAll('.pk-apq-row').length; const kpi = [...document.querySelectorAll('#main .blueprint')].find(b => /ждут человека/.test(b.textContent) && !b.querySelector('h3')); return { h: h && h.textContent, rows, kpi: kpi && kpi.querySelector('.mono').textContent }; });
  check('operator', 'Автопилот: «Ждёт человека · N» = строк очереди = KPI', +String(q.h).replace(/\D/g, '') === q.rows && +q.kpi === q.rows, q);
  await ev(() => { const b = [...document.querySelectorAll('.pk-apq-row button')].find(x => /^Решено$/.test(x.textContent.trim())); b && b.click(); });
  await sleep(600);
  const isModal = await ev(() => !!document.querySelector('[role=dialog]:not([hidden]), dialog[open]'));
  await page.reload({ waitUntil: 'networkidle2' }); await sleep(300);
  const q2 = await ev(() => ({ rows: document.querySelectorAll('.pk-apq-row').length, h: ([...document.querySelectorAll('h3')].find(x => /^Ждёт человека/.test(x.textContent)) || {}).textContent }));
  check('operator', 'Автопилот: «Решено» убирает задачу из очереди навсегда', isModal || q2.rows === q.rows - 1, { q2, modal: isModal });
  // клиенты: список → карточки
  await go('panel/klienty/');
  const cl = await ev(() => ({ rows: document.querySelectorAll('#main table tbody tr').length, links: [...document.querySelectorAll('#main table tbody a')].map(a => a.getAttribute('href')), summary: (document.querySelector('#main h1') || {}).textContent }));
  const cl404 = []; for (const h of cl.links) { if ((await httpStatus(h)) === 404) cl404.push(h); }
  check('operator', 'Клиенты: ссылки из списка открываются', !cl404.length, { rows: cl.rows, bad: cl404 });
  // поставщик приостановлен → кабинет поставщика видит
  await go('panel/postavshchiki/');
  const paused = await ev(() => { const tr = document.querySelector('tr[data-sup="gidromash"]'); if (!tr) return null; tr.querySelector('[data-sup-pause]').click(); return true; });
  await sleep(250);
  await ev(() => { const d = [...document.querySelectorAll('[role=dialog], dialog')].find(x => /Приостановить/.test(x.textContent)); if (d) { const s = d.querySelector('select'); if (s) { s.selectedIndex = 1; s.dispatchEvent(new Event('change', { bubbles: true })); } [...d.querySelectorAll('button')].find(b => /^Приостановить$/.test(b.textContent.trim())).click(); } });
  await sleep(300);
  const ls = await ev(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) o[localStorage.key(i)] = localStorage.getItem(i); return Object.keys(o); });
  // та же вкладка → сессия поставщика, localStorage общий
  await ev(() => { const s = JSON.parse(localStorage.getItem('pk:session')); s.role = 'vendor'; s.name = 'Семёнова Ольга'; s.company = 'ООО «Гидромаш»'; localStorage.setItem('pk:session', JSON.stringify(s)); });
  await go('kabinet-postavshchika/zayavki/');
  const banner = await ev(() => (document.querySelector('.pk-bus-banner') || {}).textContent || '');
  check('vendor', 'Связка: оператор приостановил Гидромаш → кабинет поставщика показывает баннер', paused && /приостановил/i.test(banner), banner || 'баннера нет (связка в работе у другого агента)');
  // закупщик → поставщик/оператор: оформленный через согласование заказ
  await ev(() => { localStorage.setItem('pk:session', JSON.stringify({ role: 'buyer', name: 'Кузнецов Андрей', company: 'ООО «Метизный завод»', initials: 'КА', title: 'закупщик' })); });
  await go('kabinet/soglasovanie/');
  for (let i = 0; i < 4; i++) { const r = await ev(() => { const c = document.querySelector('.pk-cab-appr.is-wait'); if (!c) return null; const b = [...c.querySelectorAll('button')].find(x => /^Согласовать/.test(x.textContent.trim())); const t = b.textContent; b.click(); return t; }); await sleep(150); if (!r || /оформить/.test(r)) break; }
  const busOrder = ((await toastText()).match(/ПК-\d+/) || [])[0];
  await ev(() => { localStorage.setItem('pk:session', JSON.stringify({ role: 'operator', name: 'Петров А.', company: 'ПРОМКОНТУР', initials: 'ПА', title: 'админ' })); });
  await go('panel/crm/');
  const inCrm = await ev(id => !!id && document.body.textContent.includes(id), busOrder);
  check('operator', 'Связка: заказ из согласования закупщика появляется в CRM оператора', inCrm, busOrder || 'заказ не оформился');
  await page.close();
}

// ── 4. Визуал: скриншоты + автоматические замеры ───────────────────────────
const UNIQUE = rels => { const seen = {}; return rels.filter(r => { const g = GROUP_OF(r); if (!g) return true; seen[g] = (seen[g] || 0) + 1; return seen[g] <= 1; }); };
const VISUAL_PROBE = () => {
  const vw = document.documentElement.clientWidth, out = [];
  const vis = e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const label = e => e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '') + ' «' + (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40) + '»';
  if (document.documentElement.scrollWidth > vw + 1) out.push({ kind: 'h-scroll', detail: 'страница шире экрана: ' + document.documentElement.scrollWidth + ' > ' + vw });
  const main = document.querySelector('#main') || document.body;
  // выход за правый край (без прокручиваемого контейнера)
  let wide = [];
  for (const e of main.querySelectorAll('*')) {
    if (!vis(e)) continue;
    const r = e.getBoundingClientRect();
    if (r.right > vw + 2 && r.width < vw * 3) {
      let sc = false; for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') { sc = true; break; } }
      if (!sc) wide.push(label(e) + ' right=' + Math.round(r.right));
    }
  }
  if (wide.length) out.push({ kind: 'overflow-right', detail: wide.length + ' эл., напр.: ' + wide.slice(0, 3).join(' ; ') });
  // мелкий текст
  const small = new Map();
  for (const e of main.querySelectorAll('*')) {
    if (!vis(e) || ![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const fs = parseFloat(getComputedStyle(e).fontSize);
    if (fs < 12) small.set(label(e), fs);
  }
  if (small.size) out.push({ kind: 'small-text', detail: small.size + ' эл. <12px, напр.: ' + [...small].slice(0, 3).map(([k, v]) => k + ' ' + v + 'px').join(' ; ') });
  // обрезанный текст
  const clipped = [];
  for (const e of main.querySelectorAll('*')) {
    if (!vis(e) || e.children.length > 2 || !(e.textContent || '').trim()) continue;
    const cs = getComputedStyle(e);
    if ((cs.overflow === 'hidden' || cs.textOverflow === 'ellipsis' || cs.overflowX === 'hidden') && (e.scrollWidth > e.clientWidth + 2) && cs.whiteSpace !== 'normal') clipped.push(label(e));
  }
  if (clipped.length) out.push({ kind: 'clipped-text', detail: clipped.length + ' эл., напр.: ' + clipped.slice(0, 3).join(' ; ') });
  // мелкие цели нажатия на телефоне
  if (vw < 600) {
    const tiny = [...main.querySelectorAll('a, button, input, select, [role=button], summary')].filter(vis).filter(e => { const r = e.getBoundingClientRect(); return (r.height < 32 || r.width < 32) && !(e.tagName === 'A' && getComputedStyle(e).display === 'inline'); });
    if (tiny.length) out.push({ kind: 'tap-target<32', detail: tiny.length + ' эл., напр.: ' + tiny.slice(0, 4).map(label).join(' ; ') });
  }
  // пустые карточки
  const emptyCards = [...main.querySelectorAll('.blueprint, .card, section')].filter(vis).filter(e => !(e.innerText || '').trim() && !e.querySelector('img, svg, canvas, input, [style*="background"]') && e.getBoundingClientRect().height > 40);
  if (emptyCards.length) out.push({ kind: 'empty-block', detail: emptyCards.length + ' эл., напр.: ' + emptyCards.slice(0, 3).map(label).join(' ; ') });
  // перекрытия: интерактивные элементы, центр которых закрыт другим (без прокрутки, только в первом экране)
  const covered = [];
  for (const e of [...main.querySelectorAll('a, button, input, select')].filter(vis)) {
    const r = e.getBoundingClientRect(); if (r.top < 0 || r.bottom > innerHeight) continue;
    const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (t && t !== e && !e.contains(t) && !t.contains(e) && !(t.closest('label') && t.closest('label').contains(e))) covered.push(label(e) + ' под ' + label(t));
  }
  if (covered.length) out.push({ kind: 'overlap', detail: covered.length + ' эл., напр.: ' + covered.slice(0, 3).join(' ; ') });
  // демо-подписи и навигация
  const text = document.body.innerText;
  const info = {
    h1: [...document.querySelectorAll('h1')].map(h => h.textContent.replace(/\s+/g, ' ').trim()),
    demoMarks: (text.match(/демо/gi) || []).length,
    crumbs: !!document.querySelector('[aria-label*="крошк" i], .pk-cab-crumbs, nav[aria-label*="Навигац" i] ol, .crumbs, [class*="crumb"]'),
    backToStore: [...document.querySelectorAll('a')].some(a => /^\/b2b-marketplace\/?$/.test(a.getAttribute('href') || '') && vis(a)),
    currentNav: [...document.querySelectorAll('[aria-current="page"]')].filter(vis).map(a => a.textContent.replace(/\s+/g, ' ').trim().slice(0, 30)),
    height: document.documentElement.scrollHeight,
    storefrontHeader: !!document.querySelector('input[placeholder*="артикул"]'),
    tables: document.querySelectorAll('table').length
  };
  return { issues: out, info };
};

async function visual(browser) {
  let pages = UNIQUE(closedPages()).concat(['vhod/']);
  if (PAGE_FILTER) pages = pages.filter(p => PAGE_FILTER.some(f => p.includes(f)));
  if (args.shots) fs.mkdirSync(SHOTS, { recursive: true });
  for (const vp of VPS) {
    const page = await newPage(browser, vp);
    for (const rel of pages) {
      const role = ROLE_OF(rel);
      await openPage(page, rel, role);
      await sleep(300);
      const { issues, info } = await page.evaluate(VISUAL_PROBE);
      RESULT.pagesInfo = RESULT.pagesInfo || [];
      RESULT.pagesInfo.push(Object.assign({ rel, vp }, info));
      for (const i of issues) RESULT.visual.push(Object.assign({ page: rel, vp }, i));
      if (args.shots) {
        const name = (rel.replace(/\/$/, '').replace(/\//g, '__') || 'root') + '-' + vp + '.jpg';
        await page.screenshot({ path: path.join(SHOTS, name), fullPage: true, type: 'jpeg', quality: 55, captureBeyondViewport: true }).catch(e => log('shot fail ' + rel + ' ' + e.message));
      }
      log(`[${vp}] ${rel.padEnd(48)} визуал: ${issues.map(i => i.kind).join(', ') || 'ок'}`);
    }
    await page.close();
  }
  fs.writeFileSync(OUT, JSON.stringify(RESULT, null, 1));
}

// ── 5. Доступность ──────────────────────────────────────────────────────────
async function a11y(browser) {
  let pages = UNIQUE(closedPages()).concat(['vhod/']);
  if (PAGE_FILTER) pages = pages.filter(p => PAGE_FILTER.some(f => p.includes(f)));
  const page = await newPage(browser, 1440);
  for (const rel of pages) {
    const role = ROLE_OF(rel);
    await openPage(page, rel, role);
    const res = await page.evaluate(() => {
      const vis = e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
      const out = [];
      const name = e => (e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') && (document.getElementById(e.getAttribute('aria-labelledby')) || {}).textContent || e.textContent || e.getAttribute('title') || e.value || (e.querySelector('img[alt]') || {}).alt || '').trim();
      const nolabel = [...document.querySelectorAll('input:not([type=hidden]), select, textarea')].filter(vis).filter(e => !(e.labels && e.labels.length) && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby') && !e.getAttribute('title'));
      if (nolabel.length) out.push({ kind: 'field-no-label', n: nolabel.length, ex: nolabel.slice(0, 4).map(e => (e.type || e.tagName) + ' ph=«' + (e.placeholder || '') + '» val=«' + String(e.value).slice(0, 20) + '»') });
      const noname = [...document.querySelectorAll('button, a[href], [role=button]')].filter(vis).filter(e => !name(e));
      if (noname.length) out.push({ kind: 'button-no-name', n: noname.length, ex: noname.slice(0, 4).map(e => e.outerHTML.slice(0, 120)) });
      const h1 = document.querySelectorAll('h1').length; if (h1 !== 1) out.push({ kind: 'h1-count', n: h1 });
      const clickDivs = [...document.querySelectorAll('[data-href], tr[style*="cursor"]')].filter(vis).filter(e => !e.hasAttribute('tabindex') && !e.querySelector('a[href]'));
      if (clickDivs.length) out.push({ kind: 'clickable-not-focusable', n: clickDivs.length, ex: clickDivs.slice(0, 3).map(e => e.tagName + ' ' + e.textContent.replace(/\s+/g, ' ').trim().slice(0, 40)) });
      const dup = {}; [...document.querySelectorAll('[id]')].forEach(e => { dup[e.id] = (dup[e.id] || 0) + 1; }); const d = Object.keys(dup).filter(k => dup[k] > 1);
      if (d.length) out.push({ kind: 'duplicate-id', n: d.length, ex: d.slice(0, 5) });
      const cb = [...document.querySelectorAll('input[type=checkbox]')].filter(e => { const r = e.getBoundingClientRect(); return r.width === 0 || getComputedStyle(e).opacity === '0'; }).filter(e => !e.labels || !e.labels.length);
      if (cb.length) out.push({ kind: 'hidden-checkbox-no-label', n: cb.length });
      return out;
    });
    // фокус: Tab по первым 25 элементам — есть ли видимый индикатор
    await page.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
    const noFocus = [];
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      const f = await page.evaluate(() => {
        const e = document.activeElement; if (!e || e === document.body) return null;
        const cs = getComputedStyle(e);
        const visible = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none');
        return { visible, t: e.tagName.toLowerCase() + ' «' + (e.getAttribute('aria-label') || e.textContent || e.placeholder || '').replace(/\s+/g, ' ').trim().slice(0, 30) + '»' };
      });
      if (f && !f.visible) noFocus.push(f.t);
    }
    if (noFocus.length) res.push({ kind: 'focus-not-visible', n: noFocus.length, ex: noFocus.slice(0, 4) });
    for (const r of res) RESULT.a11y.push(Object.assign({ page: rel }, r));
    log(`${rel.padEnd(48)} a11y: ${res.map(r => r.kind + '×' + r.n).join(', ') || 'ок'}`);
  }
  await page.close();
  fs.writeFileSync(OUT, JSON.stringify(RESULT, null, 1));
}

// ── main ────────────────────────────────────────────────────────────────────
(async () => {
  const ping = await httpStatus(URL0);
  if (ping !== 200) { console.error('Сайт не отвечает: ' + URL0 + ' (' + ping + ')'); process.exit(2); }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
  try {
    if (ONLY.has('login')) { log('── 1. Вход'); await loginFlows(browser); }
    if (ONLY.has('crawl')) { log('── 2. Обход'); await crawl(browser); }
    if (ONLY.has('scenarios') && typeof scenarios === 'function') { log('── 3. Сценарии'); await scenarios(browser); }
    if (ONLY.has('visual') && typeof visual === 'function') { log('── 4. Визуал'); await visual(browser); }
    if (ONLY.has('a11y') && typeof a11y === 'function') { log('── 5. Доступность'); await a11y(browser); }
  } finally { await browser.close(); }
  finish();
})().catch(e => { console.error(e); process.exit(3); });

function finish() {
  const els = RESULT.pages.flatMap(p => p.elements.map(e => Object.assign({ page: p.rel, vp: p.vp }, e)));
  const S = RESULT.summary = {
    pages: new Set(RESULT.pages.map(p => p.rel)).size,
    pageLoads: RESULT.pages.length,
    elements: els.length,
    clicked: els.filter(e => !/NOT_CLICKED|SKIPPED|DUP_CHROME/.test(e.result)).length,
    dead: els.filter(e => e.result === 'DEAD').length,
    stubToasts: els.filter(e => e.result === 'STUB_TOAST').length,
    inputNoReaction: els.filter(e => e.result === 'INPUT_NO_REACTION').length,
    covered: els.filter(e => e.covered).length,
    nav404: els.filter(e => e.result === 'NAV_404').length,
    links404: RESULT.links404.length,
    jsErrors: RESULT.pages.reduce((a, p) => a + p.loadErrors.length, 0) + els.reduce((a, e) => a + (e.jsErrors ? e.jsErrors.length : 0), 0),
    badResources: RESULT.pages.reduce((a, p) => a + (p.loadBad || []).length, 0),
    loginFailed: RESULT.login.filter(x => !x.ok).length,
    scenariosFailed: RESULT.scenarios.filter(x => !x.ok).length,
    scenarios: RESULT.scenarios.length,
    visualIssues: RESULT.visual.length,
    a11yIssues: RESULT.a11y.length,
    byResult: els.reduce((m, e) => (m[e.result] = (m[e.result] || 0) + 1, m), {})
  };
  RESULT.finished = new Date().toISOString();
  fs.writeFileSync(OUT, JSON.stringify(RESULT, null, 1));
  console.log('\n══ ИТОГ e2e кабинетов');
  console.log(`страниц: ${S.pages} (загрузок ${S.pageLoads}) · элементов: ${S.elements}, кликнуто ${S.clicked}`);
  console.log(`мёртвых: ${S.dead} · заглушек-тостов: ${S.stubToasts} · полей без реакции: ${S.inputNoReaction} · перекрытых: ${S.covered}`);
  console.log(`ошибок JS: ${S.jsErrors} · 404 по кликам: ${S.nav404} · битых ссылок: ${S.links404} · битых ресурсов: ${S.badResources}`);
  console.log(`вход: провалов ${S.loginFailed} из ${RESULT.login.length} · сценарии: провалов ${S.scenariosFailed} из ${S.scenarios} · визуал: ${S.visualIssues} · доступность: ${S.a11yIssues}`);
  console.log('→ ' + path.relative(ROOT, OUT));
  process.exitCode = S.dead || S.jsErrors || S.nav404 || S.links404 || S.scenariosFailed || S.loginFailed ? 1 : 0;
}

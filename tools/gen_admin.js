#!/usr/bin/env node
// Панель оператора: недостающие страницы (сделки, клиенты, поставщики, журнал) + данные для admin.js.
//   Контракт сборщика: module.exports = ctx => [{ path, title, desc, h1, html, chrome: 'ops', scripts: ['admin.js'], index: false }]
//   Данные — tools/data/admin.json, товары — tools/data/products.json.
//   Экраны панели из макета (panel/crm, avtopilot, prava, admin…) сборщик пишет без admin.js — генератор дописывает
//   в них <script src="assets/admin.js"> и JSON с данными (во временную папку сборки текущего процесса).
//   Для итераций без полной сборки: node tools/gen_admin.js --inject site
const fs = require('fs');
const path = require('path');

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rub = n => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽';
const num = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const loadJson = f => JSON.parse(fs.readFileSync(path.join(__dirname, 'data', f), 'utf8'));

const PANEL = ['panel/crm/', 'panel/klient/', 'panel/avtopilot/', 'panel/golosovoj-robot/', 'panel/logistika/', 'panel/oshibki/', 'panel/ekonomika/', 'panel/prava/', 'panel/admin/'];

function clientData(D, P) {
  // компактные данные для браузера: сделки (без длинных лент — они на страницах сделок), клиенты, поставщики, журнал
  const prod = slug => P.find(p => p.slug === slug) || {};
  return {
    columns: D.columns,
    deals: D.deals.map(d => ({ id: d.id, code: d.code, col: d.col, channel: d.channel, age: d.age, title: d.title, last: d.last, sum: d.sum, owner: d.owner, client: d.client,
      items: d.items.map(i => ({ name: prod(i.slug).name || i.slug, qty: i.qty })), timeline: d.timeline.slice(-4) })),
    clients: D.clients.map(c => ({ slug: c.slug, name: c.name, limit: c.limit, used: c.used, score: c.score, existing: !!c.existing })),
    suppliers: D.suppliers.map(s => ({ slug: s.slug, name: s.name, feed: s.feed })),
    audit: D.audit, staff: D.staff, bounds: D.bounds,
  };
}
const dataTag = data => `<script type="application/json" id="pk-adm-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

// Экраны макета: дописать admin.js и данные (идемпотентно)
function inject(dir, BASE, data) {
  let n = 0;
  for (const p of PANEL) {
    const f = path.join(dir, p, 'index.html');
    if (!fs.existsSync(f)) continue;
    let html = fs.readFileSync(f, 'utf8');
    html = html.replace(/<script type="application\/json" id="pk-adm-data">[\s\S]*?<\/script>\n?/, '');
    const tag = `<script src="${BASE}assets/admin.js" defer></script>`;
    const add = dataTag(data) + '\n' + (html.includes(`assets/admin.js"`) ? '' : tag + '\n');
    html = html.replace(/<\/body>/, add + '</body>');
    fs.writeFileSync(f, html); n++;
  }
  return n;
}

function build(ctx) {
  const BASE = ctx.BASE;
  const D = loadJson('admin.json');
  const P = ctx.products || loadJson('products.json');
  const prod = slug => P.find(p => p.slug === slug);
  const prodHref = p => BASE + (p.quote ? `katalog/${p.category || 'kompressory'}/${p.slug}/` : `katalog/${p.category}/${p.slug}/`);
  const client = slug => D.clients.find(c => c.slug === slug);
  const clientHref = c => BASE + (c.existing ? 'panel/klient/' : `panel/klienty/${c.slug}/`);
  const data = clientData(D, P);

  const sub = active => `<nav class="pk-adm-sub" aria-label="Рабочие списки панели">${[
    ['panel/crm/', 'Сделки', 'op-crm'], ['panel/klienty/', 'Клиенты', 'op-client'], ['panel/postavshchiki/', 'Поставщики', 'tier-sync'], ['panel/zhurnal/', 'Журнал изменений', 'doc-generic']]
    .map(([h, t, ic]) => `<a href="${BASE}${h}"${h === active ? ' aria-current="page"' : ''}><span class="ico ico-16 i-${ic}"></span>${t}</a>`).join('')}</nav>`;
  const crumbs = items => `<nav class="pk-adm-crumbs" aria-label="Хлебные крошки">${items.map((it, i) => (i ? '<span aria-hidden="true">/</span>' : '') + (it.href ? `<a href="${it.href}">${esc(it.name)}</a>` : `<span aria-current="page">${esc(it.name)}</span>`)).join('')}</nav>`;
  const head = ({ kicker, h1, lead, actions = '', crumbsItems }) => `${crumbsItems ? crumbs(crumbsItems) : ''}<div class="pk-adm-head">
  <div><div class="mono pk-adm-kicker">${esc(kicker)}</div><h1>${h1}</h1>${lead ? `<p>${esc(lead)}</p>` : ''}</div>
  ${actions ? `<div class="pk-adm-actions">${actions}</div>` : ''}
</div>`;
  const page = (inner, active) => `<div class="pk-adm" data-adm-page>${sub(active)}${inner}</div>${dataTag(data)}`;
  const kpi = items => `<div class="pk-adm-kpis">${items.map(([v, k, d]) => `<div class="blueprint pk-adm-kpi"><div class="mono pk-adm-kpi-v">${esc(v)}</div><div>${esc(k)}</div>${d ? `<div class="mono pk-adm-kpi-d">${esc(d)}</div>` : ''}</div>`).join('')}</div>`;
  const chIcon = ch => ({ MAX: 'channel-max', 'Почта': 'channel-mail', 'Сайт': 'channel-web', 'Телефон': 'channel-phone' })[ch] || 'channel-web';
  const statusTag = s => ({ 'готово': 'tag-accent', 'отправлено': 'tag-accent', 'оплачено': 'tag-accent', 'подписано': 'tag-accent' })[s] ? 'tag-accent' : (s === 'черновик' ? 'tag-outline' : 'tag-neutral');
  const out = [];

  // ── сделки ──
  for (const d of D.deals) {
    const c = client(d.client);
    const rows = d.items.map(i => {
      const p = prod(i.slug) || { name: i.slug };
      const price = i.price || p.price;
      return `<tr><td>${p.slug ? `<a href="${prodHref(p)}">${esc(p.name)}</a>` : esc(p.name)}${i.note ? `<div class="mono pk-adm-muted">${esc(i.note)}</div>` : ''}</td><td class="mono">${esc(p.sku || '—')}</td><td class="mono">${num(i.qty)}</td><td class="mono">${price ? rub(price) : 'по КП'}</td><td class="mono">${price ? rub(price * i.qty) : '—'}</td></tr>`;
    }).join('');
    const listSum = d.items.reduce((a, i) => { const p = prod(i.slug) || {}; const pr = i.price || p.price; return a + (pr ? pr * i.qty : 0); }, 0);
    const html = page(`${head({
      crumbsItems: [{ name: 'Панель', href: BASE + 'panel/avtopilot/' }, { name: 'CRM', href: BASE + 'panel/crm/' }, { name: d.code }],
      kicker: `Сделка ${d.code} · ${d.channel} · ${d.age}`,
      h1: esc(d.title),
      lead: d.last,
      actions: `<button class="btn btn-secondary" type="button" data-deal-act="take">Взять себе</button><button class="btn btn-secondary" type="button" data-deal-act="robot">Передать роботу</button><button class="btn btn-primary" type="button" data-deal-act="close">Закрыть с причиной</button>`,
    })}
<div class="pk-adm-dealbar blueprint" data-deal="${esc(d.id)}">
  <div class="pk-adm-dealbar-i"><span class="mono pk-adm-muted">Этап</span><select class="input" data-deal-stage aria-label="Этап сделки">${D.columns.map((t, i) => `<option value="${i}"${i === d.col ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
  <div class="pk-adm-dealbar-i"><span class="mono pk-adm-muted">Ответственный</span><span class="tag ${d.owner === 'робот' ? 'tag-accent' : 'tag-outline'}" data-deal-owner>${esc(d.owner)}</span></div>
  <div class="pk-adm-dealbar-i"><span class="mono pk-adm-muted">Сумма</span><span class="mono pk-adm-big">${d.sum ? rub(d.sum) : '—'}</span></div>
  <div class="pk-adm-dealbar-i"><span class="mono pk-adm-muted">Статус</span><span class="tag tag-neutral" data-deal-state>в работе</span></div>
</div>
<div class="pk-adm-grid">
  <div class="pk-adm-col">
    <section class="blueprint pk-adm-card"><h2>Позиции</h2>
      <div class="pk-adm-scroll"><table class="table"><thead><tr><th>Позиция</th><th>Артикул</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="pk-adm-total"><span>По прайсу сайта</span><span class="mono">${listSum ? rub(listSum) : 'по КП'}</span></div>
    </section>
    <section class="blueprint pk-adm-card"><h2>Лента действий</h2>
      <ol class="pk-adm-tl" data-deal-feed>${d.timeline.map(t => `<li class="${/^Робот/.test(t.who) ? 'is-bot' : ''}"><span class="mono">${esc(t.time)}</span><div><div class="pk-adm-tl-h"><b>${esc(t.who)}</b><span class="mono">${esc(t.action)}</span></div><p>${esc(t.text)}</p></div></li>`).join('')}</ol>
      <form class="pk-adm-note" data-deal-note><label class="pk-vh" for="note-${esc(d.id)}">Комментарий к сделке</label><input class="input" id="note-${esc(d.id)}" maxlength="300" placeholder="Комментарий для команды: что сделано, что дальше"><button class="btn btn-secondary" type="submit">Добавить</button></form>
    </section>
  </div>
  <div class="pk-adm-col">
    ${c ? `<section class="blueprint pk-adm-card"><h2>Клиент</h2>
      <a class="pk-adm-link-big" href="${clientHref(c)}"><span class="ico i-op-client"></span>${esc(c.name)}</a>
      <dl class="pk-adm-dl"><dt>ИНН</dt><dd class="mono">${esc(c.inn)}</dd><dt>Город</dt><dd>${esc(c.city)}</dd><dt>Скоринг</dt><dd class="mono">${c.score} из 100</dd><dt>Лимит отсрочки</dt><dd class="mono">${c.limit ? rub(c.limit) : 'нет'}</dd><dt>Использовано</dt><dd class="mono">${rub(c.used)}</dd></dl>
    </section>` : ''}
    <section class="blueprint pk-adm-card"><h2>Границы торга</h2><p class="pk-adm-muted">Робот уступает только внутри рамок — дальше решение за человеком.</p>
      <dl class="pk-adm-dl">${D.bounds.map(([k, v]) => `<dt>${esc(k)}</dt><dd class="mono">${esc(v)}</dd>`).join('')}</dl>
      <a class="btn btn-secondary" href="${BASE}panel/crm/">Изменить в CRM</a>
    </section>
    <section class="blueprint pk-adm-card"><h2>Документы</h2>
      ${d.docs.length ? `<ul class="pk-adm-docs">${d.docs.map((x, i) => `<li data-doc="${i}"><span class="ico i-doc-generic"></span><span>${esc(x.name)}</span><span class="tag ${statusTag(x.status)}" data-doc-status>${esc(x.status)}</span><button class="btn btn-secondary" type="button" data-doc-act>${x.status === 'черновик' || x.status === 'не сформирован' ? 'Сформировать' : 'Переотправить'}</button></li>`).join('')}</ul>` : '<p class="pk-adm-muted">Документов пока нет — появятся после подбора.</p>'}
    </section>
  </div>
</div>`, 'panel/crm/');
    out.push({ path: `panel/sdelki/${d.id}/`, title: `Сделка ${d.code}: ${d.title} — панель оператора`, desc: `Сделка ${d.code}: позиции, лента действий робота, документы и границы торга.`, h1: d.title, html, chrome: 'ops', scripts: ['admin.js'], index: false });
  }

  // ── клиенты ──
  const clientRows = D.clients.map(c => `<tr data-href="${clientHref(c)}" data-q="${esc((c.name + ' ' + c.inn + ' ' + c.city).toLowerCase())}">
  <td><a href="${clientHref(c)}">${esc(c.name)}</a><div class="mono pk-adm-muted">ИНН ${esc(c.inn)} · ${esc(c.city)}</div></td>
  <td data-v="${c.score}"><span class="pk-adm-score ${c.score >= 75 ? 'is-good' : c.score >= 60 ? 'is-mid' : 'is-low'}"><span class="mono">${c.score}</span><span class="pk-adm-meter" aria-hidden="true"><i style="width:${c.score}%"></i></span></span></td>
  <td data-v="${c.limit}" class="mono">${c.limit ? rub(c.limit) : 'нет'}<div class="pk-adm-muted">исп. ${c.limit ? Math.round(c.used / c.limit * 100) : 0}%</div></td>
  <td data-v="${c.turnoverQ}" class="mono">${rub(c.turnoverQ)}<div class="pk-adm-muted">${c.orders} заказов</div></td>
  <td data-v="${esc(c.last.date)}">${esc(c.last.date)} · <span class="mono">${esc(c.last.channel)}</span><div class="pk-adm-muted">${esc(c.last.text)}</div></td>
</tr>`).join('');
  const totalTurn = D.clients.reduce((a, c) => a + c.turnoverQ, 0);
  out.push({ path: 'panel/klienty/', title: 'Клиенты — панель оператора', desc: 'Список клиентов: скоринг отсрочки, лимит, оборот за квартал и последнее обращение.', h1: 'Клиенты', chrome: 'ops', scripts: ['admin.js'], index: false,
    html: page(`${head({ kicker: 'CRM · компании-закупщики', h1: 'Клиенты', lead: 'Скоринг отсрочки, лимит и последнее обращение по каждой компании. Строка открывает карточку клиента.', crumbsItems: [{ name: 'Панель', href: BASE + 'panel/avtopilot/' }, { name: 'Клиенты' }] })}
${kpi([[String(D.clients.length), 'компаний в работе', 'демо-выборка'], [rub(totalTurn), 'оборот за квартал', ''], [String(D.clients.filter(c => c.score < 60).length), 'в серой зоне скоринга', 'ниже 60 баллов']])}
<section class="blueprint pk-adm-card">
  <div class="pk-adm-toolbar"><label class="pk-vh" for="cl-q">Поиск клиента</label><input class="input" id="cl-q" type="search" data-table-search="cl" placeholder="Название, ИНН или город"><span class="mono pk-adm-muted" data-table-count="cl" aria-live="polite"></span></div>
  <div class="pk-adm-scroll"><table class="table pk-adm-table" data-table="cl"><thead><tr><th><button type="button" data-sort="0">Компания</button></th><th><button type="button" data-sort="1" data-num>Скоринг</button></th><th><button type="button" data-sort="2" data-num>Лимит</button></th><th><button type="button" data-sort="3" data-num>Оборот, квартал</button></th><th>Последнее обращение</th></tr></thead><tbody>${clientRows}</tbody></table></div>
</section>`, 'panel/klienty/') });

  for (const c of D.clients.filter(c => !c.existing)) {
    const pct = c.limit ? Math.round(c.used / c.limit * 100) : 0;
    const nom = c.nomenclature.map(([slug, n, per, lastD, next]) => { const p = prod(slug) || { name: slug }; return `<tr><td>${p.slug ? `<a href="${prodHref(p)}">${esc(p.name)}</a>` : esc(p.name)}</td><td class="mono">${n}</td><td>${esc(per)}</td><td class="mono">${esc(lastD)}</td><td class="mono">${esc(next)}</td></tr>`; }).join('');
    const deals = D.deals.filter(d => d.client === c.slug);
    out.push({ path: `panel/klienty/${c.slug}/`, title: `${c.name}: карточка клиента — панель оператора`, desc: `Карточка клиента ${c.name}: обращения во всех каналах, номенклатура, лимит отсрочки и подсказки.`, h1: c.name, chrome: 'ops', scripts: ['admin.js'], index: false,
      html: page(`${head({ crumbsItems: [{ name: 'Панель', href: BASE + 'panel/avtopilot/' }, { name: 'Клиенты', href: BASE + 'panel/klienty/' }, { name: c.name }], kicker: 'Клиент · оператор сервиса', h1: `<span class="ico i-op-client"></span>${esc(c.name)}`,
        lead: `ИНН ${c.inn} · ${c.city} · снабжение, ${c.staff} сотр. · с ${c.since}`,
        actions: `<button class="btn btn-secondary" type="button" data-call="${esc(c.name)}">Позвонить (демо)</button><a class="btn btn-primary" href="${BASE}chat/">Открыть диалог</a>` })}
${kpi([[rub(c.turnoverQ), 'закуплено за квартал'], [String(c.orders), 'заказов всего'], [pct + '%', 'лимит отсрочки использован'], [c.score + ' из 100', 'скоринг отсрочки']])}
<div class="pk-adm-grid">
  <div class="pk-adm-col">
    <section class="blueprint pk-adm-card"><h2>История обращений во всех каналах</h2>
      <ul class="pk-adm-hist">${c.history.map(([dt, ch, t, s]) => `<li><span class="mono">${esc(dt)}</span><span class="mono pk-adm-ch"><span class="ico ico-16 i-${chIcon(ch)}"></span>${esc(ch)}</span><span>${esc(t)}</span><span class="mono">${s ? rub(s) : '—'}</span></li>`).join('')}</ul>
    </section>
    <section class="blueprint pk-adm-card"><h2>Сделки в работе</h2>
      ${deals.length ? `<ul class="pk-adm-docs">${deals.map(d => `<li><span class="ico i-op-crm"></span><a href="${BASE}panel/sdelki/${d.id}/">${esc(d.code)} · ${esc(d.title)}</a><span class="tag tag-outline" data-deal-col="${esc(d.id)}">${esc(D.columns[d.col])}</span><span class="mono">${d.sum ? rub(d.sum) : '—'}</span></li>`).join('')}</ul>` : '<p class="pk-adm-muted">Открытых сделок нет.</p>'}
    </section>
    <section class="blueprint pk-adm-card"><h2>Закупаемая номенклатура</h2><p class="pk-adm-muted">Периодичность рассчитана по истории заказов.</p>
      ${nom ? `<div class="pk-adm-scroll"><table class="table"><thead><tr><th>Позиция</th><th>Закупок</th><th>Периодичность</th><th>Последняя</th><th>Ожидается</th></tr></thead><tbody>${nom}</tbody></table></div>` : '<p class="pk-adm-muted">Истории закупок пока нет — новый клиент.</p>'}
    </section>
  </div>
  <div class="pk-adm-col">
    <section class="blueprint pk-adm-card" data-limit-card data-client="${esc(c.slug)}"><h2>Расчёты и лимит</h2>
      <dl class="pk-adm-dl"><dt>Лимит отсрочки</dt><dd class="mono" data-limit>${c.limit ? rub(c.limit) : 'нет'}</dd><dt>Использовано</dt><dd class="mono" data-used="${c.used}">${rub(c.used)}</dd><dt>Срок отсрочки</dt><dd class="mono">${c.delay ? c.delay + ' дней' : '—'}</dd><dt>Просрочек</dt><dd class="mono">${esc(c.overdue)}</dd></dl>
      <span class="pk-adm-meter pk-adm-meter-lg" aria-hidden="true"><i data-limit-bar style="width:${pct}%"></i></span>
      <div class="pk-adm-actions"><button class="btn btn-secondary" type="button" data-limit-edit>Изменить лимит</button><button class="btn btn-secondary" type="button" data-act-sverka>Акт сверки</button></div>
    </section>
    <section class="blueprint pk-adm-card"><h2>Что подсказать клиенту</h2>
      <ul class="pk-adm-hints">${c.hints.map((h, i) => `<li data-hint="${esc(c.slug)}-${i}"><span>${esc(h)}</span><button class="btn btn-secondary" type="button" data-hint-task>В задачи</button></li>`).join('')}</ul>
    </section>
  </div>
</div>`, 'panel/klienty/') });
  }

  // ── поставщики ──
  const feedTag = s => ({ ok: ['tag-accent', 'Успешно'], errors: ['tag-outline', `${s.errors} ошибок`], stale: ['tag-neutral', 'Устарело'], manual: ['tag-neutral', 'Ручной ввод'] })[s.feed];
  const supRows = D.suppliers.map(s => { const [cls, label] = feedTag(s); return `<tr data-sup="${esc(s.slug)}" data-feed="${s.feed}" data-q="${esc((s.name + ' ' + s.dirs + ' ' + s.city).toLowerCase())}">
  <td><b>${esc(s.name)}</b><div class="mono pk-adm-muted">${esc(s.city)} · ${esc(s.dirs)}</div></td>
  <td>${esc(s.level)}<div class="mono pk-adm-muted">${esc(s.format)}</div></td>
  <td class="mono" data-v="${s.rating}">${String(s.rating).replace('.', ',')}</td>
  <td data-v="${s.accuracy}"><span class="pk-adm-score ${s.accuracy >= 95 ? 'is-good' : s.accuracy >= 90 ? 'is-mid' : 'is-low'}"><span class="mono">${String(s.accuracy).replace('.', ',')}%</span><span class="pk-adm-meter" aria-hidden="true"><i style="width:${s.accuracy}%"></i></span></span></td>
  <td class="mono" data-v="${s.late}">${String(s.late).replace('.', ',')}%</td>
  <td class="mono" data-v="${s.positions}">${num(s.positions)}</td>
  <td><span class="tag ${cls}" data-sup-status>${esc(label)}</span><div class="mono pk-adm-muted" data-sup-time>${esc(s.sync)}</div></td>
  <td class="pk-adm-rowact"><button class="btn btn-secondary" type="button" data-sup-sync>Обновить</button><button class="btn btn-secondary" type="button" data-sup-pause aria-pressed="false">Приостановить</button></td>
</tr>`; }).join('');
  out.push({ path: 'panel/postavshchiki/', title: 'Поставщики и фиды — панель оператора', desc: 'Поставщики: уровень подключения, рейтинг, точность остатков, срыв сроков и статус фида.', h1: 'Поставщики', chrome: 'ops', scripts: ['admin.js'], index: false,
    html: page(`${head({ kicker: 'Источники · 18 подключённых', h1: 'Поставщики', lead: 'Уровень подключения, качество остатков и дисциплина сроков. Приостановленный поставщик не участвует в выборе предложения.', crumbsItems: [{ name: 'Панель', href: BASE + 'panel/avtopilot/' }, { name: 'Поставщики' }],
      actions: `<a class="btn btn-secondary" href="${BASE}panel/admin/#sources">Правила выбора</a><button class="btn btn-primary" type="button" data-sup-syncall>Синхронизировать все</button>` })}
${kpi([[String(D.suppliers.length), 'подключённых источников', 'РФ и импорт'], [num(D.suppliers.reduce((a, s) => a + s.positions, 0)), 'позиций в фидах', ''], [String(D.suppliers.filter(s => s.feed === 'errors' || s.feed === 'stale').length), 'фида требуют внимания', 'ошибки и устаревшие'], ['4,3', 'средний рейтинг', 'метрики — демо']])}
<section class="blueprint pk-adm-card">
  <div class="pk-adm-toolbar"><label class="pk-vh" for="sup-q">Поиск поставщика</label><input class="input" id="sup-q" type="search" data-table-search="sup" placeholder="Поставщик, направление, город">
    <label class="pk-vh" for="sup-f">Статус фида</label><select class="input" id="sup-f" data-table-filter="sup"><option value="">Все статусы</option><option value="ok">Успешно</option><option value="errors">С ошибками</option><option value="stale">Устарело</option><option value="manual">Ручной ввод</option><option value="paused">Приостановлены</option></select>
    <span class="mono pk-adm-muted" data-table-count="sup" aria-live="polite"></span></div>
  <div class="pk-adm-scroll"><table class="table pk-adm-table" data-table="sup"><thead><tr><th><button type="button" data-sort="0">Поставщик</button></th><th>Подключение</th><th><button type="button" data-sort="2" data-num>Рейтинг</button></th><th><button type="button" data-sort="3" data-num>Точность остатков</button></th><th><button type="button" data-sort="4" data-num>Срыв сроков</button></th><th><button type="button" data-sort="5" data-num>Позиций</button></th><th>Фид</th><th><span class="pk-vh">Действия</span></th></tr></thead><tbody>${supRows}</tbody></table></div>
</section>`, 'panel/postavshchiki/') });

  // ── журнал ──
  out.push({ path: 'panel/zhurnal/', title: 'Журнал изменений — панель оператора', desc: 'Полный журнал изменений панели: кто, когда, раздел, было и стало, откат.', h1: 'Журнал изменений', chrome: 'ops', scripts: ['admin.js'], index: false,
    html: page(`${head({ kicker: 'Аудит · все разделы панели', h1: 'Журнал изменений', lead: 'Каждая правка наценки, прав, источников, сценариев и сделок — с автором, временем и откатом. Действия в демо сохраняются в этом браузере.', crumbsItems: [{ name: 'Панель', href: BASE + 'panel/avtopilot/' }, { name: 'Журнал изменений' }],
      actions: `<button class="btn btn-secondary" type="button" data-journal-csv>Выгрузить CSV</button>` })}
<section class="blueprint pk-adm-card" data-journal-full>
  <div class="pk-adm-toolbar">
    <label class="pk-vh" for="j-sec">Раздел</label><select class="input" id="j-sec" data-j-sec><option value="">Все разделы</option></select>
    <label class="pk-vh" for="j-who">Сотрудник</label><select class="input" id="j-who" data-j-who><option value="">Все сотрудники</option></select>
    <label class="pk-vh" for="j-q">Поиск</label><input class="input" id="j-q" type="search" data-j-q placeholder="Что изменено">
    <span class="mono pk-adm-muted" data-j-count aria-live="polite"></span>
  </div>
  <div class="pk-adm-scroll"><table class="table pk-adm-table"><thead><tr><th>Когда</th><th>Раздел</th><th>Что изменено</th><th>Было → стало</th><th>Кто</th><th><span class="pk-vh">Действие</span></th></tr></thead><tbody data-j-body><tr><td colspan="6" class="pk-adm-muted">Журнал загружается…</td></tr></tbody></table></div>
</section>`, 'panel/zhurnal/') });

  // экраны макета в текущей сборке: подключить admin.js и данные
  const buildDir = path.join(__dirname, '..', '.site-build-' + process.pid);
  if (fs.existsSync(buildDir)) inject(buildDir, BASE, data);
  return out;
}

module.exports = build;

if (require.main === module) {
  const i = process.argv.indexOf('--inject');
  if (i > 0) {
    const dir = path.resolve(process.argv[i + 1] || 'site');
    const BASE = process.env.BASE || '/b2b-marketplace/';
    const D = loadJson('admin.json'), P = loadJson('products.json');
    console.log('admin.js подключён к экранам панели: ' + inject(dir, BASE, clientData(D, P)));
  } else {
    const pages = build({ BASE: process.env.BASE || '/b2b-marketplace/' });
    console.log(pages.map(p => '/' + p.path + '  ' + p.h1).join('\n'));
  }
}

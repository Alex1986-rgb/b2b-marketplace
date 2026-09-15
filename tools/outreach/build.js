#!/usr/bin/env node
// Сборка инструкции по партнёрской рассылке из docs/outreach/data/*.json.
//   node tools/outreach/build.js          — MD, CSV-трекер, HTML для PDF + проверка покрытия ассортимента
//   node tools/outreach/build.js --pdf    — дополнительно PDF (docs/outreach/partnerstvo.pdf)
const fs = require('fs');
const path = require('path');
const { TEMPLATES, FOLLOWUP } = require('./templates');
const { PROCESS } = require('./process');

const ROOT = path.join(__dirname, '..', '..');
const DATA = path.join(ROOT, 'docs/outreach/data');
const OUT = path.join(ROOT, 'docs/outreach');
const DIRS = require(path.join(ROOT, 'tools/data/directions.json'));
const N_SITE = DIRS.length;
const PUMP_SUB = ['консольные', 'консольно-моноблочные', 'вертикальные многоступенчатые', 'циркуляционные ин-лайн', 'скважинные', 'дренажные и фекальные', 'дозировочные', 'насосные станции'];

const files = fs.readdirSync(DATA).filter(f => /^\d\d-.*\.json$/.test(f)).sort();
const groups = files.map(f => {
  const raw = fs.readFileSync(path.join(DATA, f), 'utf8');
  let arr;
  try { arr = JSON.parse(raw); } catch (e) { throw new Error(f + ': невалидный JSON — ' + e.message); }
  return { file: f, dirs: arr };
});
// 90-*.json — добор: [{slug, partners[]}] подмешивается к направлению, отдельным кластером не выводится
const extras = groups.filter(g => /^9\d-/.test(g.file));
groups.splice(0, groups.length, ...groups.filter(g => !/^9\d-/.test(g.file)));
const all = groups.flatMap(g => g.dirs);
for (const e of extras) for (const x of e.dirs) {
  const d = all.find(y => y.slug === x.slug);
  if (!d) { console.warn('добор: нет направления ' + x.slug); continue; }
  const have = new Set((d.partners || []).map(p => p.company));
  d.partners = (d.partners || []).concat((x.partners || []).filter(p => !have.has(p.company)));
}
for (const d of all) if (d.strategy) d.strategy = d.strategy.replace(/\s*\|\s*/g, ' + ');
// свою наценку поставщику не раскрываем — такие пункты из «Приложить» и вопросов убираем
for (const d of all) for (const p of d.partners || []) {
  const clean = a => (Array.isArray(a) ? a : a ? [a] : []).filter(x => !/наценк/i.test(x));
  p.attach = clean(p.attach); p.ask = clean(p.ask);
  if (p.hook && /наценк/i.test(p.hook)) p.hook = p.hook.replace(/[^.]*наценк[^.]*\.?/gi, '').trim();
}

// ── проверка покрытия ассортимента ──
const norm = s => String(s).toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim();
const coverage = [];
for (const d of DIRS) {
  const got = all.find(x => x.slug === d.slug);
  const subs = (d.subcats && d.subcats.length ? d.subcats.map(s => s.name) : PUMP_SUB);
  if (!got) { coverage.push({ slug: d.slug, name: d.name, missing: subs, noData: true }); continue; }
  const text = norm((got.partners || []).flatMap(p => p.covers || []).join(' | ') + ' | ' + (got.coverage || []).join(' | '));
  const missing = subs.filter(s => {
    const all = norm(s).split(' ');
    const words = all.filter(w => w.length > 3).map(w => w.slice(0, 6));
    const acr = all.filter(w => w.length > 2).map(w => w[0]).join('');           // «Блочные тепловые пункты» → «бтп»
    const shorts = all.filter(w => w.length >= 2 && w.length <= 3 && /[a-zа-я]/.test(w)); // «УФ», «CIP», «ПЛК»
    return !(words.some(w => text.includes(w)) || (acr.length >= 3 && new RegExp('(^| )' + acr + '( |$)').test(text)) || shorts.some(w => new RegExp('(^| )' + w + '( |$)').test(text)));
  });
  coverage.push({ slug: d.slug, name: d.name, missing });
}
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const list = a => (Array.isArray(a) ? a : a ? [a] : []);
const P = p => ({ 1: 'Неделя 1', 2: 'Неделя 2', 3: 'Резерв' })[p.priority] || 'Резерв';

function letter(p, d) {
  const t = TEMPLATES[p.template] || TEMPLATES.dealer;
  const fill = s => s
    .replace(/\{brands\}/g, list(p.brands).join(', ') || p.company)
    .replace(/\{direction\}/g, d.name)
    .replace(/\{covers\}/g, list(p.covers).join(', ') || d.name)
    .replace(/\{hook\}/g, p.hook || '')
    .replace(/\{ask\}/g, list(p.ask).map((q, i) => `${i + 1}. ${q}`).join('\n'));
  return { subject: fill(t.subject), body: fill(t.body), title: t.title };
}

// ── MD ──
let md = `# Инструкция: кому и что писать о партнёрстве — ПРОМКОНТУР\n\nСобрано ${new Date().toLocaleDateString('ru-RU')} из разведки (docs/research). ` +
  `Направлений: ${all.length}, партнёров: ${all.reduce((n, d) => n + list(d.partners).length, 0)}. ` +
  `Отправка писем — только вручную Александром. [[…]] — заполнить перед отправкой.\n\n`;
md += PROCESS.md + '\n';
md += `## Покрытие ассортимента\n\n| Направление | Стратегия | Партнёры недели 1 | Не покрыто |\n|---|---|---|---|\n`;
for (const d of all) {
  const c = coverage.find(x => x.slug === d.slug) || { missing: [] };
  md += `| ${d.name} | ${d.strategy || ''} | ${list(d.partners).filter(p => p.priority === 1).map(p => p.company).join('; ')} | ${c.missing.length ? c.missing.join('; ') : '—'} |\n`;
}
for (const g of groups) {
  md += `\n---\n\n# ${g.dirs[0] ? g.dirs[0].cluster : g.file}\n`;
  for (const d of g.dirs) {
    md += `\n## ${d.name}\n\n**Стратегия:** ${d.strategy || '—'}. ${d.summary || ''}\n\n`;
    md += `| Приоритет | Компания | Закрывает | Канал | Шаблон |\n|---|---|---|---|---|\n`;
    for (const p of list(d.partners)) {
      const ch = p.channel || {};
      const contact = [ch.email, ch.phone, ch.url].filter(Boolean).join(' · ');
      md += `| ${P(p)} | **${p.company}** (${p.role || ''}) | ${list(p.covers).join(', ')} | ${ch.how || ''}: ${contact} | ${(TEMPLATES[p.template] || {}).title || p.template} |\n`;
    }
    for (const p of list(d.partners)) {
      const ch = p.channel || {};
      const L = letter(p, d);
      md += `\n### ${p.company} — ${P(p)}\n\n`;
      md += `- **Кому:** ${ch.who || 'отдел продаж'} · ${ch.how || ''}${ch.email ? ' · ' + ch.email : ''}${ch.phone ? ' · ' + ch.phone : ''}${ch.url ? ' · ' + ch.url : ''}\n`;
      if (p.known) md += `- **Что известно:** ${p.known}\n`;
      if (p.expect) md += `- **Чего ждать:** ${p.expect}\n`;
      if (p.leverage) md += `- **Рычаг в переговорах:** ${p.leverage}\n`;
      if (p.risks) md += `- **Проверить:** ${p.risks}\n`;
      if (list(p.attach).length) md += `- **Приложить:** ${list(p.attach).join('; ')}\n`;
      md += `\n**Тема:** ${L.subject}\n\n\`\`\`text\n${L.body}\n\`\`\`\n`;
    }
    if (d.gaps) md += `\n> Пробелы: ${d.gaps}\n`;
  }
}
md += `\n---\n\n## Повторное касание (через 3–4 рабочих дня)\n\n\`\`\`text\n${FOLLOWUP}\n\`\`\`\n`;
fs.writeFileSync(path.join(OUT, 'INSTRUKCIYA.md'), md);

// ── CSV-трекер (Excel: разделитель «;», BOM) ──
const cell = v => { v = v == null ? '' : String(v).replace(/\r?\n/g, ' '); return /[;"]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
const rows = [['№', 'Кластер', 'Направление', 'Приоритет', 'Компания', 'Роль', 'Закрывает', 'Шаблон', 'Канал', 'E-mail', 'Телефон', 'Страница', 'Тема письма', 'Дата отправки', 'Повтор', 'Звонок', 'Ответ', 'Скидка/условия', 'Порог входа', 'Отсрочка', 'Фид/API', 'Статус', 'Комментарий']];
let n = 0;
for (const d of all) for (const p of list(d.partners)) {
  const ch = p.channel || {};
  rows.push([++n, d.cluster, d.name, P(p), p.company, p.role, list(p.covers).join(', '), (TEMPLATES[p.template] || {}).title || p.template, ch.how, ch.email, ch.phone, ch.url, letter(p, d).subject, '', '', '', '', '', '', '', '', 'не отправлено', '']);
}
fs.writeFileSync(path.join(OUT, 'tracker.csv'), '﻿' + rows.map(r => r.map(cell).join(';')).join('\r\n'));

// ── HTML для PDF ──
const tpl = fs.readFileSync(path.join(__dirname, 'instrukciya.tpl.html'), 'utf8');
const totalP = all.reduce((k, d) => k + list(d.partners).length, 0);
const p1 = all.reduce((k, d) => k + list(d.partners).filter(p => p.priority === 1).length, 0);
let body = '';
for (const g of groups) {
  body += `<section class="cluster"><div class="eyebrow"><span class="num">${esc(g.file.slice(0, 2))}</span><span class="mono">кластер</span></div><h2>${esc(g.dirs[0] ? g.dirs[0].cluster : '')}</h2></section>`;
  for (const d of g.dirs) {
    const c = coverage.find(x => x.slug === d.slug) || { missing: [] };
    body += `<article class="dir"><header><div><h3>${esc(d.name)}</h3><p>${esc(d.summary || '')}</p></div><span class="pill">${esc(d.strategy || '')}</span></header>`;
    body += `<div class="partners">`;
    for (const p of list(d.partners)) {
      const ch = p.channel || {};
      body += `<div class="pc p${p.priority || 3}">
        <div class="c1"><div class="top"><span class="prio">${esc(P(p))}</span><span class="tpl">${esc((TEMPLATES[p.template] || {}).title || p.template)}</span></div>
          <h4>${esc(p.company)}</h4><div class="role">${esc(p.role || '')}${list(p.brands).length ? ' · ' + esc(list(p.brands).join(', ')) : ''}</div>
          <div class="covers">${list(p.covers).map(x => `<span>${esc(x)}</span>`).join('')}</div></div>
        <div class="c2">${p.known ? `<p class="k"><b>Известно:</b> ${esc(p.known)}</p>` : ''}
          <p class="k"><b>Что написать:</b> ${esc(p.hook || '')}</p>
          ${p.leverage ? `<p class="k lev"><b>Рычаг:</b> ${esc(p.leverage)}</p>` : ''}
          ${p.risks ? `<p class="k risk"><b>Проверить:</b> ${esc(p.risks)}</p>` : ''}</div>
        <div class="c3">${list(p.ask).length ? `<b class="lbl">Спросить</b><ul>${list(p.ask).map(q => `<li>${esc(q)}</li>`).join('')}</ul>` : ''}
          <div class="ch"><b>${esc(ch.how || '')}</b>${ch.who ? ' · ' + esc(ch.who) : ''}<br>${[ch.email, ch.phone].filter(Boolean).map(esc).join(' · ')}${ch.url ? `<br><span class="url">${esc(ch.url)}</span>` : ''}</div></div>
      </div>`;
    }
    body += `</div>${c.missing.length ? `<p class="gap">Не покрыто: ${esc(c.missing.join('; '))}</p>` : ''}</article>`;
  }
}
const tplCards = Object.entries(TEMPLATES).map(([k, t]) => `<div class="card tcard"><div class="mono">${esc(k)}</div><h3>${esc(t.title)}</h3><p class="when">${esc(t.when)}</p><div class="subj">Тема: ${esc(t.subject)}</div><pre>${esc(t.body)}</pre></div>`).join('');
const html = tpl
  .replace('{{DATE}}', new Date().toLocaleDateString('ru-RU'))
  .replace('{{N_DIRS}}', all.filter(d => DIRS.some(x => x.slug === d.slug)).length).replace('{{N_PARTNERS}}', totalP).replace('{{N_P1}}', p1)
  .replace('{{PROCESS}}', PROCESS.html)
  .replace('{{MATRIX}}', all.map(d => { const c = coverage.find(x => x.slug === d.slug) || { missing: [] }; return `<tr><td><b>${esc(d.name)}</b></td><td>${esc(d.strategy || '')}</td><td>${list(d.partners).filter(p => p.priority === 1).map(p => esc(p.company)).join('<br>')}</td><td>${list(d.partners).length}</td><td>${c.missing.length ? `<span class="pill warn">${c.missing.length}</span>` : '<span class="pill ok">всё</span>'}</td></tr>`; }).join(''))
  .replace('{{BODY}}', body)
  .replace('{{TEMPLATES}}', tplCards + `<div class="card tcard"><div class="mono">followup</div><h3>Повторное касание</h3><p class="when">через 3–4 рабочих дня без ответа</p><pre>${esc(FOLLOWUP)}</pre></div>`);
fs.writeFileSync(path.join(__dirname, 'instrukciya.html'), html);

const holes = coverage.filter(c => c.noData || c.missing.length);
console.log(`Направлений витрины: ${all.filter(d => DIRS.some(x => x.slug === d.slug)).length}/${N_SITE}, инфраструктура: ${all.filter(d => !DIRS.some(x => x.slug === d.slug)).length}, партнёров: ${totalP}, недели 1: ${p1}`);
console.log(holes.length ? 'Пробелы покрытия:\n' + holes.map(h => `  ${h.name}: ${h.noData ? 'НЕТ ДАННЫХ' : h.missing.join('; ')}`).join('\n') : 'Весь ассортимент покрыт.');

if (process.argv.includes('--pdf')) {
  const puppeteer = require('puppeteer-core');
  (async () => {
    const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--allow-file-access-from-files'] });
    const pg = await b.newPage();
    await pg.goto('file://' + path.join(__dirname, 'instrukciya.html'), { waitUntil: 'networkidle0', timeout: 90000 });
    await pg.evaluate(() => document.fonts.ready);
    const out = path.join(OUT, 'partnerstvo.pdf');
    await pg.pdf({ path: out, width: '1600px', height: '900px', printBackground: true, displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: '<div style="width:100%;font:10px Fira Code,monospace;color:#7a7a7d;padding:0 60px;display:flex;justify-content:space-between"><span>ПРОМКОНТУР · инструкция по партнёрству</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
      margin: { top: '40px', bottom: '46px', left: '0', right: '0' } });
    await b.close();
    console.log('PDF:', out, (fs.statSync(out).size / 1048576).toFixed(1) + ' МБ');
  })().catch(e => { console.error(e); process.exit(1); });
}

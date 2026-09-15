// Разведка: какие клики на каждом экране меняют экран, а какие — локальное состояние.
const puppeteer = require('puppeteer-core');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
  const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 });
  await p.goto('http://localhost:8150/' + encodeURIComponent('Промышленный агрегатор.dc.html'), { waitUntil: 'networkidle0' });
  const screens = await p.evaluate(() => [...document.querySelectorAll('select')].flatMap(s => [...s.options].filter(o => !o.text.includes('…')).map(o => o.value)));
  const out = {};
  for (const id of screens) {
    await p.evaluate(id => { for (const s of document.querySelectorAll('select')) for (const o of s.options) if (o.value === id) { s.value = id; s.dispatchEvent(new Event('change', { bubbles: true })); return; } }, id);
    await new Promise(r => setTimeout(r, 500));
    out[id] = await p.evaluate(() => {
      const P = DCLogic.prototype, orig = P.setState; let cap; P.setState = function (a) { cap = a; };
      const os = window.scrollTo; window.scrollTo = () => {};
      const local = {}; let nav = 0, none = 0;
      for (const el of document.querySelectorAll('body *')) {
        const pk = Object.keys(el).find(k => k.startsWith('__reactProps')); if (!pk) continue;
        const pr = el[pk]; const ev = Object.keys(pr).filter(k => /^on[A-Z]/.test(k) && typeof pr[k] === 'function');
        for (const k of ev) {
          if (k !== 'onClick') { local[k] = (local[k] || 0) + 1; continue; }
          cap = undefined; try { pr[k]({ preventDefault() {}, stopPropagation() {}, target: el, currentTarget: el }); } catch (e) { cap = 'ERR'; }
          if (cap && typeof cap === 'object' && 'screen' in cap) nav++;
          else if (cap === undefined) none++;
          else { const key = typeof cap === 'function' ? 'fn:' + String(cap).slice(0, 60) : Object.keys(cap).join(','); local[key] = (local[key] || 0) + 1; }
        }
      }
      P.setState = orig; window.scrollTo = os;
      return { nav, none, local };
    });
  }
  await b.close();
  console.log(JSON.stringify(out, null, 1));
})();

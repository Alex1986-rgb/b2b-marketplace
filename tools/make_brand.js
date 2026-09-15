#!/usr/bin/env node
// Знак ПРОМКОНТУР → favicon.svg, favicon-32.png, apple-touch-icon.png, icon-192/512.png, logo.svg, og-cover.jpg.
// Исходник знака — tools/site/brand/mark.svg (квадрат 64×64). Результат пишется в tools/site/static (копируется в site/ при сборке)
// и в project/img/og-cover.jpg.
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const DIR = path.join(__dirname, 'site');
const STATIC = path.join(DIR, 'static');
const mark = fs.readFileSync(path.join(DIR, 'brand', 'mark.svg'), 'utf8');
const IMG = path.join(__dirname, '..', 'project', 'img');

(async () => {
  fs.mkdirSync(path.join(STATIC, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(STATIC, 'favicon.svg'), mark);
  const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 330 64" role="img" aria-label="ПРОМКОНТУР">
  <g>${mark.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')}</g>
  <text x="80" y="43" font-family="Fira Sans Condensed, Arial Narrow, sans-serif" font-weight="600" font-size="34" letter-spacing="0.5" fill="#1d2d3d">ПРОМКОНТУР</text>
</svg>`;
  fs.writeFileSync(path.join(STATIC, 'assets', 'logo.svg'), logo);

  const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
  const p = await b.newPage();
  for (const [name, size, pad, bg] of [['favicon-32.png', 32, 0, null], ['apple-touch-icon.png', 180, 22, '#1d2d3d'], ['icon-192.png', 192, 24, '#1d2d3d'], ['icon-512.png', 512, 64, '#1d2d3d']]) {
    await p.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    await p.setContent(`<html><body style="margin:0;background:${bg || 'transparent'};display:grid;place-items:center;width:${size}px;height:${size}px">
      <div style="width:${size - pad * 2}px;height:${size - pad * 2}px">${mark.replace('<svg', '<svg width="100%" height="100%"')}</div></body></html>`);
    await p.screenshot({ path: path.join(STATIC, name), omitBackground: !bg });
  }
  // обложка для соцсетей 1200×630
  const photo = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(IMG, 'warehouse.jpg')).toString('base64');
  await p.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await p.setContent(`<html><head><link href="https://fonts.googleapis.com/css2?family=Fira+Sans+Condensed:wght@600&family=Fira+Sans:wght@400&display=swap" rel="stylesheet"></head>
  <body style="margin:0;width:1200px;height:630px;background:#1d2d3d;color:#fff;font-family:'Fira Sans',sans-serif;position:relative;overflow:hidden">
    <div style="position:absolute;inset:0 0 0 560px;background:url(${photo}) center/cover"></div>
    <div style="position:absolute;inset:0 0 0 560px;background:#5980a6;mix-blend-mode:color"></div>
    <div style="position:absolute;inset:0;background:linear-gradient(90deg,#1d2d3d 46%,rgba(29,45,61,.2) 75%)"></div>
    <div style="position:absolute;left:72px;top:70px;display:flex;align-items:center;gap:18px">
      <div style="width:56px;height:56px">${mark.replace('<svg', '<svg width="100%" height="100%"')}</div>
      <div style="font-family:'Fira Sans Condensed';font-weight:600;font-size:40px;letter-spacing:.5px">ПРОМКОНТУР</div>
    </div>
    <div style="position:absolute;left:72px;top:210px;width:600px;font-family:'Fira Sans Condensed';font-weight:600;font-size:60px;line-height:1.08">Промышленное оборудование от поставщиков — одной ценой</div>
    <div style="position:absolute;left:72px;bottom:70px;font-size:24px;color:#b9c9d8">115 000+ моделей · счёт за 15 минут · доставка по России</div>
  </body></html>`, { waitUntil: 'networkidle0' });
  await p.evaluate(async () => { await document.fonts.load('600 40px "Fira Sans Condensed"'); await document.fonts.load('400 24px "Fira Sans"'); await document.fonts.ready; });
  await p.screenshot({ path: path.join(IMG, 'og-cover.jpg'), type: 'jpeg', quality: 82 });
  await b.close();
  console.log('знак, иконки и обложка готовы');
})();

#!/usr/bin/env node
// PDF-сводка разведки в стиле сайта ПРОМКОНТУР.
//   node tools/report/build_pdf.js [выход.pdf] [--png]   — по умолчанию docs/reports/promkontur-razvedka.pdf
// Страницы 16:9 (1600×900 px) — удобно смотреть на экране. --png дополнительно снимает превью страниц.
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(__dirname, 'razvedka.html');
const OUT = path.resolve(process.argv.find((a, i) => i > 1 && !a.startsWith('--')) || path.join(ROOT, 'docs/reports/promkontur-razvedka.pdf'));
const PNG = process.argv.includes('--png');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 });
  await page.goto('file://' + SRC, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.evaluate(() => document.fonts.ready);
  if (PNG) {
    const dir = path.join(path.dirname(OUT), 'pdf-preview');
    fs.mkdirSync(dir, { recursive: true });
    const n = await page.$$eval('.page', p => p.length);
    for (let i = 0; i < n; i++) {
      const el = (await page.$$('.page'))[i];
      await el.screenshot({ path: path.join(dir, String(i + 1).padStart(2, '0') + '.png') });
    }
  }
  await page.pdf({ path: OUT, width: '1600px', height: '900px', printBackground: true, pageRanges: '' });
  await browser.close();
  console.log('PDF:', OUT, (fs.statSync(OUT).size / 1024 / 1024).toFixed(1) + ' МБ');
})().catch(e => { console.error(e); process.exit(1); });

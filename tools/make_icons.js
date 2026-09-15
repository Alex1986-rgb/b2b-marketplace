#!/usr/bin/env node
// Набор иконок сайта → project/icons.css (маски, цвет = currentColor).
// Источник списка — docs/visual-plan.json (icons[].id + lucide), собственные рисунки — tools/icons/custom/<id>.svg.
// Использование в разметке: <span class="ico i-dir-pumps"></span>; размер — через width/height или .ico-16/.ico-28.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const plan = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'visual-plan.json'), 'utf8'));
const LUC = path.join(ROOT, 'node_modules', 'lucide-static', 'icons');
const CUSTOM = path.join(__dirname, 'icons', 'custom');
const extra = { 'mark': null };

function clean(svg) {
  return svg.replace(/<!--[\s\S]*?-->/g, '').replace(/\s*class="[^"]*"/, '').replace(/\s*width="24"/, '').replace(/\s*height="24"/, '')
    .replace(/stroke="currentColor"/, 'stroke="black"').replace(/stroke-width="2"/, 'stroke-width="1.75"').replace(/\s+/g, ' ').trim();
}
const uri = svg => 'url("data:image/svg+xml,' + encodeURIComponent(svg).replace(/%20/g, ' ').replace(/%3D/g, '=').replace(/%3A/g, ':').replace(/%2F/g, '/').replace(/'/g, '%27') + '")';

let css = `/* иконки ПРОМКОНТУР: Lucide (ISC) + собственные рисунки. Сгенерировано tools/make_icons.js */
.ico{display:inline-block;flex:none;width:24px;height:24px;vertical-align:middle;background-color:currentColor;-webkit-mask:var(--i) center/contain no-repeat;mask:var(--i) center/contain no-repeat}
.ico-16{width:16px;height:16px}.ico-20{width:20px;height:20px}.ico-28{width:28px;height:28px}.ico-32{width:32px;height:32px}.ico-40{width:40px;height:40px}
`;
const seen = new Set(); let custom = 0;
for (const i of plan.icons) {
  if (seen.has(i.id)) continue; seen.add(i.id);
  const own = path.join(CUSTOM, i.id + '.svg');
  let svg;
  if (fs.existsSync(own)) { svg = fs.readFileSync(own, 'utf8'); custom++; }
  else svg = clean(fs.readFileSync(path.join(LUC, i.lucide + '.svg'), 'utf8'));
  css += `.i-${i.id}{--i:${uri(svg)}}\n`;
}
fs.writeFileSync(path.join(ROOT, 'project', 'icons.css'), css);
console.log(`иконок: ${seen.size} (своих ${custom}), ${(css.length / 1024).toFixed(0)} КБ`);

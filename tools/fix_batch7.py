#!/usr/bin/env python3
"""Пачка 7 (14.09.26): убрать с главной внутреннюю кухню — наценку, закупочные цены поставщиков, «внутренний подбор»."""
import os, sys, re
P = os.path.join(os.path.dirname(__file__), "..", "project", "Промышленный агрегатор.dc.html")
s = open(P, encoding="utf-8").read()
def R(old, new, n=1):
    global s
    c = s.count(old)
    if c != n: sys.exit(f"[{c}≠{n}] {old[:100]!r}")
    s = s.replace(old, new)

R('Система сама сравнивает прайсы поставщиков по цене, остатку и сроку, добавляет наценку и показывает одну цену. Оборудование едет напрямую со склада поставщика.',
  'Сравниваем предложения по цене, наличию и сроку отгрузки и показываем одну итоговую цену. Никаких запросов «уточните стоимость» и доплат при оформлении.')
a = s.find('<div style="background:var(--color-bg);border-radius:10px;padding:14px 16px;margin-top:4px">\n              <div style="font-size:13px;color:var(--color-neutral-700);margin-bottom:8px">Внутренний подбор')
b = s.find('<span class="mono" style="font-size:24px">104 900 ₽</span>\n              </div>\n            </div>', a)
if a < 0 or b < 0: sys.exit("блок «Внутренний подбор» не найден")
b += len('<span class="mono" style="font-size:24px">104 900 ₽</span>\n              </div>\n            </div>')
benefits = [("i-pay-invoice", "Цена с НДС и доставкой по России", "в карточке — сразу итоговая сумма"),
            ("i-log-direct", "Остаток и срок отгрузки проверены", "данные обновляются из складов поставщиков"),
            ("i-doc-generic", "Счёт за 15 минут, документы по ЭДО", "оплата по счёту, картой или с отсрочкой"),
            ("i-step-direct-ship", "Отгрузка напрямую со склада", "трек и статус — в заказе и в MAX")]
rows = "\n".join(f'''              <li style="display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-top:1px solid var(--color-divider)"><span class="ico ico-24 {ic}" style="color:var(--color-accent-700);margin-top:2px"></span><span><span style="display:block;font-weight:600;font-size:15px">{t}</span><span style="display:block;font-size:13px;color:var(--color-neutral-700)">{d}</span></span></li>''' for ic, t, d in benefits)
s = s[:a] + '<ul style="list-style:none;margin:6px 0 0;padding:0">\n' + rows + '\n            </ul>' + s[b:]
R('text: "Клиент видит итоговую стоимость с наценкой и доставкой." }', 'text: "Цена в карточке уже с НДС и доставкой — без доплат при оформлении." }')
R('выбирает лучшее и добавляет наценку сервиса. Вы видите одну итоговую цену с НДС и доставкой по РФ.',
  'выбирает лучшее. Вы видите одну итоговую цену с НДС и доставкой по РФ — без доплат при оформлении.')
R('с прайс-листом и фиксацией наценки.', 'с прайс-листом и фиксацией цен.')
R('<button onClick="{{ goProduct }}" class="btn btn-secondary" style="align-self:flex-start">Открыть каталог</button>',
  '<button onClick="{{ goDirections }}" class="btn btn-secondary" style="align-self:flex-start">Открыть каталог</button>')
open(P, "w", encoding="utf-8").write(s)
print("пачка 7 применена")

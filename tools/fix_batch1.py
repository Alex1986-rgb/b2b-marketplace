#!/usr/bin/env python3
"""Доработка 14.09.26, пачка 1: арифметика, согласованность данных, тексты, мелкая вёрстка.
Каждая замена проверяет число вхождений — если макет уже поправлен, падает с понятной ошибкой."""
import os, sys
P = os.path.join(os.path.dirname(__file__), "..", "project", "Промышленный агрегатор.dc.html")
s = open(P, encoding="utf-8").read()
def R(old, new, n=1):
    global s
    c = s.count(old)
    if c != n:
        sys.exit(f"[{c}≠{n}] {old[:90]!r}")
    s = s.replace(old, new)

# ── Статус заказа: итог = сумма позиций, отсрочка ≠ «оплачено»
R('font-size:17px">Оплачено</span>\n            <span class="mono" style="font-size:24px">209 800 ₽</span>',
  'font-size:17px">К оплате</span>\n            <span class="mono" style="font-size:24px">222 600 ₽</span>')
# ── Сравнение: 74 800 против 96 300 = −22 %
R('цена ниже на 28% при сопоставимых', 'цена на 22% ниже Wilo Helix V при сопоставимых')
R('Отличия от лучшего значения в строке выделены.', 'Лучшее значение в строке выделено.')
# ── Корзина: 209 800 + 27 000 + 62 300 = 299 100; НДС 22 % с 2026 года
R('<span class="text-muted">Оборудование, 3 поз.</span><span class="mono">243 700 ₽</span>',
  '<span class="text-muted">Оборудование, 3 поз.</span><span class="mono">299 100 ₽</span>')
R('<span class="text-muted">НДС 20%</span><span class="mono">40 616 ₽</span>',
  '<span class="text-muted">в т. ч. НДС 22%</span><span class="mono">53 937 ₽</span>')
R('font-size:18px">К оплате</span>\n            <span class="mono" style="font-size:28px">243 700 ₽</span>',
  'font-size:18px">К оплате</span>\n            <span class="mono" style="font-size:28px">299 100 ₽</span>')
R('<div class="mono" style="font-size:20px">243 700 ₽</div>', '<div class="mono" style="font-size:20px">299 100 ₽</div>')
# ── Разбор заявки: 5 видимых совпадений = 629 600; 14 совпадений всего
R('14 позиций · 386 400 ₽', '14 позиций · 812 600 ₽')
R('<span class="mono" style="font-size:26px">600 400 ₽</span>', '<span class="mono" style="font-size:26px">1 026 600 ₽</span>')
R('"Заявка списком, 20 строк", last: "Робот: разобрано 17/20, 3 без аналога", sum: "600 400 ₽"',
  '"Заявка списком, 20 строк", last: "Робот: разобрано 18/20, 2 строки инженеру", sum: "1 026 600 ₽"')
R('what: "Заявка на 20 строк: 3 позиции без аналога в базе", why: "пробел ассортимента — редукторы Bonfiglioli", sum: "600 400 ₽"',
  'what: "Заявка на 20 строк: 2 строки не распознаны", why: "фильтр по чертежу цеха и шланг без параметров", sum: "1 026 600 ₽"')
R('what: "Заявка цеха №4 списком, 20 строк — разобрана автоматом", sum: "600 400 ₽"',
  'what: "Заявка цеха №4 списком, 20 строк — разобрана автоматом", sum: "1 026 600 ₽"')
# ── Меню направлений: дубль «Редукторы» в кластере 04
R('\n            { name: "Редукторы и мотор-редукторы", sub: "червячные, цилиндрические, планетарные, вариаторы, мотор-редукторы", count: "3 480" },', '')
# ── Поиск пуст: заголовок не должен спорить с найденным товаром
R('<h1 style="font-size:34px;margin:6px 0 10px">Точных совпадений нет</h1>',
  '<h1 style="font-size:34px;margin:6px 0 10px">Показаны результаты по «Grundfos CR 32-4»</h1>')
# ── Счётчики и формулировки
R('Сотрудники сервиса · 14 человек', 'Сотрудники сервиса · 6 человек')
R('<h3 style="margin:0">Ждёт человека · 9</h3>', '<h3 style="margin:0">Ждёт человека · 6</h3>')
R('{ t: "Статей опубликовано", v: "58" }', '{ t: "Статей опубликовано", v: "3" }')
R('<span>CR 45-3 · 132 900 ₽</span>', '<span>CR 45-3 · 156 700 ₽</span>')
R('Стандартное графит-керамика работает', 'Стандартная пара графит — керамика работает')
R('Считать разницу в свою пользу ошибкой в пользу клиента', 'Ошибку в нашу пользу возвращать клиенту')
R('2 мин 40 с</h3>', '1 мин 32 с</h3>')
R('2 гудка"></div>', 'второго гудка"></div>')
R('Мы не склад и не магазин. Мы контур закупки</h1>', 'Мы не склад и не магазин. Мы — контур закупки</h1>')
R('Цены в каталоге указаны с НДС и доставкой, счёт', 'Цены в каталоге указаны с НДС и доставкой (кроме габаритных грузов и удалённых регионов — там расчёт в КП), счёт', 2)
# ── Блог: 9 статей = ровно 3×3
R('<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px">\n        <sc-for list="{{ articles }}"',
  '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px">\n        <sc-for list="{{ articles }}"')
# ── Независимые опции: галочки вместо кружков (класс radio с type=checkbox)
R('  .row-hover:hover {', '''  .radio input[type="checkbox"] + .dot { border-radius:0; position:relative; }
  .radio input[type="checkbox"]:checked + .dot { box-shadow:none; }
  .radio input[type="checkbox"]:checked + .dot::after { content:""; position:absolute; left:4px; top:1px; width:5px; height:9px; border:solid var(--color-bg); border-width:0 2px 2px 0; transform:rotate(45deg); }
  .row-hover:hover {''')
R('[style*="grid-template-columns: repeat(2,"],', '[style*="grid-template-columns: repeat(2,"],\n    [style*="grid-template-columns: repeat(3,"],')
open(P, "w", encoding="utf-8").write(s)
print("пачка 1 применена")

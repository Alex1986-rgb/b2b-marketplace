#!/usr/bin/env python3
"""Пачка 9 (14.09.26): расхождения данных по аудиту a11y-data."""
import os, sys
P = os.path.join(os.path.dirname(__file__), "..", "project", "Промышленный агрегатор.dc.html")
s = open(P, encoding="utf-8").read()
def R(old, new, n=1):
    global s
    c = s.count(old)
    if c != n: sys.exit(f"[{c}≠{n}] {old[:100]!r}")
    s = s.replace(old, new)
R('{ v: "5 шт.", weight: "400", color: "var(--color-text)" }, { v: "3 шт.", weight: "400", color: "var(--color-text)" }',
  '{ v: "5 шт.", weight: "400", color: "var(--color-text)" }, { v: "5 шт.", weight: "400", color: "var(--color-text)" }')
R('{ v: "4 дня", weight: "400", color: "var(--color-text)" }, { v: "3 дня", weight: "400", color: "var(--color-text)" }',
  '{ v: "4 дня", weight: "400", color: "var(--color-text)" }, { v: "2–4 дня", weight: "400", color: "var(--color-text)" }')
R('<span>Артикул KSN-LGCY-75-10</span>', '<span>Артикул KSN-LGCY-75</span>')
R('sku: "KSN-LGCY-75-10"', 'sku: "KSN-LGCY-75"')
R('price: "58 400 ₽", status: "Совпадение"', 'price: "58 410 ₽", status: "Совпадение"')
R('>Найдено 1 128</span>', '>Найдено 214</span>')
open(P, "w", encoding="utf-8").write(s)
print("пачка 9 применена")

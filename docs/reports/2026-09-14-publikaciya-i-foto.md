# Отчёт: публикация макета ПРОМКОНТУР и фото (14.09.2026)

## Что сделано
- Макет из Claude Design (`~/Downloads/b2b`) перенесён в `~/projects/b2b-marketplace`.
- Публичный репозиторий https://github.com/Alex1986-rgb/b2b-marketplace, GitHub Pages через Actions
  (`.github/workflows/pages.yml`, публикуется папка `project/`). Живой адрес:
  https://alex1986-rgb.github.io/b2b-marketplace/ (корень перекидывает на `Промышленный агрегатор.dc.html`).
- Сгенерировано 22 фото через Arion HUB (`gpt-image-2`, ключ `~/.claude/secrets/arionhub.env`):
  склад, 6 товаров каталога, бренд, насосная станция, котельная, 9 обложек статей, 2 фото в статье, шильдик.
  router.cheap пуст ($0.058), Higgsfield — 0 кредитов.
- Фото сжаты в JPEG (`project/img/`, ~5 МБ всего) и вставлены во все 16 плейсхолдеров, включая циклы
  каталога, корзины, мобильного каталога и списка статей. Подписи-заглушки «фото · …» убраны.
  Фото товаров вписываются целиком (contain), сцены — заполняют блок (cover). Синяя тонировка `duotone` — из дизайна.

## Что осталось
- QR-код бота MAX остался заглушкой (это не фото).
- Фото по 300–400 КБ — при переносе в боевую вёрстку перевести в WebP.
- Исходники PNG (`project/img/src/`) в git не входят.

## Что нужно от Александра
- Посмотреть фото на живом адресе; неудачные кадры перегенерировать:
  удалить `project/img/src/<имя>.png` → `python3 tools/gen_photos.py` → `python3 tools/place_photos.py`.

## Файлы
- `tools/gen_photos.py`, `tools/imggen_arion.py`, `tools/place_photos.py`
- `project/img/*.jpg`, `project/Промышленный агрегатор.dc.html`, `project/index.html`
- `.github/workflows/pages.yml`

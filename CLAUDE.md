# CLAUDE.md — «Последняя ветка»

Пиксельная 2D-игра про метро Самары (станция «Гагаринская»). HTML5 Canvas 2D, PWA для iPhone, без зависимостей.
PROD — ветка `main` → https://kidgat.github.io/poslednyaya-vetka/ · DEV — ветка `dev` → https://poslednyaya-vetka-dev.pages.dev/

## Запреты (без отдельной команды Андрея)
- Не делать push и merge в `main` и `dev`, не выпускать версии, не менять настройки публикации.
- Не менять канон `docs/CANON_v1.46_TECH.md`, сюжет и графику сверх ТЗ.
- Не удалять ветки `release/*`, `backup/*`. Работа — в своей ветке от `dev`.

## Код
- Правится только `src/`. `index.html` — **собранный файл**: `node tools/build.mjs`. Руками не править, целиком не читать.
- Порядок модулей — список `MODULES` в `tools/build.mjs`. Все модули внутри одной обёртки `'use strict'` из `src/shell.html`.
- Новый модуль — файл в `src/` + строка в `MODULES`. Маркеры `/* X:BEGIN */ … /* X:END */` не разрывать между файлами.

| Задача | Читать |
|---|---|
| числа, этажи, сцены, NPC, ключи сохранений | `01-config.js` |
| генератор, свет по цепям | `10-power.js`, `15-runtime.js` |
| сбор, реакции, разбор сохранений | `11-scavenge.js` |
| план станции | `12-station.js` |
| сцены, порталы, `pv.scene.v1` | `13-scene-core.js`, `23-scene.js` |
| ядро сохранений SAVE-001 (не встроено) | `14-save.js` |
| графика станции | `20-world.js` |
| улица S1: картинки (S1-ART), загрузчик, резерв | `25-street-s1-art.js` (картинки — `24-s1-art.js`, **не читать**: 0,6 МБ data URI) |
| поверхность над станцией: картинки (ST-ART-001), загрузчик, свет над землёй | `27-surface-st-art.js` (картинки — `26-st-art.js`, **не читать**) |
| поверхность-сцена SURF (ST-VIEW): сборка из панорамы + Canvas-дорога, загрузчик | `28-surface-view.js` (панорама — `29-stview-art.js`, **не читать**: ~0,75 МБ data URI) |
| улица S1 процедурная (резерв) и общие слои улиц | `21-outdoor.js`, `22-street-s1.js` |
| спрайты, NPC | `30-sprites.js`, `31-actors.js` |
| управление, герой, камера | `40-input.js`, `41-player.js`, `42-camera-fx.js` |
| отрисовка кадра | `50-render.js` |
| кнопки, яркость, масштаб, фонарь, карточки | `60-ui.js`, `shell.html` |
| цикл игры, загрузка/запись, service worker | `90-game.js` |

## Картинки S1 (S1-ART)
- Исходники `art/ART-SURF-001/` не менять (SHA256SUMS). Подготовка: `python3 tools/art/prep_s1.py` → `art/s1/game/`, упаковка: `node tools/art/pack.mjs` → `src/24-s1-art.js`, затем сборка.
- В игре картинки только data URI внутри `index.html`: `sw.js` не трогать. `?s1=proc` — процедурная S1 для сравнения.
- Поверхность станции (ST-ART-001): исходник `art/ST-ART-001/`, `python3 tools/art/prep_st.py` → `art/st/game/`, `node tools/art/pack.mjs st` → `src/26-st-art.js`. `?st=proc` — прежняя поверхность.

## Перед коммитом
1. `node tools/build.mjs`
2. Все наборы: `for t in env station life power scavenge player ux input npc scene save compat; do node tests/$t.test.js | tail -1; done`
3. `node tools/build.mjs --check`, `node tools/art/pack.mjs s1 --check`, `node tools/art/pack.mjs st --check`, `node tools/art/pack.mjs stview --check`. CI проверяет то же самое.

## Версия и офлайн
- `CONFIG.VERSION` (`01-config.js`), `CACHE` в `sw.js` и `CHANGELOG.md` меняются вместе. Номер назначает Андрей.
- `sw.js` кэширует только `FILES`. Игре нужен один `index.html`, `src/` и `tools/` в кэш не добавлять.

## Сохранения
- Только через `saveKey`: PROD `pv.*`, DEV `pv.dev.*`. Формат не менять без ТЗ; старые ключи не удалять (канон § 3.6).
- `tests/compat.test.js` держит эталон разбора старых записей. Если он упал, значит затронуты сохранения на iPhone.

## Экономия токенов
- Не читать `docs/screenshots/`, `archive/`, а также целиком README, CHANGELOG и TEST_REPORTS: только нужный раздел.
- Отчёт — до 10 строк: что сделано, коммиты, тесты, что проверить на iPhone, что осталось.

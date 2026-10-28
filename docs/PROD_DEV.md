# PROD и DEV — «Последняя ветка» (этап 0)

## Статус (29.10.2026)

**Этап 0 принят автором.** Выполнено автором вручную и подтверждено:
- релиз и тег `v1.0.1` → `20c5da5` (проверено `git ls-remote`);
- `main` защищена активным правилом «Protect PROD main»: прямой push, удаление и force-push запрещены;
- DEV опубликован через Cloudflare Pages с веткой `dev`: https://poslednyaya-vetka-dev.pages.dev/;
- автор открыл DEV на iPhone (Safari) и проверил: метка «v1.0.1 DEV», движение, переходы, генератор, сохранения, независимость PROD/DEV — замечаний нет;
- GitHub Actions `tests` прошли.

1.1А «Сердце станции», часть 1 «Дом героя» (`6b4ed7c`) — принята автором на iPhone.
1.1А-UX1 «Масштаб и личный фонарь» (`8992c08`) — принят автором на iPhone.
1.1А-UX2 «Касание точки + удерживание» (`984daeb`) — принят автором на iPhone.

**Выпуск 1.1.0 (29.10.2026):**
- ветка `release/1.1.0` от принятого `984daeb`, в ней только релизные правки: версия, кэш, документы, архив 1.0.1;
- Pull Request `release/1.1.0` → `main`, слияние — только после решения автора;
- до слияния `main` = `20c5da5` (1.0.1), PROD не меняется;
- после слияния: проверка PROD, тег `v1.1.0`, проверка сохранений и PWA.

Сохранения с 1.1.0: PROD — `pv.player.v1` (положение) и `pv.zoom.v1` (масштаб) в дополнение к прежним; DEV — те же под `pv.dev.*`.

## Схема

| | PROD | DEV |
|---|---|---|
| Ветка | `main` — только стабильные релизы | `dev` — вся разработка |
| Адрес | https://kidgat.github.io/poslednyaya-vetka/ | https://poslednyaya-vetka-dev.pages.dev/ (Cloudflare Pages, ветка `dev`) |
| Метка в игре | `v1.0.1` | `v1.0.1 DEV` (оранжевая) |
| Сохранения | `pv.power.v1`, `pv.scavenge.v1`, `pv.visual.v1` (+ `pv.player.v1` с 1.1А) | `pv.dev.power.v1`, `pv.dev.scavenge.v1`, `pv.dev.visual.v1`, `pv.dev.player.v1` |
| Кэш service worker | `poslednyaya-vetka-<версия>`; чистит только `poslednyaya-vetka-*` | `pv-dev-<версия>`; чистит только `pv-dev-*` |
| Манифест / имя на «Домой» | `manifest.webmanifest`, «Последняя ветка» | `manifest-dev.webmanifest`, «ПВ DEV» |
| Стабильная точка | тег `v1.0.1` = `20c5da5` | — |

**Окружение определяется по адресу** — блок `ENV:BEGIN/END` в `index.html` и начало `sw.js`:
- DEV — хост `*.pages.dev` или путь `/poslednyaya-vetka-dev/`;
- PROD — всё остальное: адрес PROD, локальный файл, localhost.

Поэтому один и тот же код безопасен в обеих публикациях. После слияния `dev` → `main` игра на адресе PROD продолжает читать и писать только `pv.*`, к `pv.dev.*` она не обращается. Отдельного флага, который нужно не забыть переключить при релизе, нет.

На GitHub Pages обе публикации живут на одном origin `kidgat.github.io`, поэтому localStorage и Cache Storage у них общие. Пересечений нет:
- ключи сохранений разные;
- у кэшей разные префиксы: PROD при обновлении удаляет только `poslednyaya-vetka-*`, DEV — только `pv-dev-*`;
- области service worker разные папки (`/poslednyaya-vetka/` и `/poslednyaya-vetka-dev/`).

Это проверено тестом `envtest`. На Cloudflare origin отдельный, так что изоляция там полная.

## Ручные шаги этапа 0 (выполнены автором)

Из сессии Claude нельзя менять настройки GitHub: прокси разрешает только push веток, а создание тегов, защита веток, создание репозиториев и настройки Pages возвращают 403.

### 1. Тег `v1.0.1`
GitHub → репозиторий → **Releases** → **Draft a new release**:
- **Choose a tag** → ввести `v1.0.1` → **Create new tag**;
- **Target**: ветка `main` (коммит `20c5da5`);
- Title: `1.0.1 «Служебные переходы»` → **Publish release**.

### 2. Защита `main`
**Settings** → **Branches** → **Add branch ruleset** (или **Add classic branch protection rule**), шаблон ветки `main`:
- ✅ **Require a pull request before merging**, число одобрений — 0 (разработчик один);
- ✅ **Require status checks to pass** → проверка `tests`. Она появится в списке после первого Pull Request из `dev` в `main`; до этого включить только PR;
- ✅ **Block force pushes** (в классическом правиле — не ставить «Allow force pushes»);
- ✅ **Restrict deletions** (в классическом — не ставить «Allow deletions»);
- в ruleset: **Enforcement status: Active**; без Bypass list (или только вы сами).

GitHub Pages продолжает публиковать `main` как раньше: **Settings → Pages → Deploy from a branch → main / (root)** — не менять.

### 3. Публикация DEV — один из вариантов

**Вариант А (рекомендую) — Cloudflare Pages**: бесплатно, публикует ветку `dev` сам при каждом push, отдельный origin.
1. https://dash.cloudflare.com → войти или зарегистрироваться (бесплатный план).
2. **Workers & Pages** → **Create** → вкладка **Pages** → **Connect to Git** → GitHub → дать доступ к `kidgat/poslednyaya-vetka`.
3. Project name `poslednyaya-vetka` (если имя занято — любое: адрес будет `<имя>.pages.dev`).
4. **Production branch: `dev`**. Framework preset: **None**. Build command — пусто. Build output directory: `/`.
5. **Save and Deploy**. Через ~1 минуту игра открывается по адресу `https://<имя>.pages.dev/`.
6. Чтобы не публиковать лишнее: **Settings → Builds & deployments → Preview deployments → None** (или только `dev`).

**Вариант Б — отдельный GitHub Pages-проект**:
1. Создать пустой публичный репозиторий `kidgat/poslednyaya-vetka-dev`.
2. Сказать Claude — он подключит репозиторий к сессии и отправит туда сборку из `dev`.
3. В новом репозитории: **Settings → Pages → Deploy from a branch → main / (root)**.

Адрес — https://kidgat.github.io/poslednyaya-vetka-dev/. Минус: каждую сборку DEV туда нужно отправлять отдельно.

## Порядок работы

1. Разработка и коммиты — только в `dev`. DEV публикуется автоматически (вариант А) или вручную (вариант Б).
2. Автор проверяет DEV на iPhone, ChatGPT — коммиты `dev`.
3. Релиз — только с разрешения автора: Pull Request `dev` → `main`, проверка `tests` зелёная, слияние, тег `vX.Y.Z`.

## Откат к 1.0.1

- **Через Pull Request (при защищённой `main`)**: открыть PR, который возвращает `main` к тегу `v1.0.1`. Например, `git revert` всех коммитов после `20c5da5` в отдельной ветке → PR → слить. Сайт PROD вернётся к 1.0.1 за 1–2 минуты.
- **Только сайт, не ветку**: в **Settings → Pages** временно выбрать для публикации ветку или тег из `v1.0.1`. Сначала создать ветку `release-1.0.1` от тега: **Branches → New branch → source `v1.0.1`**.
- Сохранения игроков при откате сохраняются: формат `pv.*` в 1.0.1 и далее один и тот же.

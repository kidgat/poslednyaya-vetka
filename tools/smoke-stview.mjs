// Дымовой тест ST-VIEW-001 (этап 1): два экрана, двери-переходы, затемнение, сохранения, подземка без падений.
// Запуск: node tools/smoke-stview.mjs    (headless Chrome через playwright)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
const URL = 'file://' + path.resolve(ROOT, 'index.html') + '?debug&save=dev';
const results = [];
const ok = (n, c, info = '') => { results.push([!!c, n, info]); console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${info ? '  — ' + info : ''}`); };

const browser = await chromium.launch({ executable: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => window.pvDebug && window.pvDebug.scene);

const scene = () => page.evaluate(() => window.pvDebug.scene());
const place = (id, floor, x, f = 1) => page.evaluate(([i, fl, xx, ff]) => window.pvDebug.scenePlace(i, fl, xx, ff), [id, floor, x, f]);
const record = () => page.evaluate(() => window.pvDebug.sceneRecord());
// нажать «Действие» и дождаться завершения перехода (либо таймаут)
async function useAndWait(expectTo) {
  await page.evaluate(() => { const a = document.getElementById('act'); a.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })); });
  const landed = await page.waitForFunction(to => {
    const s = window.pvDebug.scene();
    return !s.trans && s.id === to;
  }, expectTo, { timeout: 4000 }).then(() => true).catch(() => false);
  return landed;
}

// 1. Старт: подземка (ST), без падений на boot
let s = await scene();
ok('S1 загрузка без ошибок на старте', errors.length === 0, errors[0] || '');
ok('S2 стартовая сцена — подземка ST', s.id === 'ST', 'id=' + s.id);

// 2. ST → SURF через дверь D_exit (вестибюль 1650)
ok('S3 постановка в вестибюль у двери выхода', await place('ST', 'vestibule', 1650, 1));
let land = await useAndWait('SURF');
s = await scene();
ok('S4 выход на поверхность: переход с затемнением завершён, сцена SURF', land && s.id === 'SURF', 'id=' + s.id);

// 3. SURF → ST через дверь D_metro (560)
ok('S5 постановка к входу в метро (560)', await place('SURF', 'surface', 560, -1));
land = await useAndWait('ST');
s = await scene();
ok('S6 вход в метро: вернулись в подземку ST', land && s.id === 'ST', 'id=' + s.id);

// 4. SURF → S1 «Дворы» через дверь D_yard (1980)
await place('SURF', 'surface', 1980, 1);
land = await useAndWait('S1');
s = await scene();
ok('S7 проход «Во дворы»: сцена S1', land && s.id === 'S1', 'id=' + s.id);

// 5. S1 → SURF обратно через правый край (возврат к тому же проходу): идём вправо до края
const s1 = await scene();
await place('S1', s1.floor, 3200, 1);
await page.keyboard.down('ArrowRight');
land = await page.waitForFunction(() => { const x = window.pvDebug.scene(); return !x.trans && x.id === 'SURF'; }, null, { timeout: 6000 }).then(() => true).catch(() => false);
await page.keyboard.up('ArrowRight');
s = await scene();
ok('S8 выход из «Дворов» вправо: снова поверхность SURF', land && s.id === 'SURF', 'id=' + s.id);

// 6. сохранение сцены пишется и валидно (pv.dev.scene.v1)
const rec = await record();
let recOk = false; try { const d = JSON.parse(rec); recOk = d && d.v === 1 && ['ST', 'SURF', 'S1', 'S2'].includes(d.scene); } catch (_) {}
ok('S9 сохранение сцены записано и корректно', recOk, rec ? rec.slice(0, 80) : 'нет записи');

// 7. подземка остаётся рабочей (вернёмся в ST и проверим, что рисуется без ошибок)
errors.length = 0;
await place('SURF', 'surface', 560, -1); await useAndWait('ST');
await page.waitForTimeout(400);
ok('S10 подземка после переходов — без ошибок рендера', errors.length === 0, errors[0] || '');

await browser.close();
const fails = results.filter(r => !r[0]).length;
console.log(`\n${results.length - fails} PASS, ${fails} FAIL`);
process.exit(fails ? 1 : 0);

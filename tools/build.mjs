// Сборка index.html из исходников src/ (TECH-001).
//   node tools/build.mjs          — собрать и записать index.html
//   node tools/build.mjs --check  — только сверить: index.html должен совпадать со сборкой (для CI и перед коммитом)
//   node tools/build.mjs --print  — вывести сборку в stdout, ничего не записывая (так её читают тесты)
// Без зависимостей. Модули склеиваются строго в порядке MODULES и вставляются в src/shell.html
// на место строки-метки. Внутри общей обёртки (() => { 'use strict'; … })() из shell.html,
// поэтому все модули видят друг друга так же, как разделы прежнего единого файла.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const OUT = join(ROOT, 'index.html');
const MARK = '/*@@MODULES@@*/\n';

// Порядок важен: это порядок разделов в игре. Новый модуль — добавить сюда.
export const MODULES = [
  '00-env.js',          // ENV: PROD / DEV, saveKey
  '01-config.js',       // CONFIG: все числа и реестры
  '02-util.js',         // UTIL, FONT
  '10-power.js',        // POWER: генератор, аккумулятор
  '11-scavenge.js',     // SCAVENGE: сбор, реакции, разбор сохранения игрока
  '12-station.js',      // STATION: план станции и проверки
  '13-scene-core.js',   // SCENE: реестр сцен, порталы, pv.scene.v1 (чистые функции)
  '14-save.js',         // SAVE: ядро сохранений SAVE-001 (в игру не встроено)
  '15-runtime.js',      // экземпляры Power / Scavenge / Reactions, PowerView
  '20-world.js',        // WORLD: пререндер станции
  '21-outdoor.js',      // OUTDOOR SCENES: общие слои улицы
  '22-street-s1.js',    // STREET: улица S1 «Дворы»
  '23-scene.js',        // Scene: переходы, кэш сцен, buildWorld
  '24-s1-art.js',       // S1-ART: картинки улицы S1 (сгенерировано tools/art/pack.mjs — не читать)
  '25-street-s1-art.js',// S1-ART: сборка S1 из картинок, загрузчик S1Art; резерв — процедурная S1
  '26-st-art.js',       // ST-ART-001: картинки поверхности станции (сгенерировано tools/art/pack.mjs st — не читать)
  '27-surface-st-art.js',// ST-ART-001: надземная часть станции из картинок; резерв — процедурная поверхность
  '28-surface-view.js',  // ST-VIEW-002: поверхность SURF — сборка сцены из панорамы + Canvas-дорога (резерв — заглушка)
  '29-stview-art.js',    // ST-VIEW-002: панорама поверхности (data URI, СГЕНЕРИРОВАНО tools/art/pack.mjs stview)
  '30-sprites.js',      // PLAYER_SPRITE: спрайты героя и NPC
  '31-actors.js',       // ACTORS: NPC
  '40-input.js',        // INPUT
  '41-player.js',       // PLAYER
  '42-camera-fx.js',    // CAMERA, FX
  '50-render.js',       // RENDER
  '60-ui.js',           // DEBUG, VISUAL, ZOOM, FLASHLIGHT, INFO CARD, GEN PANEL
  '90-game.js',         // GAME: цикл, сохранения, service worker, метка сборки
];

export function build() {
  const shell = readFileSync(join(SRC, 'shell.html'), 'utf8');
  const at = shell.indexOf(MARK);
  if (at < 0 || shell.indexOf(MARK, at + 1) >= 0) throw new Error('src/shell.html: метка ' + MARK.trim() + ' должна быть ровно одна');
  const extra = readdirSync(SRC).filter(f => f.endsWith('.js') && !MODULES.includes(f));
  if (extra.length) throw new Error('модули не перечислены в MODULES (tools/build.mjs): ' + extra.join(', '));
  const code = MODULES.map(f => readFileSync(join(SRC, f), 'utf8')).join('');
  return shell.slice(0, at) + code + shell.slice(at + MARK.length);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const html = build();
  if (process.argv.includes('--print')) {
    process.stdout.write(html);                                   // для тестов: tests/_src.js
  } else if (process.argv.includes('--check')) {
    let cur = '';
    try { cur = readFileSync(OUT, 'utf8'); } catch (_) { /* нет файла */ }
    if (cur !== html) {
      console.error('FAIL  index.html не совпадает со сборкой из src/. Правьте src/ и запустите: node tools/build.mjs');
      process.exit(1);
    }
    console.log('OK  index.html совпадает со сборкой из src/ (' + MODULES.length + ' модулей)');
  } else {
    writeFileSync(OUT, html);
    console.log('index.html собран из src/ (' + MODULES.length + ' модулей, ' + Buffer.byteLength(html) + ' байт)');
  }
}

// S1-ART: упаковка ассетов улицы S1 в модуль игры.
//   node tools/art/pack.mjs          — записать src/24-s1-art.js из art/s1/game/*.png и meta.json
//   node tools/art/pack.mjs --check  — сверить: модуль совпадает с файлами (CI, tests/compat.test.js)
// Без зависимостей. Картинки встраиваются data URI прямо в index.html — sw.js и офлайн-кэш не меняются.
// Подготовка картинок из исходников — tools/art/prep_s1.py (Python, вне CI).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = join(ROOT, 'art', 's1', 'game');
const OUT = join(ROOT, 'src', '24-s1-art.js');

export function pack() {
  const meta = JSON.parse(readFileSync(join(DIR, 'meta.json'), 'utf8'));
  const names = Object.keys(meta.images).sort();
  const lines = names.map(n => {
    const b = readFileSync(join(DIR, n + '.png'));
    if (b.length !== meta.images[n].bytes) throw new Error(`${n}.png: размер ${b.length} ≠ meta.json ${meta.images[n].bytes} — перезапустите prep_s1.py`);
    if (meta.images[n].pink) throw new Error(`${n}.png: розовых пикселей ${meta.images[n].pink}`);
    return `  ${n}: 'data:image/png;base64,${b.toString('base64')}',`;
  });
  const dims = Object.fromEntries(names.map(n => [n, [meta.images[n].w, meta.images[n].h]]));
  return [
    '/* S1-ART: картинки улицы S1 из ART-SURF-001 (СГЕНЕРИРОВАНО tools/art/pack.mjs — не читать и не править руками).',
    '   Исходники: art/ART-SURF-001/, подготовка: tools/art/prep_s1.py → art/s1/game/. Сборка сцены — src/25-street-s1-art.js. */',
    `const S1_ART_META = ${JSON.stringify({ dims, cells: meta.cells })};`,
    'const S1_ART_SRC = {',
    ...lines,
    '};',
    '',
  ].join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const js = pack();
  if (process.argv.includes('--check')) {
    let cur = ''; try { cur = readFileSync(OUT, 'utf8'); } catch (_) { /* нет файла */ }
    if (cur !== js) { console.error('FAIL  src/24-s1-art.js не совпадает с art/s1/game. Запустите: node tools/art/pack.mjs'); process.exit(1); }
    console.log('OK  src/24-s1-art.js совпадает с art/s1/game');
  } else {
    writeFileSync(OUT, js);
    console.log(`src/24-s1-art.js: ${Buffer.byteLength(js)} байт`);
  }
}

// S1-ART / ST-ART-001: упаковка ассетов в модуль игры.
//   node tools/art/pack.mjs [s1|st]          — записать модуль из art/<набор>/game/*.png и meta.json (по умолчанию s1)
//   node tools/art/pack.mjs [s1|st] --check  — сверить: модуль совпадает с файлами (CI, tests/compat.test.js)
//   s1 → src/24-s1-art.js (S1_ART_META, S1_ART_SRC) · st → src/26-st-art.js (ST_ART_META, ST_ART_SRC)
// Без зависимостей. Картинки встраиваются data URI прямо в index.html — sw.js и офлайн-кэш не меняются.
// Подготовка картинок из исходников — tools/art/prep_s1.py (Python, вне CI).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SETS = {
  s1: { dir: join(ROOT, 'art', 's1', 'game'), out: join(ROOT, 'src', '24-s1-art.js'), name: 'S1_ART', title: 'S1-ART: картинки улицы S1 из ART-SURF-001', srcs: 'art/ART-SURF-001/, подготовка: tools/art/prep_s1.py → art/s1/game/. Сборка сцены — src/25-street-s1-art.js.' },
  st: { dir: join(ROOT, 'art', 'st', 'game'), out: join(ROOT, 'src', '26-st-art.js'), name: 'ST_ART', title: 'ST-ART-001: картинки поверхности над «Гагаринской»', srcs: 'art/ST-ART-001/, подготовка: tools/art/prep_st.py → art/st/game/. Сборка — src/27-surface-st-art.js.' },
};

export function pack(set = 's1') {
  const { dir: DIR, name, title, srcs } = SETS[set];
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
    `/* ${title} (СГЕНЕРИРОВАНО tools/art/pack.mjs — не читать и не править руками).`,
    `   Исходники: ${srcs} */`,
    `const ${name}_META = ${JSON.stringify({ dims, cells: meta.cells || null })};`,
    `const ${name}_SRC = {`,
    ...lines,
    '};',
    '',
  ].join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const set = process.argv.find(a => SETS[a]) || 's1', { out: OUT } = SETS[set], rel = OUT.slice(ROOT.length + 1);
  const js = pack(set);
  if (process.argv.includes('--check')) {
    let cur = ''; try { cur = readFileSync(OUT, 'utf8'); } catch (_) { /* нет файла */ }
    if (cur !== js) { console.error(`FAIL  ${rel} не совпадает с art/${set}/game. Запустите: node tools/art/pack.mjs ${set}`); process.exit(1); }
    console.log(`OK  ${rel} совпадает с art/${set}/game`);
  } else {
    writeFileSync(OUT, js);
    console.log(`${rel}: ${Buffer.byteLength(js)} байт`);
  }
}

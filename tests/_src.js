/* TECH-001: общий источник кода для всех наборов тестов.
   Тесты проверяют сборку из src/ (источник правды), а не записанный index.html:
   node tools/build.mjs --print склеивает модули в памяти, ничего не меняя на диске.
   Совпадение index.html со сборкой проверяет отдельно node tools/build.mjs --check (CI). */
const { execFileSync } = require('child_process');
const path = require('path');

module.exports = execFileSync(process.execPath, [path.join(__dirname, '..', 'tools', 'build.mjs'), '--print'],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

/* Юнит-тесты чистой модели POWER из index.html (без браузера): node tests/power.test.js
   Модель вынимается между маркерами POWER:BEGIN/END, параметры — из CONFIG.POWER того же файла. */
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const model = src.slice(src.indexOf('/* POWER:BEGIN */'), src.indexOf('/* POWER:END */'));
const cfgText = src.slice(src.indexOf('  POWER: {') + 9, src.indexOf("SAVE_KEY: 'pv.power.v1',") + 26) + '}';
const cfg = Function(`return (${cfgText})`)();
const createPower = Function(`${model}; return createPower;`)();
let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${info ? '  [' + info + ']' : ''}`); };
const run = (P, sec, hz = 60) => { for (let i = Math.round(sec * hz); i > 0; i--) P.step(1 / hz); };
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const finite = P => [P.generator.fuel, P.battery.charge, P.canisters, ...Object.values(P.tick)].every(Number.isFinite);

let P = createPower(cfg);
ok('A01 старт: генератор вкл, топливо > 0, батарея конечна, цепи 1, аварийный 0',
  P.running() && P.generator.fuel === 15 && P.battery.charge === 30 && ['platform', 'technical', 'living', 'critical'].every(c => P.level(c) === 1) && P.level('emergency') === 0);
ok('арифметика: спрос 4.2, зарядка 0.4 при выработке 5.0', (run(P, 1), near(P.tick.demand, 4.2) && near(P.tick.charge, 0.4) && near(P.tick.produced, 5)),
  `demand ${P.tick.demand.toFixed(3)} charge ${P.tick.charge.toFixed(3)}`);
ok('A07 топливо тратится по dt: −0.05/с', near(P.generator.fuel, 15 - 0.05, 1e-9), P.generator.fuel.toFixed(4));
ok('огонь/свечи: level(null) = 1', P.level(null) === 1);

P.toggle();
ok('A02 остановка: обычные цепи 0, аварийный 1', ['platform', 'technical', 'living', 'critical'].every(c => P.level(c) === 0) && P.level('emergency') === 1);
const f0 = P.generator.fuel; run(P, 10);
ok('A07 выключенный генератор не тратит топливо', P.generator.fuel === f0);
ok('A04 аварийный контур тратит аккумулятор −0.35/с', near(P.battery.charge, 30 + 0.4 - 0.35 * 10, 1e-6), P.battery.charge.toFixed(3));
run(P, 200);
ok('A05 разряд: батарея 0, не отрицательная, аварийный 0', P.battery.charge === 0 && P.level('emergency') === 0, P.battery.charge);
run(P, 10);
ok('A05 нет «бесплатной» энергии после разряда', P.battery.charge === 0 && P.level('platform') === 0);

ok('A06 запуск с топливом: цепи 1, аварийный 0', P.toggle() && P.level('platform') === 1 && P.level('emergency') === 0);
run(P, 5);
ok('A06 аккумулятор снова заряжается', near(P.battery.charge, 2, 1e-6), P.battery.charge.toFixed(3));
run(P, 400);
ok('A08 топливо кончилось: генератор остановлен, не ниже 0', P.generator.fuel === 0 && !P.generator.on && P.level('platform') === 0, `fuel ${P.generator.fuel}`);
ok('заряд не превышает ёмкость', P.battery.charge <= cfg.BATT_CAP, P.battery.charge.toFixed(3));
ok('A08 запуск на пустом баке отклонён с причиной', P.toggle() === false && /Бак пуст/.test(P.message), P.message);

ok('A09 заправка из канистры', P.refuel() && P.generator.fuel === 10 && P.canisters === 1);
ok('A09 вторая канистра', P.refuel() && P.generator.fuel === 20 && P.canisters === 0);
ok('A09 канистры конечны: третьей нет', P.refuel() === false && P.generator.fuel === 20 && P.canisters === 0, P.message);
const Q = createPower(cfg); Q.generator.fuel = 95;
ok('A09 переполнение: при свободных < 10 заправка запрещена, топливо не теряется', Q.refuel() === false && Q.generator.fuel === 95 && Q.canisters === 2, Q.message);

const S = createPower(cfg); S.generator.on = false; S.generator.fuel = 0; S.canisters = 0; S.refresh();
ok('тупик распознаётся (для кнопки «Новая демонстрация»)', S.stuck() && S.toggle() === false && /Новая демонстрация/.test(S.message));
S.reset(); ok('сброс демонстрации возвращает стартовые запасы', S.running() && S.generator.fuel === 15 && S.canisters === 2 && S.battery.charge === 30);

const A = createPower(cfg), B = createPower(cfg); run(A, 60, 60); run(B, 60, 120);
ok('A10 детерминизм: 60 с на 60 Гц и 120 Гц дают одинаковый расход', near(A.generator.fuel, B.generator.fuel, 1e-9) && near(A.battery.charge, B.battery.charge, 1e-9),
  `fuel ${A.generator.fuel.toFixed(6)} / ${B.generator.fuel.toFixed(6)}`);

const R = createPower(cfg);
ok('A11 восстановление сохранения', R.restore({ v: 1, on: false, fuel: 7.5, charge: 12, canisters: 1 }) && !R.running() && R.generator.fuel === 7.5 && R.level('emergency') === 1);
const bad = [null, {}, { v: 2 }, { v: 1, on: 'yes', fuel: 5, charge: 5, canisters: 1 }, { v: 1, on: true, fuel: -1, charge: 5, canisters: 1 },
  { v: 1, on: true, fuel: NaN, charge: 5, canisters: 1 }, { v: 1, on: true, fuel: 5, charge: 1e9, canisters: 1 }, { v: 1, on: true, fuel: 5, charge: 5, canisters: 9 },
  { v: 1, on: true, fuel: Infinity, charge: 5, canisters: 1 }, { v: 1, on: true, fuel: 5, charge: 5, canisters: 1.5 }];
const T = createPower(cfg);
ok('A11 испорченные записи отклоняются, состояние не меняется', bad.every(b => T.restore(b) === false) && T.generator.fuel === 15 && T.canisters === 2);
const U = createPower(cfg); U.restore({ v: 1, on: true, fuel: 0, charge: 5, canisters: 0 });
ok('сохранение «вкл с пустым баком» не даёт ложной энергии', !U.running() && U.level('platform') === 0);
const V = createPower(cfg); V.step(0); V.step(-1); V.step(NaN); V.step(Infinity);
ok('step с нулевым/отрицательным/NaN dt игнорируется', V.generator.fuel === 15 && finite(V));
ok('нет NaN/Infinity в состоянии после всех сценариев', [P, Q, S, A, B, R, T, U, V].every(finite));

const W = createPower({ ...cfg, GEN_OUTPUT: 3.0 }); W.step(1 / 60);
ok('нехватка выработки: питание по приоритету critical > technical > platform > living',
  W.level('critical') === 1 && W.level('technical') === 1 && W.level('platform') === 0 && W.level('living') === 0, JSON.stringify(W.circuits));

console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);

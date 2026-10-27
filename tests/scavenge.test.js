/* Тесты поиска топлива и цикла реплик (без браузера): node tests/scavenge.test.js
   Модели вынимаются между маркерами SCAVENGE:BEGIN/END и POWER:BEGIN/END, параметры — из CONFIG того же index.html. */
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const cut = (a, b) => src.slice(src.indexOf(a), src.indexOf(b));
const CONFIG = Function(`${src.slice(src.indexOf('const CONFIG = {'), src.indexOf('\n};', src.indexOf('const CONFIG = {')) + 3)} return CONFIG;`)();
const { createScavenge, createDialogCursor } = Function(`${cut('/* SCAVENGE:BEGIN */', '/* SCAVENGE:END */')}; return { createScavenge, createDialogCursor };`)();
const createPower = Function(`${cut('/* POWER:BEGIN */', '/* POWER:END */')}; return createPower;`)();
const C = CONFIG.SCAVENGE;
let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${info ? '  [' + info + ']' : ''}`); };
const run = (S, sec, hz = 60) => { for (let i = Math.round(sec * hz); i > 0; i--) S.step(1 / hz); };

// Находки и переносимый запас
let S = createScavenge(C);
ok('F01 три точки поиска на поверхности: гараж, машина, тайник', C.SPOTS.length === 3 && C.SPOTS.every(s => s.floor === 'surface') && ['garage', 'car', 'cache'].every(id => S.spot(id)));
ok('F02 старт: при себе 0, все три точки с канистрой', S.carried === 0 && ['garage', 'car', 'cache'].every(id => S.available(id)));
ok('F03 подбор кладёт канистру в переносимый запас 1/2', S.pick('car') && S.carried === 1 && !S.available('car'), S.message);
ok('F04 повторный подбор в той же точке — «пусто», запас не растёт', S.pick('car') === false && S.carried === 1 && /пусто/.test(S.message), S.message);
ok('F05 вторая канистра: 2/2', S.pick('garage') && S.carried === 2);
ok('F06 полный запас: подбор отклонён, тайник остаётся с канистрой', S.pick('cache') === false && S.carried === 2 && S.available('cache') && /не унести/i.test(S.message), S.message);
// Сдача на склад
const P = createPower(CONFIG.POWER);
ok('F07 сдача в генераторной: carry → склад (2 + 2 = 4)', S.deliver(P) === 2 && S.carried === 0 && P.canisters === 4, S.message);
ok('F08 сдача с пустыми руками — 0, склад не меняется', S.deliver(P) === 0 && P.canisters === 4);
ok('F09 заправка затем — старым методом', P.generator.fuel === 15 && P.refuel() && P.generator.fuel === 25 && P.canisters === 3);
const Pf = createPower(CONFIG.POWER); Pf.store(4); const Sf = createScavenge(C); Sf.pick('car'); Sf.pick('garage');
ok('F10 склад полон (6): сдача отклонена, канистры остаются при себе', Sf.deliver(Pf) === 0 && Sf.carried === 2 && Pf.canisters === 6, Sf.message);
// Тайник разведчиков: пополнение только по активному времени
S = createScavenge(C);
ok('F11 тайник: первая канистра сразу', S.pick('cache') && !S.available('cache'));
S.deliver(createPower(CONFIG.POWER));
run(S, C.CACHE_REFILL - 1);
ok('F12 за 179 с тайник ещё пуст', !S.available('cache') && S.pick('cache') === false && /пополнят/.test(S.message), S.message);
run(S, 1.5);
ok('F13 после 180 с активной игры — новая канистра (не чаще одной)', S.available('cache') && S.cache.stock === 1);
run(S, 1000);
ok('F14 пока канистру не забрали, запас не копится (максимум 1)', S.cache.stock === 1);
const T = createScavenge(C); T.pick('cache'); T.step(1e9); T.step(-5); T.step(NaN);
ok('F15 огромный/отрицательный/NaN dt: таймер тайника не прыгает назад и не ломается', Number.isFinite(T.cache.t) && T.cache.stock === 1);
// Без тупика: все разовые точки исчерпаны — тайник продолжает пополняться
const D = createScavenge(C); const Pd = createPower(CONFIG.POWER);
let got = 0; for (const id of ['garage', 'car', 'cache']) { if (D.pick(id)) got++; if (D.carried === 2) D.deliver(Pd); }
for (let k = 0; k < 3; k++) { run(D, C.CACHE_REFILL + 1, 30); if (D.pick('cache')) got++; D.deliver(Pd); }
ok('F16 после трёх исходных находок тайник даёт ещё по канистре за цикл (тупика нет)', got === 6, `найдено ${got}`);
// Сохранение
const A = createScavenge(C); A.pick('car'); A.pick('cache'); run(A, 50);
const snap = JSON.parse(JSON.stringify(A.snapshot()));
const B = createScavenge(C);
ok('F17 сохранение/загрузка: при себе, разовые находки и таймер тайника', B.restore(snap) && B.carried === 2 && !B.available('car') && B.available('garage') && !B.available('cache') && Math.abs(B.cache.t - 50) < 1e-6);
ok('F18 после перезагрузки разовая находка не возвращается', B.available('car') === false);
const bad = [null, {}, { v: 2 }, { ...snap, carried: 3 }, { ...snap, carried: -1 }, { ...snap, carried: 1.5 }, { ...snap, taken: ['cache'] },
  { ...snap, taken: ['car', 'car'] }, { ...snap, taken: 'car' }, { ...snap, cache: { stock: 2, t: 0 } }, { ...snap, cache: { stock: 0, t: NaN } },
  { ...snap, cache: { stock: 0, t: -1 } }, { ...snap, cache: { stock: 0, t: 1e9 } }, { ...snap, cache: null }];
const E = createScavenge(C); E.pick('garage');
ok('F19 испорченные записи отклоняются, состояние не меняется', bad.every(b => E.restore(b) === false) && E.carried === 1 && !E.available('garage'));
ok('F20 snapshot не содержит NaN', JSON.stringify(createScavenge(C).snapshot()).indexOf('null') < 0);

// Цикл реплик
const cur = createDialogCursor(), n = 10, seen = [];
seen.push(cur.open('board', n)); for (let k = 0; k < 10; k++) seen.push(cur.next('board', n));
ok('L01 доска: 11 нажатий — 10 разных сообщений по порядку, 11-е = 1-е', seen.join() === '0,1,2,3,4,5,6,7,8,9,0', seen.join());
const c2 = createDialogCursor(); c2.open('guard', 5); c2.next('guard', 5);
ok('L02 повторное открытие продолжает со следующей реплики', c2.open('guard', 5) === 2);
ok('L03 у каждого места свой счётчик', c2.open('medic', 5) === 0 && c2.peek('guard') === 2);
const board = CONFIG.INSPECTS.find(i => i.id === 'inspect-assembly-board');
ok('L04 на доске «СБОР» 10 разных объявлений', board.lines.length >= 10 && new Set(board.lines).size === board.lines.length, board.lines.length);
const who = ['inspect-west-post', 'inspect-east-post', 'talk-medic', 'talk-mechanic', 'talk-cook', 'talk-resident'];
ok('L05 посты, медик, механик, повар, жилец — по ≥5 разных реплик', who.every(id => { const i = CONFIG.INSPECTS.find(x => x.id === id); return i && i.lines.length >= 5 && new Set(i.lines).size === i.lines.length; }));

console.log(`\n${pass} PASS, ${fail} FAIL`); process.exit(fail ? 1 : 0);

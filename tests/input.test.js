/* 1.1А-UX2: гибридное управление — распознавание жеста, перевод касания в мировые координаты, цель на этаже, подход без перелёта. */
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const CONFIG = Function(`${src.slice(src.indexOf('const CONFIG = {'), src.indexOf('\n};', src.indexOf('const CONFIG = {')) + 3)} return CONFIG;`)();
const { classifyGesture, screenToWorld, tapTarget, autoWalkDir } = Function(`${src.slice(src.indexOf('/* SCAVENGE:BEGIN */'), src.indexOf('/* SCAVENGE:END */'))}; return { classifyGesture, screenToWorld, tapTarget, autoWalkDir };`)();
let pass = 0, fail = 0;
const ok = (n, c, i = '') => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${i ? '  [' + i + ']' : ''}`); };
const T = CONFIG.TOUCH, P = CONFIG.PLAYER;
ok('I01 параметры в CONFIG: удержание 180–220 мс, допуск сдвига 8–12 CSS px', T.HOLD_MS >= 180 && T.HOLD_MS <= 220 && T.SLOP >= 8 && T.SLOP <= 12);
ok('I02 короткое касание без сдвига — tap', classifyGesture(CONFIG, 90, 3, true, false) === 'tap' && classifyGesture(CONFIG, T.HOLD_MS - 1, T.SLOP, true, false) === 'tap');
ok('I03 пока палец не отпущен и время не вышло — pending (ходьба ещё не началась)', classifyGesture(CONFIG, 50, 2, false, false) === 'pending');
ok('I04 удерживание ≥ HOLD_MS — hold (прежняя ходьба), даже если потом отпустили', classifyGesture(CONFIG, T.HOLD_MS, 0, false, false) === 'hold' && classifyGesture(CONFIG, 400, 0, true, false) === 'hold');
ok('I05 явный сдвиг пальца > SLOP — hold, а не точка назначения', classifyGesture(CONFIG, 60, T.SLOP + 1, false, false) === 'hold' && classifyGesture(CONFIG, 60, 40, true, false) === 'hold');
ok('I06 два пальца в игровой области — не точка назначения', classifyGesture(CONFIG, 80, 2, true, true) === 'none');
// координаты: iPhone 844×390 @3, масштаб ×4..×7, камера сдвинута
const view = (scale, camX, camY) => ({ left: 0, top: 0, cssW: 844, cssH: 390, devW: 2532, devH: 1170, scale, camX, camY });
const rt = [4, 5, 6, 7].every(sc => [[0, -22.5], [700.4, 10.2], [1367, 100]].every(([cx, cy]) => {
  const wx = cx + 123.4, wy = cy + 61.7, css = [(wx - cx) * sc / 3, (wy - cy) * sc / 3], w = screenToWorld(view(sc, cx, cy), css[0], css[1]);
  return Math.abs(w.x - wx) < 1e-6 && Math.abs(w.y - wy) < 1e-6; }));
ok('I07 CSS px → мир: devicePixelRatio, масштаб ×4/5/6/7 (100–175%) и дробная камера — точно', rt);
const off = screenToWorld({ left: 10, top: 5, cssW: 422, cssH: 195, devW: 1266, devH: 585, scale: 4, camX: 100, camY: 0 }, 10 + 211, 5);
ok('I08 учитываются смещение и CSS-размер canvas (getBoundingClientRect)', Math.abs(off.x - (100 + 211 * 3 / 4)) < 1e-9 && off.y === 0, JSON.stringify(off));
const U = CONFIG.FLOORS.upper;
ok('I09 точка на дорожке этажа → цель; округление до 0.1', tapTarget(CONFIG, 'upper', 500.04, U.y - 10) === 500);
ok('I10 выше / ниже дорожки (изображение соседнего этажа) — отказ', tapTarget(CONFIG, 'upper', 500, U.y - T.BAND[0] - 1) === null && tapTarget(CONFIG, 'upper', 500, U.y + T.BAND[1] + 1) === null && tapTarget(CONFIG, 'upper', 500, CONFIG.FLOORS.platform.y - 10) === null && tapTarget(CONFIG, 'platform', 500, U.y - 10) === null);
ok('I11 за границей проходимого участка — цель ограничена краем этажа', tapTarget(CONFIG, 'upper', -50, U.y) === U.minX && tapTarget(CONFIG, 'upper', 5000, U.y) === U.maxX);
ok('I12 полосы касания соседних этажей не пересекаются (одно касание — один этаж)', (() => { const ys = Object.values(CONFIG.FLOORS).map(f => f.y).sort((a, b) => a - b); return ys.every((y, i) => i === 0 || y - T.BAND[0] > ys[i - 1] + T.BAND[1]); })());
ok('I13 мусор (NaN, нет этажа) — отказ', tapTarget(CONFIG, 'upper', NaN, U.y) === null && tapTarget(CONFIG, 'basement', 100, 0) === null);
// подход к цели: та же физика, что updateWalk
const sim = (x0, target, vx0 = 0) => {
  let x = x0, vx = vx0, dt = CONFIG.STEP, flips = 0, last = 0, maxPast = 0;
  for (let i = 0; i < 2000; i++) {
    const r = autoWalkDir(CONFIG, x, vx, target); if (r.done) return { x, steps: i, flips, maxPast };
    const dir = r.dir;
    if (dir !== 0) { const a = Math.sign(vx) === -dir && vx !== 0 ? P.TURN : P.ACCEL; vx = Math.max(-P.MAX_SPEED, Math.min(P.MAX_SPEED, vx + dir * a * dt)); if (last && dir !== last) flips++; last = dir; }
    else { const s = Math.max(0, Math.abs(vx) - P.DECEL * dt); vx = Math.sign(vx) * s; }
    x += vx * dt; maxPast = Math.max(maxPast, Math.sign(target - x0) * (x - target));
  }
  return { x, steps: -1, flips, maxPast };
};
const runs = [[100, 600], [600, 100], [500, 507], [500, 493], [300, 1800], [1000, 1003.5]].map(([a, b]) => ({ a, b, ...sim(a, b) }));
ok('I14 подход без перелёта и дрожания: остановка в пределах 2–4 px, без разворотов', runs.every(r => r.steps > 0 && Math.abs(r.x - r.b) <= 4 && r.flips === 0 && r.maxPast <= 4), JSON.stringify(runs.map(r => [r.a, r.b, +r.x.toFixed(2), r.flips, +r.maxPast.toFixed(2)])));
const rev = sim(500, 450, P.MAX_SPEED);
ok('I15 новая цель позади на полном ходу — разворот один раз и остановка у цели', rev.steps > 0 && Math.abs(rev.x - 450) <= 4 && rev.flips <= 1, JSON.stringify(rev));
ok('I16 Input: касание не запускает ходьбу сразу — press() только после HOLD_MS или сдвига (toHold)', !/pointerdown', e => \{\s*e\.preventDefault\(\);\s*try \{ touchEl\.setPointerCapture\(e\.pointerId\); \} catch \(_\) \{[^}]*\}\s*this\.press\(/.test(src) && /setTimeout\(\(\) => toHold\(e\.pointerId, g\.x\), T\.HOLD_MS\)/.test(src));
ok('I17 цель не сохраняется и сбрасывается ручной ходьбой, переходами и окнами', /target: null,/.test(src) && /if \(Player\.target !== null && \(dir !== 0 \|\| Player\.state !== 'walk' \|\| opened\)\) \{ Player\.target = null; this\.mark = null; \}/.test(src) && !/target[^\n]*localStorage|localStorage[^\n]*target/.test(src));
ok('I18 маркер привязан к цели, не к таймеру: отмена — сразу, приход — угасание 0.3–0.5 с; мировой x', T.MARK >= 0.3 && T.MARK <= 0.5 && /if \(r\.done\) \{ Player\.target = null; if \(this\.mark\) \{ this\.mark\.fading = true;/.test(src) && /!this\.mark\.fading && Player\.target === null/.test(src) && /mk\.fading \? Math\.max\(0, mk\.t \/ CONFIG\.TOUCH\.MARK\) : 1/.test(src) && /Math\.round\(mk\.x\) - camI/.test(src));
console.log(`\n${pass} PASS, ${fail} FAIL`); process.exit(fail ? 1 : 0);

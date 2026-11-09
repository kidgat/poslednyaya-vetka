/* ================================= GAME =================================== */
const Game = {
  t: 0, acc: 0, last: 0, running: true, zone: '', actLabel: '', coarse: true, buildMs: 0,
  els: {},
  start() {
    this.els = { zone: document.getElementById('zone'), hint: document.getElementById('hint'), title: document.getElementById('title'),
      act: document.getElementById('act'),
      power: document.getElementById('power'), carry: document.getElementById('carry') };
    const coarse = this.coarse = matchMedia('(pointer:coarse)').matches;
    if (!coarse) { document.body.classList.add('desktop'); this.els.hint.textContent = 'A / D или ← / → — идти · W / S — лестница и шлюз · E — действие · R — в центр';
      document.getElementById('tapText').textContent = 'Нажмите клавишу или кликните, чтобы начать'; }
    S1Art.start();                                                     // S1-ART: декод картинок улицы в фоне
    const t0 = performance.now();
    buildWorld(); buildSprites(); placeActors(); FX.init();
    STArt.start();                                                     // ST-ART-001: поверхность станции — после сборки мира (заменяет надземную часть)
    if ((ENV === 'dev' || Debug.on) && /[?&]hd(?:[=&]|$)/.test(location.search)) { buildHeroHD(); HD.on = true; HD.snap = /[?&]hd=snap/.test(location.search); }   // ART-TECH-001: прототип только по ?hd
    this.buildMs = Math.round(performance.now() - t0);
    Visual.load(); Zoom.load(); this.loadPower(); this.loadScavenge(); this.loadPlayer(); this.loadScene(); PowerView.sync(true); this.mainOn = Power.level('platform') > 0;
    GenPanel.init(); InfoCard.init(); Visual.init(); Zoom.init(); Flashlight.init();
    this.stationErrors = validateStationPlan(buildStationPlan(CONFIG, ROOMS), CONFIG);
    if (this.stationErrors.length) console.warn('Реестр станции:', this.stationErrors);
    this.sceneErrors = validateScenes(CONFIG);
    if (this.sceneErrors.length) console.warn('Реестр сцен:', this.sceneErrors);
    addEventListener('pagehide', () => { this.savePower(); this.saveScavenge(); this.savePlayer(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.savePower(); this.saveScavenge(); this.savePlayer(); } });
    Input.onEscape = () => { GenPanel.hide(); InfoCard.hide(); Visual.hide(); };
    Render.init(document.getElementById('screen'));
    Debug.init();
    if (Debug.on) window.pvDebug = Object.freeze({                      // только с ?debug: снимок модели и ускорение для тестов
      snapshot: () => ({ ...Power.snapshot(), circuits: { ...Power.circuits }, tick: { ...Power.tick } }),
      advance: sec => { for (let i = Math.round(sec / CONFIG.STEP); i > 0; i--) Power.step(CONFIG.STEP); },
      station: () => ({ plan: buildStationPlan(CONFIG, ROOMS), errors: [...this.stationErrors] }),
      place: (floor, x, facing = 1) => { if (!Scene.floor(floor) || Game.trans) return false; Player.place(floor, x, facing); Camera.snap(Player); return true; },
      scene: () => ({ id: Scene.id, prev: Scene.prev, builds: Scene.builds, disposed: Scene.disposed, buildLog: Scene.buildLog.slice(), bytes: Scene.bytes(),
        trans: Game.trans ? { portal: Game.trans.portal.id, from: Game.trans.from, to: Game.trans.to, ticket: Game.trans.ticket, phase: Game.trans.phase } : null,
        tickets: Game.ticket, applied: Game.applied, armed: Game.armed, hold: Game.holdT, fade: Game.fadeAlpha(), errors: [...this.sceneErrors],
        x: Player.x, floor: Player.floor, facing: Player.facing, state: Player.state, W: Scene.W() }),
      scenePlace: (id, floor, x, facing = 1) => {                       // фаза А, только ?debug: поставить героя в сцену (без перехода) для проверок
        if (Game.trans || !CONFIG.SCENES[id] || !sceneFloors(CONFIG, id)[floor]) return false;
        Scene.enter(id); Player.place(floor, x, facing); Game.armed = true; Game.holdT = 0; Camera.snap(Player); Game.updateZone(); return true; },
      sceneRecord: () => { try { return localStorage.getItem(saveKey(CONFIG.SCENE.SAVE_KEY)); } catch (_) { return null; } },   // 1.1А-UX1: для проверок камеры на этажах
      zoom: () => ({ idx: Zoom.idx, factor: Zoom.factor(), scale: Render.scale, base: Render.baseScale, viewW: Render.viewW, viewH: Render.viewH, camX: Camera.x, camY: Camera.y }),
      flashlight: () => ({ ...Player.flashlight(), drawn: Render.drawnLights }),
      touch: () => ({ mark: Game.mark ? { ...Game.mark } : null, target: Player.target, lastTap: Game.lastTap || null, gestures: Input.gestures.size, held: Input.held.length, vx: Player.vx, x: Player.x, scale: Render.scale, camX: Camera.x, camY: Camera.y }),
      player: () => { const sp = Player.sprite();                    // 1.0.1: фаза прохода и поза героя (спиной / лицом / боком)
        return { x: Player.x, y: Player.y, floor: Player.floor, state: Player.state, phase: Player.pass ? Player.pass.phase : null, k: Player.pass ? Player.pass.k : 0, dy: Render.archDY || 0,
          pose: !sp ? null : SPRITES.backWalk.includes(sp) || sp === SPRITES.back ? 'back' : SPRITES.frontWalk.includes(sp) ? 'front' : 'side' }; },
      card: () => (InfoCard.open ? InfoCard.item.id : null),
      actors: () => ACTORS.map(a => ({ id: a.id, kind: a.kind, set: a.set, x: a.x, y: a.y, facing: a.facing, lamp: a.lamp })),
      scavenge: () => ({ ...Scavenge.snapshot(), message: Scavenge.message }),
      cardState: () => (InfoCard.open ? { id: InfoCard.item.id, idx: InfoCard.idx, text: document.getElementById('cardText').textContent } : null),
      visual: () => ({ id: Visual.id, preset: { ...Visual.preset() } }),
      reactions: () => ({ queue: Reactions.queue.map(e => ({ ...e })), bubbles: ACTORS.filter(a => a.bubble).map(a => ({ id: a.id, text: a.bubble.text, kind: a.bubble.kind || null })) }),
      candle: () => (WORLD.candle ? { lamp: WORLD.candle.lamp, want: WORLD.candle.want } : null),
      lit: () => Render.litLamps || 0,
      toggleGen: () => { Power.toggle(); this.savePower(); return Power.generator.on; },
      section: () => {                                                  // 0.9: полный вертикальный разрез из готовых слоёв (без света) — для документации
        const c = makeCanvas(W, SURF_H + WORLD_BOTTOM), g = c.getContext('2d');
        for (let x = 0; x < W; x += WORLD.sky.width) g.drawImage(WORLD.sky, x, 0);   // небо уже мира (параллакс) — повторяем
        [WORLD.ruins, WORLD.surface].forEach(l => g.drawImage(l, 0, 0)); g.drawImage(WORLD.vest, VEST.x0, SURF_H + VEST.y0);
        [WORLD.back, WORLD.main, WORLD.fore].forEach(l => g.drawImage(l, 0, SURF_H)); g.drawImage(WORLD.util, 0, SURF_H + H);
        return { png: c.toDataURL(), sh: SURF_H, floors: CONFIG.FLOORS };
      },
      looks: () => lookReport(),                                        // NPC-001: облики — кадры, границы, отпечатки пикселей
      lookSheet: () => lookSheet(3).toDataURL(),
      hd: () => ({ on: HD.on, snap: HD.snap, frames: HD.map.size, buildMs: HD.buildMs, drawn: HD.frames, avgMs: HD.frames ? HD.frameMs / HD.frames : 0, w: HD_W, h: HD_H, bytes: HD.map.size * HD_W * HD_H * 4 }),
      hdSheet: () => { const c = makeCanvas(HD_W * 11 + 30 * 11, HD_H + 50), g = c.getContext('2d'); g.fillStyle = '#1e2426'; g.fillRect(0, 0, c.width, c.height); let x = 4; for (const [lo, hi] of HD.map) { g.drawImage(lo, x, 4); g.drawImage(hi, x + 28, 4); x += HD_W + 32; } return c.toDataURL(); },
      scavengeAdvance: sec => { for (let i = Math.round(sec / CONFIG.STEP); i > 0; i--) Scavenge.step(CONFIG.STEP); },
    });
    Player.onStep = (x, f, y) => FX.step(x, f, y);
    const act = this.els.act;
    act.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); act.classList.add('press'); Input.queue('use'); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => act.addEventListener(t, () => act.classList.remove('press')));
    Input.init(document.getElementById('touch'), () => { if (Scene.id !== 'ST' || this.trans) return; Player.reset(); Camera.snap(Player); });   // R — только на станции
    Input.onTap = (x, y) => this.tapAt(x, y);
    Input.onFirstInput = () => this.hideTitle();
    this.els.title.addEventListener('pointerdown', e => { e.preventDefault(); this.hideTitle(); });
    addEventListener('keydown', () => this.hideTitle(), { once: true });
    document.getElementById('ver').addEventListener('click', () => Debug.toggle());
    const onResize = () => { Render.resize(); Camera.snap(Player); };
    addEventListener('resize', onResize);
    if (window.visualViewport) visualViewport.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.last = performance.now(); });
    Camera.snap(Player);
    this.updateZone();
    this.last = performance.now();
    requestAnimationFrame(now => this.frame(now));
  },
  hideTitle() {
    Input.onFirstInput = null;                                         // 1.1А-UX2: заставку убрало её собственное касание — следующее касание мира уже игровое
    if (this.els.title.classList.contains('gone')) return;
    this.els.title.classList.add('gone');
    setTimeout(() => this.els.hint.classList.add('gone'), 6000);
  },
  /** Главный цикл: логика фиксированным шагом, отрисовка с интерполяцией. */
  frame(now) {
    let dt = (now - this.last) / 1000; this.last = now;
    if (dt > 0.25) dt = 0.25;                                           // после сворачивания не «телепортируемся»
    this.acc += dt;
    const STEP = CONFIG.STEP;
    while (this.acc >= STEP) { this.update(STEP); this.acc -= STEP; }
    Render.frame(this.acc / STEP, this.t);
    Debug.update(dt);
    requestAnimationFrame(n => this.frame(n));
  },
  update(dt) {
    this.t += dt;
    let dir = Input.dir();
    const manualDir = dir;                                               // фаза А: портал края — только по удержанию направления, не автоходом
    const action = Input.takeAction(), it = Player.interaction();
    // 1.1А-UX2: движение к точке. Ручная ходьба, проход/ворота, открытие окна генератора или карточки — отменяют цель.
    const opened = (GenPanel.open && !this.wasGen) || (InfoCard.open && !this.wasCard);
    this.wasGen = GenPanel.open; this.wasCard = InfoCard.open;
    // Маркер цели отражает состояние автодвижения: виден, пока цель жива; отмена — исчезает сразу; дошёл — гаснет за MARK с.
    if (Player.target !== null && (dir !== 0 || Player.state !== 'walk' || opened)) { Player.target = null; this.mark = null; }
    if (Player.target !== null) {
      const r = autoWalkDir(CONFIG, Player.x, Player.vx, Player.target);
      if (r.done) { Player.target = null; if (this.mark) { this.mark.fading = true; this.mark.t = CONFIG.TOUCH.MARK; } }
      dir = r.dir;
    }
    if (this.mark && (this.mark.floor !== Player.floor || (!this.mark.fading && Player.target === null))) this.mark = null;   // этаж сменился / цель снята иначе
    if (this.mark && this.mark.fading) { this.mark.t -= dt; if (this.mark.t <= 0) this.mark = null; }
    if (action === 'use' && it && it.kind === 'door') { if (!this.trans) this.startTransition(it.portal); Player.update(dt, dir, null); }   // ST-VIEW-001: вход/выход/во дворы — переход с затемнением
    else if (action && it && (it.kind === 'generator' || it.kind === 'inspect' || it.kind === 'scavenge')) {   // окна: без хода
      if (action === 'use') {
        if (it.kind === 'generator') GenPanel.toggle();
        else if (it.kind === 'inspect') InfoCard.use(it.item);
        else if (InfoCard.open && InfoCard.item === it.item) InfoCard.hide();
        else { Scavenge.pick(it.item.id); this.saveScavenge(); InfoCard.message(it.item, Scavenge.message); }
      }
      Player.update(dt, dir, null);
    } else Player.update(dt, dir, action);
    const near = Player.interaction();                                   // отошёл — окно закрылось
    if (GenPanel.open && near?.kind !== 'generator') GenPanel.hide();
    if (InfoCard.open && near?.item !== InfoCard.item) InfoCard.hide();
    if (InfoCard.open && InfoCard.item.npc) {                            // собеседник ждёт и смотрит на героя
      const a = npcById(InfoCard.item.npc);
      if (a) { a.talkT = 0.3; a.moving = false; if (a.kind !== 'sitter') a.facing = Player.x >= a.x ? 1 : -1; if (a.kind === 'walker') a.wait = Math.max(a.wait, 0.3); }
    }
    this.updateScene(dt, manualDir);
    Scavenge.step(dt);
    this.updatePower(dt);
    Camera.update(dt, Player);
    FX.update(dt, this.t, Camera.x, Render.viewW);
    if (Scene.id === 'ST') { updateActors(dt); updateLamps(dt); }        // фаза А: жители и лампы станции живут только на станции (не пересоздаются)
    const go = Player.gateOpenTarget();                                 // створки шлюза догоняют нужное положение
    WORLD.gate.open = clamp(WORLD.gate.open + (go > WORLD.gate.open ? 1 : -1) * dt * 1.8, 0, 1);
    if (dir && !this.moved) { this.moved = true; setTimeout(() => this.els.hint.classList.add('gone'), 1500); }   // подсказка уходит после первого шага
    this.updateZone();
    this.updateAction();
  },
  /* ---------------- Фаза А: переходы между сценами и их сохранение ----------------
     Портал края: герой упёрся в край этажа и держит направление за край HOLD с (шаг логики, не таймер) → билет перехода
     (ticket), затемнение FADE → смена сцены ровно один раз для билета → проявление FADE. До смены записывается безопасная точка
     ИСТОЧНИКА с pending, после — точка НАЗНАЧЕНИЯ без pending. Обратный портал взводится, когда герой отошёл на REARM px. */
  trans: null, ticket: 0, applied: 0, armed: true, holdT: 0, arrival: null,
  fadeAlpha() {
    const tr = this.trans; if (!tr) return 0;
    const k = Math.min(1, tr.t / CONFIG.SCENE.FADE);
    return tr.phase === 'out' ? k : 1 - k;
  },
  updateScene(dt, dir) {
    const C = CONFIG.SCENE, tr = this.trans;
    if (tr) {
      tr.t += dt;
      if (tr.phase === 'out' && tr.t >= C.FADE) this.applyTransition(tr);
      else if (tr.phase === 'in' && tr.t >= C.FADE) { this.trans = null; Player.state = 'walk'; Player.vx = 0; }
      return;
    }
    if (Player.state !== 'walk') { this.holdT = 0; return; }
    if (!this.armed && this.arrival && (Math.abs(Player.x - this.arrival.x) >= C.REARM || Player.floor !== this.arrival.floor)) this.armed = true;
    const p = this.armed ? edgePortalAt(CONFIG, Scene.id, Player.floor, Player.x, dir) : null;
    this.holdT = p ? this.holdT + dt : 0;
    if (p && this.holdT >= C.HOLD) this.startTransition(p);
  },
  startTransition(portal) {
    if (this.trans) return;                                              // один переход за раз: повторное касание и удержание его не дублируют
    const from = Scene.id, safe = portalSafeSpot(CONFIG, from, portal);
    this.trans = { portal, from, to: portal.to, ticket: ++this.ticket, phase: 'out', t: 0 };
    this.holdT = 0; Player.state = 'scene'; Player.vx = 0; Player.target = null; this.mark = null; Input.clear();
    if (from === 'ST') this.writePlayerV1(safe);                         // станция: в pv.player.v1 — точка перед порталом (валидна для 1.2.0)
    this.writeScene({ scene: from, floor: safe.floor, x: safe.x, facing: safe.facing, pending: { portal: portal.id, from, to: portal.to, ticket: this.trans.ticket } });
  },
  applyTransition(tr) {
    if (this.applied === tr.ticket) return;                              // билет применяется один раз
    this.applied = tr.ticket;
    const dst = portalTarget(CONFIG, tr.portal);
    Scene.enter(dst.scene);
    Player.place(dst.floor, dst.x, dst.facing); Player.state = 'scene';
    FX.puffs.length = 0;
    Camera.snap(Player);
    this.arrival = { floor: dst.floor, x: dst.x }; this.armed = false;
    this.commitScenePos(dst);
    tr.phase = 'in'; tr.t = 0;
    this.updateZone();
  },
  /** Записать положение после смены сцены (атомарно для сцены; pv.player.v1 всегда остаётся валидным для 1.2.0). */
  commitScenePos(pos) {
    if (pos.scene === 'ST') this.writePlayerV1(pos);
    else this.writePlayerV1(this.v1Fallback());
    this.writeScene({ scene: pos.scene, floor: pos.floor, x: pos.x, facing: pos.facing, pending: null });
  },
  /** Положение для старого движка, пока герой вне станции: у двери выхода в вестибюле (валидная точка станции). */
  v1Fallback() { const sp = CONFIG.SCENES.ST.spawns.fromSurf; return { floor: sp.floor, x: sp.x, facing: sp.facing }; },
  writePlayerV1(pos) {
    const rec = JSON.stringify({ v: 1, floor: pos.floor, x: Math.round(pos.x * 10) / 10, facing: pos.facing === -1 ? -1 : 1 });
    if (rec === this.lastPlayerRec) return;
    try { localStorage.setItem(saveKey(CONFIG.PLAYER.SAVE_KEY), rec); this.lastPlayerRec = rec; } catch (_) { /* хранилище недоступно */ }
  },
  /** pv.scene.v1 (через saveKey: в DEV — pv.dev.scene.v1). Поле v1 — запись pv.player.v1 на момент сохранения: если старая версия игры
      потом изменила pv.player.v1, сцена из этой записи не восстанавливается (главнее положение старой версии). */
  writeScene(o) {
    const rec = JSON.stringify({ v: 1, scene: o.scene, g: CONFIG.SCENES[o.scene].geo, floor: o.floor, x: Math.round(o.x * 10) / 10, facing: o.facing === -1 ? -1 : 1, pending: o.pending || null, v1: this.lastPlayerRec || null });
    if (rec === this.lastSceneRec) return;
    try { localStorage.setItem(saveKey(CONFIG.SCENE.SAVE_KEY), rec); this.lastSceneRec = rec; } catch (_) { /* хранилище недоступно */ }
  },
  loadScene() {
    let raw = null; try { raw = localStorage.getItem(saveKey(CONFIG.SCENE.SAVE_KEY)); } catch (_) { return; }
    if (!raw) return;
    const r = parseSceneSave(CONFIG, raw);
    let v1 = null, d = null; try { v1 = localStorage.getItem(saveKey(CONFIG.PLAYER.SAVE_KEY)); d = JSON.parse(raw); } catch (_) { /* нет доступа */ }
    if (!r) { try { localStorage.removeItem(saveKey(CONFIG.SCENE.SAVE_KEY)); } catch (_) { /* нет доступа */ } return; }   // испорчена — только эта запись; pv.player.v1 не трогаем
    this.lastPlayerRec = v1;
    if (d && d.v1 !== undefined && d.v1 !== v1) { this.writeScene({ scene: 'ST', floor: Player.floor, x: Player.x, facing: Player.facing }); return; }   // pv.player.v1 менялся без нас — верим ему
    if (r.scene === 'ST' && r.floor === 'surface') {                      // ST-VIEW-001: старая запись «на поверхности станции» → новая сцена поверхности
      const sp = CONFIG.SCENES.SURF.spawns.fromMetro; Scene.enter('SURF'); Player.place(sp.floor, sp.x, sp.facing); this.armed = true; this.commitScenePos({ scene: 'SURF', ...sp }); return;
    }
    if (r.scene === 'ST' && !r.pending) return;                           // на станции главный — pv.player.v1
    Scene.enter(r.scene);
    Player.place(r.floor, r.x, r.facing);
    this.armed = true;
    this.commitScenePos(r);                                               // прерванный переход закрыт: безопасная точка источника без pending
  },
  /** Энергосистема: шаг модели, плавный видимый уровень, реакции жителей, строка в HUD, периодическое сохранение. */
  updatePower(dt) {
    Power.step(dt); PowerView.sync(false);
    const on = Power.level('platform') > 0;
    if (on !== this.mainOn) { this.mainOn = on; actorsReact(!on, this.t); this.savePower(); }   // только при смене логического состояния
    updateReactions(this.t);
    this.saveT = (this.saveT || 0) + dt;
    if (this.saveT >= 2) { this.saveT = 0; this.savePower(); }
    const pw = this.els.power, txt = on ? '' : Power.battery.charge > 0
      ? `⚡ Нет питания · резерв ${Math.round(100 * Power.battery.charge / CONFIG.POWER.BATT_CAP)}%` : '⚡ Нет питания · резерв пуст';
    if (pw.textContent !== txt) { pw.textContent = txt; pw.hidden = !txt; }
    if (GenPanel.open) GenPanel.render();
    const cy = this.els.carry, ct = Player.floor === 'surface' || Scavenge.carried > 0 ? `Канистры при себе ${Scavenge.carried}/${CONFIG.SCAVENGE.CARRY_MAX}` : '';
    if (cy.textContent !== ct) { cy.textContent = ct; cy.hidden = !ct; }
    this.saveSt = (this.saveSt || 0) + dt;
    if (this.saveSt >= 5) { this.saveSt = 0; this.saveScavenge(); }      // таймер тайника — раз в 5 с
    this.savePt = (this.savePt || 0) + dt;
    if (this.savePt >= CONFIG.PLAYER.SAVE_EVERY) { this.savePt = 0; this.savePlayer(); }   // 1.1А: положение героя
  },
  saveScavenge() { try { localStorage.setItem(saveKey(CONFIG.SCAVENGE.SAVE_KEY), JSON.stringify(Scavenge.snapshot())); } catch (_) { /* хранилище недоступно */ } },
  /** Отдельный ключ: испорченная запись поиска сбрасывает только поиск, энергосистему не трогает. */
  loadScavenge() {
    try {
      const raw = localStorage.getItem(saveKey(CONFIG.SCAVENGE.SAVE_KEY));
      if (raw && !Scavenge.restore(JSON.parse(raw))) localStorage.removeItem(saveKey(CONFIG.SCAVENGE.SAVE_KEY));
    } catch (_) { try { localStorage.removeItem(saveKey(CONFIG.SCAVENGE.SAVE_KEY)); } catch (__) { /* нет доступа */ } }
  },
  /** 1.1А-UX2: короткое касание игровой области → цель на текущем этаже (или отказ: другой этаж, мимо дорожки, герой занят). */
  tapAt(cx, cy) {
    if (Player.state !== 'walk' || !Render.canvas) return;
    const r = Render.canvas.getBoundingClientRect();
    const w = screenToWorld({ left: r.left, top: r.top, cssW: r.width, cssH: r.height, devW: Render.canvas.width, devH: Render.canvas.height, scale: Render.scale, camX: Camera.x, camY: Camera.y }, cx, cy);
    const x = tapTarget({ FLOORS: Scene.floors(), TOUCH: CONFIG.TOUCH }, Player.floor, w.x, w.y);   // фаза А: этаж активной сцены
    this.lastTap = { wx: w.x, wy: w.y, x };
    if (x === null) return;
    if (Math.abs(x - Player.x) < CONFIG.TOUCH.MIN_DIST) { Player.target = null; this.mark = null; return; }   // у самого героя — без лишнего шага
    Player.target = x; this.mark = { x, floor: Player.floor, fading: false, t: CONFIG.TOUCH.MARK };   // прежний маркер заменяется
  },
  /** 1.1А: положение героя (pv.player.v1 через saveKey). Только в обычной ходьбе: во время прохода и ворот — прежняя запись. */
  savePlayer() {
    if (Player.state !== 'walk') return;
    if (this.trans) return;                                              // фаза А: во время смены сцены — прежняя запись
    if (Scene.id !== 'ST') { this.writeScene({ scene: Scene.id, floor: Player.floor, x: Player.x, facing: Player.facing }); return; }   // фаза А: вне станции pv.player.v1 не меняется
    const rec = JSON.stringify({ v: 1, floor: Player.floor, x: Math.round(Player.x * 10) / 10, facing: Player.facing });
    if (rec === this.lastPlayerRec) return;                               // не писать то же самое
    try { localStorage.setItem(saveKey(CONFIG.PLAYER.SAVE_KEY), rec); this.lastPlayerRec = rec; } catch (_) { /* хранилище недоступно */ }
  },
  loadPlayer() {
    const H = CONFIG.PLAYER.HOME;
    let raw = null; try { raw = localStorage.getItem(saveKey(CONFIG.PLAYER.SAVE_KEY)); } catch (_) { /* нет доступа */ }
    const p = raw ? parsePlayerSave(CONFIG, raw) : null;
    if (p && p.floor !== 'surface') Player.place(p.floor, p.x, p.facing);   // ST-VIEW-001: станция без поверхности; старая запись surface → домой (сцену восстановит loadScene)
    else {
      Player.place(H.floor, H.x, 1);                                     // нет записи или она испорчена — дома; прочие сохранения не трогаем
      if (raw) try { localStorage.removeItem(saveKey(CONFIG.PLAYER.SAVE_KEY)); } catch (_) { /* нет доступа */ }
    }
  },
  savePower() { try { localStorage.setItem(saveKey(CONFIG.POWER.SAVE_KEY), JSON.stringify(Power.snapshot())); } catch (_) { /* хранилище недоступно */ } },
  loadPower() {
    try {
      const raw = localStorage.getItem(saveKey(CONFIG.POWER.SAVE_KEY));
      if (raw && !Power.restore(JSON.parse(raw))) localStorage.removeItem(saveKey(CONFIG.POWER.SAVE_KEY));   // испорченная запись
    } catch (_) { /* битый JSON или нет доступа — стартуем с начальных запасов */ }
  },
  /** Кнопка действия: у лестницы, гермоворот или пульта генератора и только когда персонаж стоит на полу. */
  updateAction() {
    const it = GenPanel.open || InfoCard.open ? null : Player.interaction();
    let label = !it ? '' : it.kind === 'passage' ? (it.dir === 'up' ? '▲ Подняться' : '▼ Спуститься')
      : it.kind === 'door' ? it.label : it.kind === 'generator' ? (Scavenge.carried > 0 ? '⚙ Генератор · сдать канистры' : '⚙ Генератор') : it.item.label;
    if (it && it.kind === 'scavenge' && !Scavenge.available(it.item.id)) label = it.item.id === 'cache' ? '◎ Тайник пуст' : '◎ Пусто';
    if (label && !this.coarse) label += it.dir === 'up' ? '  ·  W' : it.dir === 'down' ? '  ·  S' : '  ·  E';
    if (label === this.actLabel) return;
    this.actLabel = label;
    this.els.act.textContent = label;
    this.els.act.classList.toggle('show', !!label);
    if (label) this.els.hint.classList.add('gone');
  },
  /** Подпись HUD: на платформе — зона, наверху — комната, в пути — «Лестница». */
  updateZone() {
    let z;
    if (Scene.id !== 'ST') z = Scene.def().name;                          // фаза А: наружная сцена
    else if (Player.state === 'gate') z = 'Шлюз';
    else if (Player.state === 'passage') z = 'Служебная лестница';
    else if (Player.floor === 'surface') z = 'Поверхность · павильон';
    else if (ROOM_FLOORS.includes(Player.floor)) {
      const r = ROOMS.find(r => roomFloor(r) === Player.floor && Player.x >= r.x - 5 && Player.x < r.x + r.w + 5);
      z = r ? (r.label.length <= 3 ? r.label : r.label[0] + r.label.slice(1).toLowerCase()) : { upper: 'Верхний ярус', vestibule: 'Вестибюль', utility: 'Хозяйственный ярус' }[Player.floor];
    } else z = CONFIG.ZONES.find(z => Player.x < z.to).name;
    if (z !== this.zone) { this.zone = z; this.els.zone.textContent = z; }
  },
};

Game.start();
/* NPC-001: галерея обликов для проверки на iPhone — только DEV и только по адресу с ?npc. Игру не меняет. */
if (ENV === 'dev' && /[?&]npc(?:[=&]|$)/.test(location.search)) {   // релиз 1.2.0: только DEV — в PROD галереи нет даже с ?debug
  const d = document.createElement('div'), c = lookSheet(3), w = Math.min(innerWidth - 16, c.width);
  d.style.cssText = 'position:fixed;inset:0;z-index:50;background:rgba(8,10,12,.94);overflow:auto;-webkit-overflow-scrolling:touch;padding:8px';
  c.style.cssText = `width:${w}px;height:auto;image-rendering:pixelated;display:block;margin:0 auto`;
  const b = document.createElement('button'); b.type = 'button'; b.textContent = '✕'; b.setAttribute('aria-label', 'Закрыть галерею');
  b.style.cssText = 'position:fixed;top:8px;right:8px;width:44px;height:44px;font-size:20px;background:#1e2426;color:#e0c48c;border:1px solid #4a5254';
  b.addEventListener('click', e => { e.stopPropagation(); d.remove(); });
  d.addEventListener('pointerdown', e => e.stopPropagation());
  d.append(c, b); document.body.append(d);
}

/* Офлайн-режим: на обычном хостинге (https) игра кэшируется и потом открывается без интернета.
   С диска (file://) и во встроенных просмотрщиках регистрация не нужна и тихо пропускается. */
/** Метка сборки для DEV (SAN-001): 7 знаков FNV-1a от кода ЗАПУЩЕННОЙ страницы (встроенные скрипты).
    Меняется при любом изменении кода, одинакова у одинакового кода; по ней видно, что iPhone открыл не устаревшую копию из кэша.
    Это не git SHA: соответствие «метка → коммит» указывается в отчёте. Сохранения и кэш не трогает; в PROD не показывается. */
function buildId() {
  let h = 0x811c9dc5;
  for (const sc of document.scripts) if (!sc.src) { const t = sc.textContent; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } }
  return h.toString(16).padStart(8, '0').slice(0, 7);
}
if (ENV === 'dev') {                                                 // DEV: метка, своё имя на экране «Домой», свой манифест
  const v = document.getElementById('ver'); v.textContent = 'v' + CONFIG.VERSION + ' DEV · ' + buildId(); v.classList.add('dev');   // SAN-001: метка сборки
  document.title = 'Последняя ветка DEV ' + CONFIG.VERSION;
  const t = document.querySelector('meta[name="apple-mobile-web-app-title"]'); if (t) t.content = 'ПВ DEV';
  const m = document.querySelector('link[rel="manifest"]'); if (m) m.href = 'manifest-dev.webmanifest';
}
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* офлайн-кэш недоступен — игра работает и так */ });
}

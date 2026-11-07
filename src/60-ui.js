/* ================================ DEBUG =================================== */
const Debug = {
  el: null, on: /[?&]debug/.test(location.search), fps: 60,
  init() { this.el = document.getElementById('debug'); this.el.style.display = this.on ? 'block' : 'none'; },
  toggle() { this.on = !this.on; this.el.style.display = this.on ? 'block' : 'none'; },
  update(dt) {
    if (dt > 0) this.fps += (1 / dt - this.fps) * 0.05;
    if (!this.on) return;
    this.el.textContent =
      `FPS   ${this.fps.toFixed(0)}\nX     ${Player.x.toFixed(1)}  v ${Player.vx.toFixed(1)}\nCAM   ${Camera.x.toFixed(2)} / ${Camera.y.toFixed(1)}\n` +
      `FLOOR ${Player.floor} · ${Player.state}  Y ${Player.y.toFixed(1)}\n` +
      `VIEW  ${Render.viewW}×${Render.viewH} ×${Render.scale}\nDPR   ${Render.dpr}  LIGHTS ${Render.drawnLights}\n` +
      `INPUT ${Input.dir()}  BUILD ${Game.buildMs} мс\n` +
      `GEN   ${Power.generator.on ? 'ON ' : 'off'} fuel ${Power.generator.fuel.toFixed(2)}  cans ${Power.canisters}\n` +
      `BATT  ${Power.battery.charge.toFixed(2)} / ${CONFIG.POWER.BATT_CAP}\n` +
      `CIRC  P${Power.level('platform')} T${Power.level('technical')} L${Power.level('living')} C${Power.level('critical')} E${Power.level('emergency')}\n` +
      `TICK  +${Power.tick.produced.toFixed(2)} −${Power.tick.demand.toFixed(2)} chg ${Power.tick.charge.toFixed(2)} fuel/s ${Power.tick.burn.toFixed(3)} em ${Power.tick.emergency.toFixed(2)}`;
  },
};

/* ================================ VISUAL ==================================
   Режим яркости сцены: «Атмосферно» / «Нормально» (по умолчанию) / «Светлее». Меняет карту освещения и виньетку,
   HUD и карточки не трогает. Своё сохранение pv.visual.v1 — ресурсы (pv.power.v1, pv.scavenge.v1) не затрагиваются. */
/** 1.1А-UX1: кнопка интерфейса по отпусканию пальца (как ⚙): касание не уходит в сенсорный слой ходьбы. */
function tapButton(btn, fn) {
  let down = null, skip = false;
  btn.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); down = e.pointerId; btn.classList.add('press'); try { btn.setPointerCapture(e.pointerId); } catch (_) { /* не обязателен */ } });
  btn.addEventListener('pointerup', e => {
    e.stopPropagation(); e.preventDefault(); btn.classList.remove('press');
    if (down !== e.pointerId) return; down = null;
    const r = btn.getBoundingClientRect(), m = 12;
    if (e.clientX >= r.left - m && e.clientX <= r.right + m && e.clientY >= r.top - m && e.clientY <= r.bottom + m) { fn(); skip = true; }
  });
  btn.addEventListener('pointercancel', () => { down = null; btn.classList.remove('press'); });
  btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); if (skip) { skip = false; return; } fn(); });   // клавиатура
}
/* ================================ ZOOM ===================================== */
const Zoom = {
  idx: 0,
  factor() { return CONFIG.ZOOM.LEVELS[this.idx]; },
  load() { try { this.idx = parseZoom(CONFIG, localStorage.getItem(saveKey(CONFIG.ZOOM.SAVE_KEY))); } catch (_) { this.idx = 0; } },
  step(d) {
    const i = zoomStep(CONFIG, this.idx, d);
    if (i === this.idx) return;
    this.idx = i;
    try { localStorage.setItem(saveKey(CONFIG.ZOOM.SAVE_KEY), JSON.stringify({ v: 1, level: this.factor() })); } catch (_) { /* хранилище недоступно */ }
    if (Render.canvas) { Render.resize(); Camera.snap(Player); }         // герой остаётся на месте, кадр центрируется на нём
    this.render();
  },
  init() {
    this.els = { out: document.getElementById('zoomOut'), in: document.getElementById('zoomIn') };
    tapButton(this.els.out, () => this.step(-1)); tapButton(this.els.in, () => this.step(1));
    this.render();
  },
  render() {
    if (!this.els) return;
    const last = CONFIG.ZOOM.LEVELS.length - 1;
    this.els.out.disabled = this.idx === 0; this.els.in.disabled = this.idx === last;
    const pct = Math.round(this.factor() * 100) + '%';
    this.els.out.setAttribute('aria-label', 'Уменьшить изображение (сейчас ' + pct + ')'); this.els.in.setAttribute('aria-label', 'Увеличить изображение (сейчас ' + pct + ')');
  },
};
/* ============================== FLASHLIGHT ================================ */
const Flashlight = {
  init() { this.el = document.getElementById('lamp'); tapButton(this.el, () => Player.toggleFlashlight()); this.render(); },
  render() { if (!this.el) return; this.el.setAttribute('aria-pressed', String(Player.flashlightOn)); this.el.classList.toggle('on', Player.flashlightOn); },
};
const Visual = {
  id: CONFIG.VISUAL.DEFAULT, els: {},
  preset() { return CONFIG.VISUAL.PRESETS[this.id]; },
  load() { try { this.id = parseVisual(CONFIG.VISUAL, localStorage.getItem(saveKey(CONFIG.VISUAL.SAVE_KEY))); } catch (_) { this.id = CONFIG.VISUAL.DEFAULT; } },
  set(id) {
    if (!CONFIG.VISUAL.PRESETS[id]) return;
    this.id = id;
    try { localStorage.setItem(saveKey(CONFIG.VISUAL.SAVE_KEY), JSON.stringify({ v: 1, brightness: id })); } catch (_) { /* хранилище недоступно */ }
    if (Render.canvas) Render.vignette = Render.makeVignette();          // маска виньетки — только при смене режима
    this.render();
  },
  init() {
    const $ = id => document.getElementById(id);
    this.els = { root: $('opts'), btn: $('opt') };
    const stop = e => e.stopPropagation(), btn = this.els.btn;
    this.els.root.addEventListener('pointerdown', stop);
    // 1.0: на iPhone «click» после касания мог не прийти (палец чуть сдвинулся) — переключаем по отпусканию пальца на кнопке.
    let down = null;
    btn.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); down = e.pointerId; btn.classList.add('press'); try { btn.setPointerCapture(e.pointerId); } catch (_) { /* не обязателен */ } });
    btn.addEventListener('pointerup', e => {
      e.stopPropagation(); e.preventDefault(); btn.classList.remove('press');
      if (down !== e.pointerId) return; down = null;
      const r = btn.getBoundingClientRect(), m = 12;                    // отпустили на кнопке (с запасом на дрожание пальца)
      if (e.clientX >= r.left - m && e.clientX <= r.right + m && e.clientY >= r.top - m && e.clientY <= r.bottom + m) { this.toggle(); this.skipClick = true; }
    });
    btn.addEventListener('pointercancel', () => { down = null; btn.classList.remove('press'); });
    btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); if (this.skipClick) { this.skipClick = false; return; } this.toggle(); });   // клавиатура
    this.els.root.querySelectorAll('button[data-b]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); this.set(b.dataset.b); }));
    document.addEventListener('pointerdown', () => this.hide());       // касание мимо панели — закрыть
    this.render();
  },
  toggle() { if (this.els.root.classList.contains('show')) this.hide(); else { this.els.root.classList.add('show'); this.els.btn.setAttribute('aria-expanded', 'true'); } },
  hide() { this.els.root.classList.remove('show'); this.els.btn.setAttribute('aria-expanded', 'false'); },
  render() { this.els.root?.querySelectorAll('button[data-b]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.b === this.id))); },
};

/* =============================== INFO CARD ================================
   Карточка осмотра поста или доски: заголовок, текст, ✕. Свой слой ввода, ничего не меняет в игре. */
const InfoCard = {
  open: false, item: null, idx: 0, els: {}, cursor: createDialogCursor(),
  init() {
    const $ = id => document.getElementById(id);
    this.els = { root: $('card'), title: $('cardTitle'), text: $('cardText'), index: $('cardIdx'), next: $('cardNext') };
    this.els.root.addEventListener('pointerdown', e => e.stopPropagation());
    $('cardClose').addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); this.hide(); });
    this.els.next.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); this.next(); });
  },
  /** E / кнопка действия: открыть; при открытой карточке того же места — следующая реплика (одна реплика — закрыть). */
  use(item) {
    if (this.open && this.item === item) { if (item.lines.length > 1) this.next(); else this.hide(); }
    else this.show(item);
  },
  show(item) {
    this.open = true; this.item = item; this.idx = this.cursor.open(item.id, item.lines.length);
    this.els.root.classList.add('show'); this.render();
  },
  /** Короткое сообщение без цикла (находки топлива). */
  message(item, text) { this.open = true; this.item = item; this.idx = 0; this.single = text; this.els.root.classList.add('show'); this.render(); },
  next() { if (!this.open || this.single != null) return this.hide(); this.idx = this.cursor.next(this.item.id, this.item.lines.length); this.render(); },
  render() {
    const it = this.item, many = this.single == null && it.lines.length > 1;
    this.els.title.textContent = it.title;
    this.els.text.textContent = this.single ?? it.lines[this.idx];
    this.els.index.textContent = many ? `${this.idx + 1}/${it.lines.length}` : '';
    this.els.next.textContent = many ? 'Далее ›' : 'Закрыть';
  },
  hide() { this.open = false; this.item = null; this.single = null; this.els.root.classList.remove('show'); },
};

/* ============================== GEN PANEL =================================
   Панель у пульта генератора: состояние, топливо, аккумулятор, канистры, кнопки. Свой слой ввода. */
const GenPanel = {
  open: false, armed: false, els: {},
  init() {
    const $ = id => document.getElementById(id);
    this.els = { root: $('gen'), state: $('genState'), fuel: $('genFuel'), fuelBar: $('genFuelBar'), batt: $('genBatt'), battBar: $('genBattBar'),
      battNote: $('genBattNote'), cans: $('genCans'), toggle: $('genToggle'), refuel: $('genRefuel'), reset: $('genReset'), msg: $('genMsg'),
      deliver: $('genDeliver') };
    this.els.root.addEventListener('pointerdown', e => e.stopPropagation());
    const on = (el, fn) => el.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); fn(); this.render(); });
    on($('genClose'), () => this.hide());
    on(this.els.toggle, () => { Power.toggle(); Game.savePower(); });
    on(this.els.refuel, () => { Power.refuel(); Game.savePower(); });
    on(this.els.deliver, () => { Scavenge.deliver(Power); Game.savePower(); Game.saveScavenge(); });
    on(this.els.reset, () => {                                          // двойное подтверждение: случайно не сбросить
      if (!this.armed) { this.armed = true; Power.message = 'Нажмите ещё раз, чтобы восстановить запасы'; return; }
      this.armed = false; Power.reset(); Game.savePower();
    });
  },
  toggle() { if (this.open) this.hide(); else this.show(); },
  show() { this.open = true; this.armed = false; Power.message = ''; this.els.root.classList.add('show'); this.render(); },
  hide() { this.open = false; this.armed = false; this.els.root.classList.remove('show'); },
  render() {
    const E = this.els, C = CONFIG.POWER, g = Power.generator, b = Power.battery;
    const set = (el, v) => { if (el.textContent !== v) el.textContent = v; };
    set(E.state, Power.running() ? 'работает' : g.fuel > 0 ? 'остановлен' : 'нет топлива');
    set(E.fuel, `${g.fuel.toFixed(1)} / ${C.FUEL_MAX}`); E.fuelBar.style.width = (100 * g.fuel / C.FUEL_MAX) + '%';
    set(E.batt, `${b.charge.toFixed(1)} / ${C.BATT_CAP}`); E.battBar.style.width = (100 * b.charge / C.BATT_CAP) + '%';
    set(E.battNote, Power.running() ? (b.charge >= C.BATT_CAP ? 'аккумулятор полон' : 'аккумулятор заряжается')
      : b.charge > 0 ? 'питает аварийный свет' : 'аккумулятор разряжен');
    set(E.cans, `${Power.canisters} из ${C.STORE_MAX}`);
    E.deliver.hidden = Scavenge.carried <= 0;
    set(E.deliver, `Сдать канистры (${Scavenge.carried})`);
    set(E.toggle, g.on ? 'Остановить' : 'Запустить');
    E.reset.hidden = !Debug.on;                                          // сброс — только для отладки: топливо ищут на поверхности
    set(E.reset, this.armed ? 'Точно сбросить?' : 'Новая демонстрация');
    set(E.msg, Power.message);
  },
};


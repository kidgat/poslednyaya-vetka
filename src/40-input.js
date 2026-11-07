/* ================================ INPUT ===================================
   Направление = последнее нажатое из удерживаемых (клавиши и касания).
   Любая потеря фокуса/сворачивание сбрасывает всё — клавиши не залипают. */
const Input = {
  held: [],                                // стек источников: {id, dir}
  action: null,                            // одноразовое действие: 'up' | 'down' | 'use'
  onFirstInput: null, onEscape: null,
  dir() { return this.held.length ? this.held[this.held.length - 1].dir : 0; },
  press(id, dir) { this.release(id); this.held.push({ id, dir }); if (this.onFirstInput) { this.onFirstInput(); this.onFirstInput = null; } },
  release(id) { this.held = this.held.filter(h => h.id !== id); },
  queue(a) { this.action = a; if (this.onFirstInput) { this.onFirstInput(); this.onFirstInput = null; } },
  takeAction() { const a = this.action; this.action = null; return a; },
  clear() { this.held.length = 0; this.action = null; if (this.gestures) { this.gestures.forEach(g => clearTimeout(g.timer)); this.gestures.clear(); } },
  onTap: null,                             // 1.1А-UX2: короткое касание точки → (clientX, clientY)
  gestures: new Map(),                     // pointerId → { x0, y0, t0, mode: 'pending' | 'hold', multi, timer } (задел под pinch)
  init(touchEl, onReset) {
    const KEYS = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1 };
    const ACTIONS = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', KeyE: 'use' };
    addEventListener('keydown', e => {
      if (e.code in KEYS) { e.preventDefault(); if (!e.repeat) this.press('k' + e.code, KEYS[e.code]); }
      else if (e.code in ACTIONS) { e.preventDefault(); if (!e.repeat) this.queue(ACTIONS[e.code]); }
      else if (e.code === 'Escape' && this.onEscape) this.onEscape();
      else if (e.code === 'KeyR') onReset();
      else if (e.code === 'KeyF') { e.preventDefault(); if (!e.repeat) Player.toggleFlashlight(); }          // 1.1А-UX1: фонарь
      else if (e.code === 'Minus' || e.code === 'NumpadSubtract') { if (!e.repeat) Zoom.step(-1); }       // масштаб
      else if (e.code === 'Equal' || e.code === 'NumpadAdd') { if (!e.repeat) Zoom.step(1); }
      else if (e.code === 'Backquote' || e.code === 'F3') { e.preventDefault(); Debug.toggle(); }
    });
    addEventListener('keyup', e => { if (e.code in KEYS) { e.preventDefault(); this.release('k' + e.code); } });
    const side = e => (e.clientX < innerWidth / 2 ? -1 : 1);
    // 1.1А-UX2: палец сначала «ждёт»: короткое касание — точка назначения, удерживание (HOLD_MS) или сдвиг (SLOP) — ходьба как раньше.
    const G = this.gestures, T = CONFIG.TOUCH;
    const toHold = (id, x) => { const g = G.get(id); if (!g || g.mode === 'hold') return; g.mode = 'hold'; clearTimeout(g.timer); this.press('p' + id, x < innerWidth / 2 ? -1 : 1); };
    touchEl.addEventListener('pointerdown', e => {
      e.preventDefault();
      try { touchEl.setPointerCapture(e.pointerId); } catch (_) { /* capture не обязателен */ }
      const multi = G.size > 0; if (multi) G.forEach(g => { g.multi = true; });
      const g = { x0: e.clientX, y0: e.clientY, x: e.clientX, t0: performance.now(), mode: 'pending', multi };
      g.timer = setTimeout(() => toHold(e.pointerId, g.x), T.HOLD_MS);
      G.set(e.pointerId, g);
    });
    touchEl.addEventListener('pointermove', e => {
      const g = G.get(e.pointerId); if (!g) return;
      g.x = e.clientX;
      if (g.mode === 'pending') {
        if (classifyGesture(CONFIG, performance.now() - g.t0, Math.hypot(e.clientX - g.x0, e.clientY - g.y0), false, g.multi) === 'hold') toHold(e.pointerId, e.clientX);
        return;
      }
      const h = this.held.find(x => x.id === 'p' + e.pointerId);         // палец переполз на другую половину
      if (h && h.dir !== side(e)) this.press(h.id, side(e));
    });
    const end = (e, cancel) => {
      const g = G.get(e.pointerId); G.delete(e.pointerId);
      this.release('p' + e.pointerId);
      if (!g) return;
      clearTimeout(g.timer);
      if (cancel || g.mode !== 'pending') return;
      const kind = classifyGesture(CONFIG, performance.now() - g.t0, Math.hypot(e.clientX - g.x0, e.clientY - g.y0), true, g.multi);
      if (kind !== 'tap') return;
      if (this.onFirstInput) { this.onFirstInput(); this.onFirstInput = null; return; }   // первое касание — только старт игры
      if (this.onTap) this.onTap(e.clientX, e.clientY);
    };
    touchEl.addEventListener('pointerup', e => end(e, false));
    ['pointercancel', 'lostpointercapture'].forEach(t => touchEl.addEventListener(t, e => end(e, true)));
    addEventListener('blur', () => this.clear());
    addEventListener('pagehide', () => this.clear());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.clear(); });
    ['gesturestart', 'gesturechange', 'contextmenu', 'dblclick'].forEach(t => document.addEventListener(t, e => e.preventDefault(), { passive: false }));
    document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
  },
};


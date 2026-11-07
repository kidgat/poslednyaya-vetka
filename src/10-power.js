/* ================================ POWER ===================================
   Чистая модель электросети: без DOM и Canvas, время идёт только через step(dt).
   Отрисовка лишь читает level(circuit). Блок между маркерами можно вынуть и проверять отдельно. */
/* POWER:BEGIN */
function createPower(cfg) {
  const NORMAL = Object.keys(cfg.DEMAND);                       // обычные цепи в порядке приоритета
  const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi);
  const P = {
    generator: { on: true, fuel: cfg.FUEL_START },
    battery: { charge: cfg.BATT_START },
    canisters: cfg.CANISTERS,
    circuits: { emergency: 0 },
    tick: { produced: 0, demand: 0, charge: 0, burn: 0, emergency: 0 },   // ед/с за последний шаг
    message: '',
    /** Уровень цепи 0..1; null — неэлектрический источник (огонь, свеча), всегда 1. */
    level(id) { return id == null ? 1 : (this.circuits[id] ?? 0); },
    running() { return this.generator.on && this.generator.fuel > 0; },
    stuck() { return this.generator.fuel <= 0 && this.canisters <= 0; },
    /** Обычные цепи получают питание строго по приоритету: если цепи не хватило, все менее важные тоже без питания.
        Остаток выработки — в аккумулятор. */
    distribute(avail) {
      let demand = 0, short = false;
      for (const id of NORMAL) {
        const d = cfg.DEMAND[id];
        if (!short && avail >= d - 1e-9) { this.circuits[id] = 1; avail -= d; demand += d; } else { this.circuits[id] = 0; short = true; }
      }
      return { left: Math.max(0, avail), demand };
    },
    step(dt) {
      if (!(dt > 0) || !Number.isFinite(dt)) return;
      const g = this.generator, b = this.battery, t = this.tick;
      t.produced = t.demand = t.charge = t.burn = t.emergency = 0;
      if (g.on && g.fuel <= 0) { g.on = false; g.fuel = 0; this.message = 'Генератор заглох: кончилось топливо'; }
      if (g.on) {
        const want = cfg.FUEL_RATE * dt, burn = Math.min(g.fuel, want), share = burn / want;
        g.fuel = Math.max(0, g.fuel - burn);
        const produced = cfg.GEN_OUTPUT * share, { left, demand } = this.distribute(produced);
        const ch = Math.max(0, Math.min(left, cfg.CHARGE_MAX, (cfg.BATT_CAP - b.charge) / dt));
        b.charge = Math.min(cfg.BATT_CAP, b.charge + ch * dt);
        this.circuits.emergency = 0;
        t.produced = produced; t.demand = demand; t.charge = ch; t.burn = burn / dt;
      } else {
        for (const id of NORMAL) this.circuits[id] = 0;
        if (b.charge > 0) {
          const use = Math.min(b.charge, cfg.EMERGENCY * dt);
          b.charge = Math.max(0, b.charge - use); this.circuits.emergency = 1; t.emergency = use / dt;
        } else this.circuits.emergency = 0;
      }
    },
    /** Пересчитать цепи без хода времени (после загрузки, переключения, сброса). */
    refresh() {
      if (this.running()) { this.distribute(cfg.GEN_OUTPUT); this.circuits.emergency = 0; }
      else { for (const id of NORMAL) this.circuits[id] = 0; this.circuits.emergency = this.battery.charge > 0 ? 1 : 0; }
    },
    toggle() {
      const g = this.generator;
      if (g.on) { g.on = false; this.message = 'Генератор остановлен'; }
      else if (g.fuel <= 0) {
        this.message = this.canisters > 0 ? 'Бак пуст — сначала заправьте из канистры'
          : 'Топлива нет и канистры кончились — ищите канистры на поверхности';
        return false;
      } else { g.on = true; this.message = 'Генератор запущен'; }
      this.refresh(); return true;
    },
    refuel() {
      const g = this.generator;
      if (this.canisters <= 0) { this.message = 'Канистр не осталось'; return false; }
      if (cfg.FUEL_MAX - g.fuel < cfg.CANISTER) { this.message = `В баке нет места для канистры: нужно свободно ${cfg.CANISTER}`; return false; }
      g.fuel += cfg.CANISTER; this.canisters -= 1; this.message = `Залито ${cfg.CANISTER} ед. топлива`;
      return true;
    },
    /** Принять канистры на склад (сдача найденного); возвращает принятое число, лишнее остаётся у героя. */
    store(n) {
      if (!Number.isInteger(n) || n <= 0) return 0;
      const k = Math.min(n, cfg.STORE_MAX - this.canisters);
      if (k <= 0) { this.message = `Склад полон: ${this.canisters} из ${cfg.STORE_MAX}`; return 0; }
      this.canisters += k; this.message = `На склад принято канистр: ${k}`; return k;
    },
    reset() {
      this.generator.on = true; this.generator.fuel = cfg.FUEL_START; this.battery.charge = cfg.BATT_START;
      this.canisters = cfg.CANISTERS; this.message = 'Запасы восстановлены для новой демонстрации'; this.refresh();
    },
    snapshot() { return { v: 1, on: this.generator.on, fuel: this.generator.fuel, charge: this.battery.charge, canisters: this.canisters }; },
    /** Загрузка сохранения с проверкой типов и границ; при ошибке состояние не меняется. */
    restore(s) {
      if (!s || s.v !== 1 || typeof s.on !== 'boolean' || !num(s.fuel, 0, cfg.FUEL_MAX) || !num(s.charge, 0, cfg.BATT_CAP)
        || !Number.isInteger(s.canisters) || s.canisters < 0 || s.canisters > cfg.STORE_MAX) return false;   // 0.6/0.7: 0–2, с 0.8: до склада
      this.generator.on = s.on && s.fuel > 0; this.generator.fuel = s.fuel; this.battery.charge = s.charge; this.canisters = s.canisters;
      this.refresh(); return true;
    },
  };
  P.refresh();
  return P;
}
/* POWER:END */


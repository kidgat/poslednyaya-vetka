const Power = createPower(CONFIG.POWER);
const Scavenge = createScavenge(CONFIG.SCAVENGE);
const Reactions = createReactions(CONFIG.REACT);
/** Видимый уровень цепей: плавно догоняет модель (доли секунды), один и тот же для света, свечения и ореолов. */
const PowerView = {
  levels: {}, main: 1,
  sync(now) {
    const ids = [...Object.keys(CONFIG.POWER.DEMAND), 'emergency'];
    for (const id of ids) {
      const target = Power.level(id), v = this.levels[id] ?? target;
      this.levels[id] = now ? target : v + (target - v) * Math.min(1, CONFIG.STEP * 12);
    }
    const L = this.levels;
    this.main = (L.platform + L.technical + L.living) / 3;
  },
};
const powerLevel = circuit => (circuit == null ? 1 : PowerView.levels[circuit] ?? 0);


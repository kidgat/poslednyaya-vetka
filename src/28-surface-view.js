/* ============================ ST-VIEW-001 ============================ */
/* Поверхность над «Гагаринской» — отдельная длинная сцена SURF (как «Дворы»): завал · рабочий вход в метро ·
   длинный дом · проход «Во дворы» · торцевой дом · заброшенный павильон · завал. Картинки готовятся из панорамы
   art/ST-VIEW-001/ (tools/art/prep_stview.py → art/stview/game → src/29-stview-art.js). Пока картинок нет —
   процедурная заглушка: плоская улица с подписями у дверей, чтобы проверить переходы, сбор топлива и сохранения. */
const SurfArt = {
  state: 'idle', imgs: null,
  start() { if (this.state === 'idle') this.state = 'off'; },            // stage 1: картинок нет — всегда заглушка
  kind() { return this.state === 'ready' ? 'art' : 'proc'; },
};

/** Заглушка поверхности: ровная улица шириной сцены, подписи у входа в метро, прохода во «Дворы» и точек сбора. */
function buildSurfPlaceholder() {
  const t0 = performance.now(), sc = CONFIG.SCENES.SURF, w = sc.W, F = sc.floors.surface;
  const surf = makeCanvas(w, SURF_H), gm = surf.getContext('2d', { willReadFrequently: true });
  const R2 = (x, y, ww, hh, c) => R(gm, x, surfRow(y), ww, hh, c);
  paintStreet(gm, w);
  // дома-заглушки между дверями, чтобы видеть ориентиры
  drawBlock(R2, 240, 300, 5, 11, [92, 86, 74]);                          // рабочий павильон слева (у входа в метро)
  drawBlock(R2, 820, 1000, 5, 22, [96, 90, 78]);                         // длинный дом
  drawBlock(R2, 2120, 360, 5, 33, [92, 88, 80]);                         // торцевой дом
  drawBlock(R2, 2900, 300, 2, 44, [90, 86, 80]);                         // заброшенный павильон справа
  R2(F.minX - 40, GROUND_Y - 70, 60, 70, '#2a2724'); R2(w - 20, GROUND_Y - 70, 60, 70, '#2a2724');   // завалы по краям
  for (const d of sc.doors) { drawText(gm, d.label.replace(/^[^ ]+ /, ''), d.x - (textWidth(d.label.replace(/^[^ ]+ /, '')) >> 1), surfRow(GROUND_Y - 80), '#d8c090', 'rgba(0,0,0,.5)'); R2(d.x - 1, GROUND_Y - 76, 2, 76, '#d8c090'); }
  for (const s of CONFIG.SCAVENGE.SPOTS) { const cx = (s.trigger[0] + s.trigger[1]) >> 1; drawText(gm, s.title, cx - (textWidth(s.title) >> 1), surfRow(GROUND_Y - 50), '#9a9488', null); }
  return { surface: surf, lights: [], emissive: [], kind: 'proc', buildMs: performance.now() - t0, bytes: w * SURF_H * 4 };
}

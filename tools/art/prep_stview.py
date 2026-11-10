#!/usr/bin/env python3
"""ST-VIEW-002: игровой фон поверхности SURF из утверждённой панорамы art/ST-ART-001/01-surface-gagarinskaya.png.

Запуск (Python 3, Pillow, numpy; в CI не нужен):  python3 tools/art/prep_stview.py
Результат: art/stview/game/panorama.png + meta.json → node tools/art/pack.mjs stview → src/29-stview-art.js.

Поверхность — отдельная длинная горизонтальная сцена (как S1 «Дворы»), прокручивается камерой.
Панорама не перекомпоновывается: композиция сохраняется как на рисунке (левый завал → действующий
укреплённый вход → длинная пятиэтажка → проход во «Дворы» → перпендикулярный дом → разрушенный
двухэтажный павильон → правый завал). Здесь только:
  1) лёгкое приведение к палитре «Дворов» (мягко, чтобы не потерять утверждённый вид);
  2) обрезка верхнего неба и нижней перспективной площади — остаётся полоса зданий до линии земли
     (мокрую дорогу/лужи/передний план рисует Canvas в src/29-stview-art.js);
  3) масштаб в игровые пиксели: этаж ≈ 64 px (Глеб 40 px). Исходник не меняется (SHA256SUMS).
"""
import json, os, sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from prep_s1 import crop_scale, png8, pink_count          # тот же BOX-масштаб и PNG8, что у «Дворов»

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'art', 'ST-ART-002', '01-surface-gagarinskaya.png')   # редакция 2 (уточнённый арт); композиция и ориентиры как у ST-ART-001
S1G = os.path.join(ROOT, 'art', 's1', 'game')
OUT = os.path.join(ROOT, 'art', 'stview', 'game')

K = 64 / 70            # этаж длинного дома на рисунке ≈ 70 px → 64 px игровых
CROP_TOP = 8           # верх: чуть выше крон и крыш (небо панорамы оставляем — оно часть фона)
GROUND = 576           # линия земли зданий на рисунке (ниже — мокрая перспективная площадь, её срезаем)
CROP_BOT = 586         # низ полосы: немного ниже оснований зданий (бордюр), дальше — Canvas-дорога
GRADE = 0.30           # мягкое приведение к палитре «Дворов» (0 — как на рисунке, 1 — полностью под S1)


def lum(x):
    return x[..., :3] @ np.array([0.30, 0.59, 0.11], np.float32)


def grade(rgb, ref, k):
    """Мягко к палитре «Дворов»: частичное обесцвечивание + перенос среднего/разброса каналов домов S1, смешанный долей k."""
    l = lum(rgb)[..., None]
    g = l + (rgb - l) * (1 - 0.35 * k)                       # лёгкое обесцвечивание
    m, s = g.reshape(-1, 3).mean(0), g.reshape(-1, 3).std(0) + 1e-4
    g = (g - m) / s * ref[1] + ref[0]
    return np.clip(rgb * (1 - k) + g * k, 0, 1)


def main():
    src = np.asarray(Image.open(SRC).convert('RGB')).astype(np.float32) / 255
    # эталон палитры «Дворов»: дома S1 (среднее и разброс каналов непрозрачных пикселей)
    px = []
    for n in ('houseA', 'houseB'):
        im = np.asarray(Image.open(os.path.join(S1G, n + '.png')).convert('RGBA')).astype(np.float32) / 255
        px.append(im[im[..., 3] > 0][:, :3])
    px = np.concatenate(px); ref = (px.mean(0), px.std(0))
    graded = grade(src.copy(), ref, GRADE)

    # полоса зданий до земли (без верхнего неба обрезать не будем — небо панорамы остаётся фоном сцены)
    a = np.dstack([graded, np.ones(graded.shape[:2], np.float32)])          # непрозрачный прямоугольник
    band = crop_scale(a, (0, CROP_TOP, src.shape[1], CROP_BOT), K)
    ground_row = round((GROUND - CROP_TOP) * K)                             # строка линии земли внутри картинки

    os.makedirs(OUT, exist_ok=True)
    out, back = png8(band)
    p = os.path.join(OUT, 'panorama.png')
    out.save(p, optimize=True)
    err = float(np.abs(back[..., :3] - band[..., :3]).mean() * 255)
    meta = {
        'note': 'Сгенерировано tools/art/prep_stview.py из art/ST-ART-001 — не править руками',
        'scale': {'k': K, 'pxPerM': 40 / 1.75},
        'ground': ground_row,                                               # линия земли (feet) внутри panorama.png
        'landmarks_src': {'metro_door': 338, 'yard_passage': 1402},         # x на исходнике: тёплый вход и проход во «Дворы»
        'images': {'panorama': {'w': int(band.shape[1]), 'h': int(band.shape[0]),
                                'pink': pink_count(back), 'err': round(err, 2), 'bytes': os.path.getsize(p)}},
    }
    meta['totalBytes'] = meta['images']['panorama']['bytes']
    with open(os.path.join(OUT, 'meta.json'), 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    v = meta['images']['panorama']
    print(f"panorama {v['w']}x{v['h']}  {v['bytes']/1024:.1f} КБ  err={v['err']}  ground_row={ground_row}")
    Image.fromarray((np.clip(band[..., :3], 0, 1) * 255).astype(np.uint8)).save('/tmp/stview_preview.png')


if __name__ == '__main__':
    main()

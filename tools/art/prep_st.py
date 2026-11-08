#!/usr/bin/env python3
"""ST-ART-001: игровые ассеты поверхности над «Гагаринской» из утверждённого рисунка art/ST-ART-001/.

Запуск (Python 3, Pillow, numpy; в CI не нужен):  python3 tools/art/prep_st.py
Результат: art/st/game/*.png + meta.json → node tools/art/pack.mjs st → src/26-st-art.js.

Вариант В (решение Андрея 08.11.2026):
  * левый (на рисунке) вход в метро — закрыт и заброшен: свет погашен, проём заколочен, чёрные «ГАГАРИНСКАЯ» и
    «ОДЕЖДА» на козырьке убраны, вывески («М», красная табличка) погашены и состарены; ставится у прохода во «Дворы»;
  * правый павильон — рабочий вход: на 1-м этаже тёплый освещённый проём, 2-й этаж (разрушенный) не трогается;
  * торцевой дом — 3 подъезда без света, серый панельный, как дом №1 «Дворов»;
  * надписи на длинном доме состарены; вся поверхность приведена к палитре «Дворов» (S1-ART).
Каждое здание выравнивается по СВОЕЙ линии земли на рисунке (не повторять «утопленные» дома S1).
"""
import json, os, sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from prep_s1 import crop_scale, png8, pink_count, unlight   # те же масштабирование, PNG8 и гашение света, что у S1

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'art', 'ST-ART-001', '01-surface-gagarinskaya.png')
S1G = os.path.join(ROOT, 'art', 's1', 'game')
OUT = os.path.join(ROOT, 'art', 'st', 'game')
K_HOUSE = 64 / 70           # этаж длинного дома на рисунке ≈ 70 px → 64 px
K_CLOSED = 0.46             # закрытый павильон: дверь 135 px → 62 px (≈ 2,7 м)
K_OPEN = 0.60               # рабочий павильон: проём 103 px → 62 px
BASE = {'long': 553, 'closed': 576, 'end': 550, 'open': 568}   # линии земли зданий на рисунке


def rgba(a):
    return np.dstack([a, np.ones(a.shape[:2], np.float32)])


def lum(x):
    return x[..., :3] @ np.array([0.30, 0.59, 0.11], np.float32)


def patch_fill(a, dst, src):
    """Залить прямоугольник dst текстурой из прямоугольника src (той же высоты; по ширине — повтором)."""
    x0, y0, x1, y1 = dst; sx0, sy0, sx1, sy1 = src
    tex = a[sy0:sy1, sx0:sx1].copy(); w = sx1 - sx0
    for x in range(x0, x1, w):
        n = min(w, x1 - x); a[y0:y1, x:x + n] = tex[:y1 - y0, :n]


def fade_text(a, box, k=0.55, seed=1):
    """Состарить надпись: приблизить к фону (выцветание), ржавые и облупленные пятна."""
    x0, y0, x1, y1 = box
    sub = a[y0:y1, x0:x1]; bg = np.median(sub.reshape(-1, sub.shape[-1]), axis=0)
    sub[..., :3] = sub[..., :3] * (1 - k) + bg[:3] * k
    rng = np.random.default_rng(seed)
    for _ in range(int((x1 - x0) * (y1 - y0) / 60)):
        cx, cy, r = rng.integers(0, x1 - x0), rng.integers(0, y1 - y0), rng.integers(1, 4)
        ys, xs = slice(max(0, cy - r), cy + r), slice(max(0, cx - r), cx + r)
        if rng.random() < 0.6: sub[ys, xs, :3] = sub[ys, xs, :3] * 0.55 + np.array([0.42, 0.24, 0.14]) * 0.45   # ржавчина
        else: sub[ys, xs, :3] = bg[:3] * 1.05                                                                   # облупилось
    return a


def unlit_sign(a, box, k=0.75):
    """Погасить светящуюся вывеску: убрать свечение (яркость, насыщенность), оставить форму."""
    x0, y0, x1, y1 = box
    sub = a[y0:y1, x0:x1, :3]; l = lum(sub)[..., None]
    sub[...] = np.clip((sub * (1 - k) + l * k) * 0.72, 0, 1)
    return a


def grade(a, ref, exclude=()):
    """Привести к палитре «Дворов»: частичное обесцвечивание + перенос среднего/разброса каналов с домов S1."""
    out = a.copy(); rgb = out[..., :3]; l = lum(rgb)[..., None]
    rgb = l + (rgb - l) * 0.38
    m, s = rgb.reshape(-1, 3).mean(0), rgb.reshape(-1, 3).std(0) + 1e-4
    rgb = (rgb - m) / s * ref[1] + ref[0]
    out[..., :3] = np.clip(rgb, 0, 1)
    for x0, y0, x1, y1 in exclude: out[y0:y1, x0:x1] = a[y0:y1, x0:x1]
    return out


def mask_rects(a, rects):
    m = np.zeros(a.shape[:2], bool)
    for x0, y0, x1, y1 in rects: m[y0:y1, x0:x1] = True
    a[..., 3] = np.where(m, a[..., 3], 0)
    return a


def save(name, arr, meta, extra=None):
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, name + '.png')
    out, back = png8(arr)
    out.save(p, optimize=True, transparency=255)
    err = float(np.abs(back[..., :3] - arr[..., :3])[arr[..., 3] > 0].mean() * 255) if (arr[..., 3] > 0).any() else 0.0
    meta['images'][name] = {'w': int(arr.shape[1]), 'h': int(arr.shape[0]), 'pink': pink_count(back), 'err': round(err, 2), 'bytes': os.path.getsize(p)}
    if extra: meta['images'][name].update(extra)


def main():
    src = np.asarray(Image.open(SRC).convert('RGB')).astype(np.float32) / 255
    a = rgba(src.copy())
    # эталон палитры «Дворов»: дома S1 (среднее и разброс каналов непрозрачных пикселей)
    px = []
    for n in ('houseA', 'houseB'):
        im = np.asarray(Image.open(os.path.join(S1G, n + '.png')).convert('RGBA')).astype(np.float32) / 255
        px.append(im[im[..., 3] > 0][:, :3])
    px = np.concatenate(px); ref = (px.mean(0), px.std(0))

    # --- закрытый павильон (на рисунке слева) ---
    lit_door = a[433:574, 297:366].copy()                                        # тёплый проём — пригодится рабочему входу
    patch_fill(a, (160, 376, 293, 404), (296, 376, 432, 404))                    # убрать чёрную «ГАГАРИНСКАЯ» с козырька
    patch_fill(a, (436, 376, 540, 404), (296, 376, 432, 404))                    # убрать чёрную «ОДЕЖДА»
    patch_fill(a, (297, 433, 371, 574), (372, 433, 446, 574))                    # проём заколочен досками (как соседние ворота)
    for box in [(200, 280, 247, 322), (475, 280, 522, 322), (326, 262, 392, 326)]: unlit_sign(a, box)   # «М» и круг «М» погашены
    unlight(a, 222, 300, 34); unlight(a, 498, 300, 34); unlight(a, 335, 440, 40)                       # ореолы «М» и лампы над проёмом
    fade_text(a, (283, 324, 438, 356), 0.45, 3)                                  # красная «ГАГАРИНСКАЯ» — старая, выцветшая
    fade_text(a, (326, 262, 392, 326), 0.3, 4)
    # --- длинный дом: «ОДЕЖДА» на козырьке витрин — старая ---
    fade_text(a, (1120, 400, 1240, 426), 0.5, 5)
    # --- торцевой дом: 3 подъезда без света ---
    for cx, cy in [(1392, 455), (1441, 451), (1488, 446)]: unlight(a, cx, cy, 16)
    # --- рабочий павильон: на 1-м этаже тёплый проём на месте заколоченного ---
    door = np.asarray(Image.fromarray((lit_door * 255).astype(np.uint8), 'RGBA').resize((62, 104), Image.BOX)).astype(np.float32) / 255
    a[464:568, 1903:1965] = door
    warm = [(1903, 464, 1965, 568)]
    g = grade(a, ref, exclude=warm)

    meta = {'note': 'Сгенерировано tools/art/prep_st.py из art/ST-ART-001 — не править руками', 'scale': {'house': K_HOUSE, 'closed': K_CLOSED, 'open': K_OPEN}, 'images': {}}
    # длинный дом: видимая часть над землёй (≤ 219 px в игре), правее закрытого павильона
    save('long', crop_scale(g, (590, BASE['long'] - 240, 1390, BASE['long']), K_HOUSE), meta)
    # закрытый павильон: только он сам (козырёк, корпус, «М», табличка) — фон дома вырезан
    cp = mask_rects(g.copy(), [(135, 355, 586, 432), (158, 432, 566, BASE['closed']), (200, 280, 247, 360), (475, 280, 522, 360), (283, 324, 438, 356), (326, 262, 392, 326)])
    save('closed', crop_scale(cp, (135, 262, 586, BASE['closed']), K_CLOSED), meta)
    # торцевой дом: боковой фасад с 3 подъездами и глухой торец
    save('endhouse', crop_scale(g, (1394, BASE['end'] - 262, 1712, BASE['end']), K_HOUSE), meta)
    # рабочий павильон: корпус без неба и дерева
    op = mask_rects(g.copy(), [(1712, 285, 2098, BASE['open'])])
    save('open', crop_scale(op, (1712, 262, 2098, BASE['open']), K_OPEN), meta, {'door': [round((1934 - 1712) * K_OPEN), round((568 - 262) * K_OPEN)]})
    # заграждения «М» (бетонные блоки) — у разрывов
    save('barrier', crop_scale(mask_rects(g.copy(), [(1712, 518, 1802, 592)]), (1712, 518, 1802, 592), 0.42), meta)
    meta['totalBytes'] = sum(v['bytes'] for v in meta['images'].values())
    with open(os.path.join(OUT, 'meta.json'), 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    for n, v in meta['images'].items():
        print(f"{n:9s} {v['w']:5d}x{v['h']:<4d} {v['bytes'] / 1024:7.1f} КБ  err={v['err']}")
    print(f"ИТОГО {meta['totalBytes'] / 1024:.0f} КБ PNG")
    # превью исходника после правок (для проверки глазами, не для игры)
    Image.fromarray((np.clip(g[..., :3], 0, 1) * 255).astype(np.uint8)).save('/tmp/st_graded_preview.png')


if __name__ == '__main__':
    main()

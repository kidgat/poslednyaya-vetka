#!/usr/bin/env python3
"""S1-ART: подготовка игровых ассетов улицы S1 «Дворы» из утверждённых исходников art/ART-SURF-001/.

Запуск (нужны Python 3, Pillow, numpy; в CI не нужен):  python3 tools/art/prep_s1.py
Результат: art/s1/game/*.png + art/s1/game/meta.json. Потом: node tools/art/pack.mjs → src/24-s1-art.js.

Исходники не меняются. Для каждого куска:
  1) магента-фон → прозрачность, розовая кайма снимается (альфа из «магентовости», цвет очищается);
  2) уменьшение в игровые пиксели (BOX, с учётом альфы) — без растягивания при отрисовке;
  3) альфа двоичная (пиксель-арт), полупрозрачной розовой каймы не остаётся;
  4) проверка: ни одного видимого пикселя с розовым оттенком (pink = 0 в meta.json).
Масштабы — реальные: Глеб 40 px = 1,75 м (≈ 22,9 px/м), этаж 64 px.
"""
import json, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'art', 'ART-SURF-001')
OUT = os.path.join(ROOT, 'art', 's1', 'game')
FILES = {'sky': '01-sky.png', 'far': '02-far-city.png', 'yard': '03-yard-long-house.png', 'houses': '04-houses-street.png',
         'ground': '05-ground.png', 'garage': '06-garage-closed.png'}
K_HOUSE = 64 / 119          # этаж исходника 119 px (швы панелей 116/235/355/470) → 64 px
PX_M = 40 / 1.75            # игровых px на метр


def keyed(name):
    """RGBA float [0..1] с удалённой магентой и очищенной каймой."""
    a = np.asarray(Image.open(os.path.join(SRC, FILES[name])).convert('RGB')).astype(np.float32) / 255
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    m = np.clip(np.minimum(r, b) - g, 0, 1)                    # «магентовость»: фон ≈ 1, серое/ржавое ≈ 0
    alpha = np.clip(1 - (m - 0.10) / 0.45, 0, 1)                # m ≤ 0.10 — непрозрачно, m ≥ 0.55 — фон
    keep = alpha > 0
    # убрать вклад магенты (1,0,1) из полупрозрачных пикселей: c = (c − (1−α)·M) / α
    for ch, mv in ((0, 1.0), (1, 0.0), (2, 1.0)):
        c = a[..., ch]
        a[..., ch] = np.where(keep, np.clip((c - (1 - alpha) * mv) / np.maximum(alpha, 1e-3), 0, 1), 0)
    # остаточный розовый отлив на краях: подтянуть R и B к G там, где их больше обоих
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    pinkish = (np.minimum(r, b) - g) > 0.03
    lo = np.maximum(g, np.minimum(r, b) - 0.03)
    a[..., 0] = np.where(pinkish, np.minimum(r, lo + (r - np.minimum(r, b))), r)
    a[..., 2] = np.where(pinkish, np.minimum(b, lo + (b - np.minimum(r, b))), b)
    return np.dstack([a[..., :3], alpha])


def crop_scale(arr, box, scale=None, size=None):
    x0, y0, x1, y1 = box
    sub = arr[y0:y1, x0:x1]
    h, w = sub.shape[:2]
    if size is None:
        size = (max(1, round(w * scale)), max(1, round(h * scale)))
    pre = (sub * 255).astype(np.uint8)
    im = Image.fromarray(pre, 'RGBA').convert('RGBa')           # усреднение с учётом альфы (премультипликация)
    im = im.resize(size, Image.BOX).convert('RGBA')
    out = np.asarray(im).astype(np.float32) / 255
    out[..., 3] = (out[..., 3] >= 0.5).astype(np.float32)       # двоичная альфа
    out[..., :3] *= out[..., 3:4]
    return out


def to_img(arr):
    return Image.fromarray((np.clip(arr, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA')


def pink_count(arr):
    r, g, b, al = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
    return int(((al > 0) & (r - g > 0.16) & (b - g > 0.16)).sum())


def png8(arr):
    """PNG8: 255 цветов (octree, без дизеринга) + индекс прозрачности. Средняя ошибка ≤ ~4/255 — на глаз без потерь."""
    im = to_img(arr)
    alpha = np.asarray(im.getchannel('A'))
    q = im.convert('RGB').quantize(255, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    idx = np.asarray(q).copy()
    idx[alpha == 0] = 255
    out = Image.fromarray(idx.astype(np.uint8), 'P')
    pal = q.getpalette()[:765]
    out.putpalette(pal + [0] * (768 - len(pal)))
    back = np.asarray(out.convert('RGBA')).astype(np.float32) / 255
    back[..., 3] = (alpha > 0)
    return out, back


def save(name, arr, meta, extra=None):
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, name + '.png')
    out, back = png8(arr)
    out.save(p, optimize=True, transparency=255)
    err = float(np.abs(back[..., :3] - arr[..., :3])[arr[..., 3] > 0].mean() * 255) if (arr[..., 3] > 0).any() else 0.0
    meta['images'][name] = {'w': int(arr.shape[1]), 'h': int(arr.shape[0]), 'pink': pink_count(back), 'err': round(err, 2), 'bytes': os.path.getsize(p)}
    if extra:
        meta['images'][name].update(extra)


def main():
    meta = {'note': 'Сгенерировано tools/art/prep_s1.py из art/ART-SURF-001 — не править руками', 'scale': {'house': K_HOUSE, 'pxPerM': PX_M}, 'images': {}}
    # --- небо: нижняя (светлая к горизонту) часть облаков, ширина слоя S1 (p 0,06) ---
    sky = keyed('sky')
    s = crop_scale(sky, (0, 0, 1774, 887), size=(1016, 508))
    save('sky', s[508 - 372:], meta)
    # --- дальний город: весь силуэт по ширине слоя (p 0,22): без повторов и швов ---
    far = keyed('far')
    save('far', crop_scale(far, (14, 200, 2034, 490), size=(1592, round(290 * 1592 / 2020))), meta)
    # --- длинный дом за площадкой: верх (дом и кроны) для среднего плана (p 0,5) ---
    yard = keyed('yard')
    save('mid', crop_scale(yard, (16, 150, 2268, 456), 0.57), meta)
    # --- двор целиком (дом, деревья, рабица, ворота, горки, беседка) для заднего плана (p 0,76) ---
    save('yard', crop_scale(yard, (16, 150, 2268, 606), 0.30), meta)
    # --- дома: две пятиэтажки-исходника в масштабе этажа 64 px; ячейки режет игра по meta ---
    hs = keyed('houses')
    k = K_HOUSE
    for nm, (x0, x1) in {'houseA': (504, 1012), 'houseB': (1570, 1992)}.items():
        save(nm, crop_scale(hs, (x0, 40, x1, 640), k), meta, {'origin': [x0, 40]})
    # разметка ячеек в координатах исходника → игровые (масштаб k, начало — origin)
    def R(x0, y0, x1, y1, ox, oy=40):
        return [round((x0 - ox) * k), round((y0 - oy) * k), round((x1 - ox) * k) - round((x0 - ox) * k), round((y1 - oy) * k) - round((y0 - oy) * k)]
    rows = [(116, 235), (235, 355), (355, 470)]
    BASE, ROOF = 628, 46        # S1-ART-ALIGN: земля исходника (низ цоколя, ступеней, колёс) y 628; крыша без кончиков труб — дом влезает в слой
    meta['cells'] = {
        'upper': {   # ячейка = колонка × этаж; тип колонки: balc (с балконами, широкая) / win
            'balc': [{'img': 'houseA', 'r': [R(520, a, 668, b, 504) for a, b in rows]},
                     {'img': 'houseA', 'r': [R(862, a, 997, b, 504) for a, b in rows]},
                     {'img': 'houseB', 'r': [R(1820, a, 1976, b, 1570) for a, b in rows]}],
            'win':  [{'img': 'houseA', 'r': [R(668, a, 763, b, 504) for a, b in rows]},
                     {'img': 'houseA', 'r': [R(763, a, 862, b, 504) for a, b in rows]},
                     {'img': 'houseB', 'r': [R(1584, a, 1700, b, 1570) for a, b in rows]},
                     {'img': 'houseB', 'r': [R(1700, a, 1820, b, 1570) for a, b in rows]}]},
        'ground': {  # первый этаж с цоколем до земли (470–628): окна без скамеек и урн
            'balc': [{'img': 'houseB', 'r': R(1820, 470, 1976, BASE, 1570)}, {'img': 'houseA', 'r': R(520, 470, 645, BASE, 504)}],
            'win':  [{'img': 'houseB', 'r': R(1584, 470, 1700, BASE, 1570)}, {'img': 'houseB', 'r': R(1700, 470, 1820, BASE, 1570)}]},
        'entrance': {'img': 'houseA', 'r': R(645, 440, 800, BASE, 504)},         # козырёк, фонарь, дверь, ступени до тротуара
        'roof': [{'img': 'houseA', 'r': R(520, ROOF, 997, 116, 504)}, {'img': 'houseB', 'r': R(1584, ROOF, 1976, 116, 1570)}],
        # торцы: x-полоса и вертикальные куски [y, h] — крыша, три этажа, первый этаж (в координатах houseA)
        'endL': {'img': 'houseA', 'x': R(506, 0, 520, 1, 504)[0], 'w': R(506, 0, 520, 1, 504)[2], 'segs': [R(0, a, 1, b, 0)[1::2] for a, b in [(ROOF, 116)] + rows + [(470, BASE)]]},
        'endR': {'img': 'houseA', 'x': R(997, 0, 1010, 1, 504)[0], 'w': R(997, 0, 1010, 1, 504)[2], 'segs': [R(0, a, 1, b, 0)[1::2] for a, b in [(ROOF, 116)] + rows + [(470, BASE)]]},
        'walk': {'img': 'houseA', 'r': R(520, BASE, 997, 640, 504)},             # только бордюр и плитка ниже земли
    }
    # --- предметы в реальном масштабе (м → px) ---
    def prop(name, src, box, metres, axis='w', mask=()):
        arr = src
        if mask:                                                   # соседние предметы исходника, попавшие в рамку, — убрать
            arr = src.copy()
            for x0, y0, x1, y1 in mask: arr[y0:y1, x0:x1] = 0
        span = (box[2] - box[0]) if axis == 'w' else (box[3] - box[1])
        save(name, crop_scale(arr, box, metres * PX_M / span), meta)
    prop('car', hs, (1048, 536, 1280, 634), 4.1)               # ВАЗ-2101: 4,1 м
    prop('lamp', hs, (1020, 226, 1116, 630), 8.0, 'h', mask=[(1046, 528, 1116, 630)])         # фонарь 8 м
    prop('pole', hs, (2036, 92, 2140, 634), 9.0, 'h', mask=[(2036, 556, 2049, 634), (2071, 556, 2140, 634)])          # столб 9 м
    prop('tree', hs, (296, 108, 522, 634), 11.0, 'h', mask=[(296, 462, 447, 634)])          # дерево 11 м
    prop('bench', hs, (838, 556, 962, 630), 1.9)               # скамейка 1,9 м (до земли y 628)
    prop('urn', hs, (800, 576, 842, 630), 0.55)
    prop('tires', hs, (1280, 544, 1330, 634), 0.65)
    prop('bags', hs, (1330, 572, 1410, 634), 1.1)
    prop('crate', hs, (2068, 574, 2142, 634), 0.9)
    prop('rubble', hs, (0, 452, 252, 634), 6.0, mask=[(238, 462, 252, 634)])
    garage = keyed('garage')
    prop('garage', garage, (292, 196, 1158, 892), 3.6)          # металлический гараж 3,6 м
    # --- земля: полоса асфальта с лужами (бесшовная по краям за счёт перекрытия в игре) и клочья травы ---
    gr = keyed('ground')
    save('asphalt', crop_scale(gr, (0, 562, 2506, 627), 0.5), meta)
    for i, box in enumerate([(0, 480, 300, 600), (640, 490, 900, 596), (1400, 490, 1760, 596), (2100, 470, 2506, 610)]):
        save(f'clump{i}', crop_scale(gr, box, 0.42), meta)
    bad = {n: v['pink'] for n, v in meta['images'].items() if v['pink']}
    meta['totalBytes'] = sum(v['bytes'] for v in meta['images'].values())
    with open(os.path.join(OUT, 'meta.json'), 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    for n, v in meta['images'].items():
        print(f"{n:9s} {v['w']:5d}x{v['h']:<4d} {v['bytes'] / 1024:7.1f} КБ  pink={v['pink']}")
    print(f"ИТОГО {meta['totalBytes'] / 1024:.0f} КБ PNG")
    if bad:
        print('FAIL  розовые пиксели:', bad); sys.exit(1)


if __name__ == '__main__':
    main()

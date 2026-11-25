#!/usr/bin/env python3
"""DIGITAL FLOW — шаблон «Страница дневника» (1080x1350).
Запуск: python3 diary_page.py page.json out.jpg
page.json: {"day": "ДЕНЬ 3", "title": ["Агент перепутал", "мою фамилию"],
            "body": ["строка", "", "строка"], "sticker": ["Урок дня:", "проверяй имена"],
            "footer": "Дневник ИИ-студии · DIGITAL FLOW"}
Шрифты: DejaVu Serif (заголовок/текст), Inter (метки). Цвета: бумага #F4ECDE, чернила #28221E, стикер #C8FF2E.
"""
import json, sys, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

def find(paths):
    import os
    for p in paths:
        if os.path.exists(p): return p
    raise SystemExit('font not found: ' + paths[0])

SERIF = find(['/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf'])
SERIF_B = find(['/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'])
INTER = '/usr/share/fonts/opentype/inter/Inter-'
def inter(w, s):
    try: return ImageFont.truetype(INTER + w + '.otf', s)
    except OSError: return ImageFont.truetype(SERIF_B if w in ('Bold', 'SemiBold') else SERIF, s)

def render(page, out):
    W, H = 1080, 1350
    random.seed(3)
    im = Image.new('RGB', (W, H), (244, 236, 222)); d = ImageDraw.Draw(im)
    for _ in range(60000):
        x, y = random.randrange(W), random.randrange(H); c = random.randint(228, 246)
        d.point((x, y), fill=(c, c - 8, c - 22))
    im = im.filter(ImageFilter.GaussianBlur(0.6)); d = ImageDraw.Draw(im)
    ink = (40, 34, 30); L = 180; STEP = 64
    d.line([(150, 0), (150, H)], fill=(226, 160, 150), width=2)
    d.text((L, 120), page.get('day', ''), font=inter('Bold', 34), fill=(150, 120, 90))
    tf = ImageFont.truetype(SERIF_B, 70); y = 175
    for ln in page.get('title', []):
        d.text((L, y), ln, font=tf, fill=ink); y += 85
    # тетрадные линии, текст стоит НА линии
    first = y + 70
    bf = ImageFont.truetype(SERIF, 44)
    asc = bf.getmetrics()[0]
    yy = first
    while yy < H - 140:
        d.line([(90, yy), (W - 90, yy)], fill=(214, 200, 178), width=2); yy += STEP
    yy = first
    for ln in page.get('body', []):
        if ln: d.text((L, yy - asc + 2), ln, font=bf, fill=ink)
        yy += STEP
    st = page.get('sticker')
    if st:
        note = Image.new('RGBA', (340, 40 + 42 * len(st)), (200, 255, 46, 240)); nd = ImageDraw.Draw(note)
        for i, s in enumerate(st):
            nd.text((24, 20 + 42 * i), s, font=inter('Bold' if i == 0 else 'SemiBold', 30), fill=(20, 20, 20))
        note = note.rotate(4, expand=True, resample=Image.BICUBIC)
        im.paste(note, (W - 90 - note.width, max(yy + 10, H - 330)), note)
    d.text((L, H - 110), page.get('footer', 'Дневник ИИ-студии · DIGITAL FLOW'), font=inter('Medium', 28), fill=(120, 100, 80))
    im.save(out, quality=90)

if __name__ == '__main__':
    render(json.load(open(sys.argv[1], encoding='utf-8')), sys.argv[2])

"""Render an animated, code-drawn preview of the same model (no browser needed)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json
import math

ROOT = Path(__file__).resolve().parents[1]
SCALE = 2
W, H, TOP, BOTTOM = 693, 649, 55, 36
geometry = json.loads((ROOT / 'map_geometry.json').read_text(encoding='utf-8'))
routes = json.loads((ROOT / 'verificacion' / 'routes.json').read_text(encoding='utf-8'))
frames = json.loads((ROOT / 'verificacion' / 'animation-frames.json').read_text(encoding='utf-8'))


def font(size, bold=False):
    filename = 'segoeuib.ttf' if bold else 'segoeui.ttf'
    return ImageFont.truetype(str(Path('C:/Windows/Fonts') / filename), round(size * SCALE))


def path_points(path):
    for subpath in path.split('M')[1:]:
        points = [tuple(map(float, pt.strip().split(','))) for pt in subpath.replace('Z', '').split('L')]
        yield points


def points_scaled(points):
    return [(round(x * SCALE), round((y + TOP) * SCALE)) for x, y in points]


base = Image.new('RGB', (W * SCALE, (H + TOP + BOTTOM) * SCALE), '#f7f7f0')
draw = ImageDraw.Draw(base)
draw.rectangle((0, TOP*SCALE, W*SCALE, (H+TOP)*SCALE), fill='#f0f1e8')
for key, color, outline in [('buildings', '#dfe2d8', '#d2d7ca'), ('landmarks', '#e7e5d4', '#d9d5bc')]:
    for points in path_points(geometry[key]):
        draw.polygon(points_scaled(points), fill=color, outline=outline, width=1)
for ring in geometry['roadRings']:
    draw.polygon(points_scaled(ring['points']), fill='#53616a' if ring['area'] > 0 else '#f0f1e8', outline='#dce0d1', width=2)

# Dashed routes show connectivity without claiming surveyed lane markings.
for route in routes:
    points = route['points']
    last_d = -100
    for p in points:
        if p['d'] - last_d < 10:
            continue
        last_d = p['d']
        x, y = p['x'], p['y']
        if not (0 <= x <= W and 0 <= y <= H):
            continue
        index = min(range(len(points)), key=lambda i: abs(points[i]['d'] - (p['d'] + 4)))
        q = points[index]
        draw.line(points_scaled([(x, y), (q['x'], q['y'])]), fill=route['color'], width=2)


def road_label(text, x, y, angle, size=12):
    label_font = font(size, True)
    box = label_font.getbbox(text)
    tile = Image.new('RGBA', (box[2]+16*SCALE, (size+12)*SCALE))
    td = ImageDraw.Draw(tile)
    td.text((6*SCALE, 2*SCALE), text, font=label_font, fill='#f3f3e7', stroke_width=2*SCALE, stroke_fill='#53616a')
    # The local text baseline is placed around the specified source coordinate.
    tile = tile.rotate(-angle, expand=True, resample=Image.Resampling.BICUBIC)
    if angle < 0:
        y -= tile.height / SCALE - size
    base.paste(tile, (round((x-6)*SCALE), round((y+TOP-7)*SCALE)), tile)


road_label('Diagonal Santander', 261, 302, 45)
road_label('La Gran Colombia', 348, 226, -55)
road_label('Calle 9', 83, 272, -11)
road_label('Calle 9a', 152, 412, -28)
road_label('Calle 10', 248, 433, -66)
road_label('Calle 10', 437, 408, 22)
draw = ImageDraw.Draw(base)
draw.text((18*SCALE, 13*SCALE), 'Así entiendo las calles.', fill='#233e3b', font=font(21, True))
draw.text((529*SCALE, 20*SCALE), 'VISTA 2D · MAPS', fill='#62796a', font=font(10, True))
draw.text((17*SCALE, (TOP+H+10)*SCALE), 'S1 → S2 + S3 → S4 → S5 → S1 · vista previa acelerada 4×', fill='#697b74', font=font(11))
draw.text((403*SCALE, (TOP+566)*SCALE), 'CENTRO COMERCIAL', fill='#7c8e7e', font=font(9))
draw.text((427*SCALE, (TOP+580)*SCALE), 'VENTURA PLAZA', fill='#7c8e7e', font=font(9))
for num, x, y in [(1, 155, 149), (2, 470, 109), (3, 32, 259), (4, 96, 417), (5, 180, 539)]:
    box = ((x-10)*SCALE, (y+TOP-10)*SCALE, (x+10)*SCALE, (y+TOP+10)*SCALE)
    draw.ellipse(box, fill='#f9fbf3', outline='#345a50', width=2)
    draw.text((x*SCALE, (y+TOP)*SCALE), str(num), font=font(10, True), fill='#345a50', anchor='mm')


def car_image(color, angle):
    tile = Image.new('RGBA', (22*SCALE, 14*SCALE))
    td = ImageDraw.Draw(tile)
    td.rounded_rectangle((3*SCALE, 3*SCALE, 19*SCALE, 11*SCALE), radius=2*SCALE, fill=color, outline='#203a37', width=1)
    td.rounded_rectangle((8*SCALE, 4*SCALE, 14*SCALE, 10*SCALE), radius=SCALE, fill='#234743')
    td.polygon([(14*SCALE,4*SCALE),(16*SCALE,5*SCALE),(16*SCALE,9*SCALE),(14*SCALE,10*SCALE)],fill='#d3e9dc')
    td.line([(18*SCALE,4*SCALE),(18*SCALE,6*SCALE)],fill='#fff4cd',width=2)
    td.line([(18*SCALE,8*SCALE),(18*SCALE,10*SCALE)],fill='#fff4cd',width=2)
    return tile.rotate(-math.degrees(angle), expand=True, resample=Image.Resampling.BICUBIC)


rendered = []
for frame in frames:
    im = base.copy()
    # Composite inside a separate clipped map layer, matching SVG viewport clipping.
    map_layer = im.crop((0, TOP*SCALE, W*SCALE, (TOP+H)*SCALE)).convert('RGBA')
    for car in frame['cars']:
        tile = car_image(car['color'], car['angle'])
        map_layer.alpha_composite(tile, (round(car['x']*SCALE-tile.width/2), round(car['y']*SCALE-tile.height/2)))
    md=ImageDraw.Draw(map_layer)
    for signal in frame['signals']:
        x,y=signal['x'],signal['y']
        hx,hy=x+signal['head'][0],y+signal['head'][1]
        lx,ly=x+signal['label'][0],y+signal['label'][1]
        md.line([(x*SCALE,y*SCALE),(hx*SCALE,(hy+13)*SCALE)],fill='#263e37',width=2*SCALE)
        md.ellipse(((x-2.5)*SCALE,(y-2.5)*SCALE,(x+2.5)*SCALE,(y+2.5)*SCALE),fill='#f5f3df',outline='#263e37',width=SCALE)
        md.rounded_rectangle(((hx-5.5)*SCALE,(hy-13)*SCALE,(hx+5.5)*SCALE,(hy+13)*SCALE),radius=3*SCALE,fill='#233830',outline='#f6f2da',width=SCALE)
        for index,phase in enumerate(['red','yellow','green']):
            cy=hy-8+index*8
            md.ellipse(((hx-3)*SCALE,(cy-3)*SCALE,(hx+3)*SCALE,(cy+3)*SCALE),fill=signal['color'] if signal['phase']==phase else '#42544a')
        md.line([(hx*SCALE,(hy-8)*SCALE),(lx*SCALE,ly*SCALE)],fill='#334c40',width=SCALE)
        md.rounded_rectangle(((lx-13)*SCALE,(ly-8)*SCALE,(lx+13)*SCALE,(ly+8)*SCALE),radius=4*SCALE,fill='#254c40',outline='#f6f2da',width=SCALE)
        md.text((lx*SCALE,ly*SCALE),signal['id'],font=font(10,True),fill='white',anchor='mm')
    im.paste(map_layer.convert('RGB'), (0,TOP*SCALE))
    rendered.append(im.resize((W, TOP+H+BOTTOM), Image.Resampling.LANCZOS))

rendered[0].save(ROOT / 'vista_calles_2d.png')
# One shared palette avoids flickering colors between frames.
palette = rendered[0].quantize(colors=128, method=Image.Quantize.MEDIANCUT)
gif_frames = [im.quantize(palette=palette, dither=Image.Dither.NONE) for im in rendered]
gif_frames[0].save(ROOT / 'vista_calles_2d.gif', save_all=True, append_images=gif_frames[1:], duration=100, loop=0, optimize=True, disposal=1)
print(f'Created PNG + animated GIF, {len(rendered)} frames.')

"""Extract editable street outlines from the supplied map, without geocoding."""
from collections import defaultdict, deque
from pathlib import Path
import json
import math

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]


def largest_component(mask):
    visited = np.zeros_like(mask, dtype=bool)
    largest = []
    h, w = mask.shape
    for y, x in zip(*np.nonzero(mask)):
        if visited[y, x]:
            continue
        visited[y, x] = True
        queue = deque([(int(x), int(y))])
        component = []
        while queue:
            px, py = queue.popleft()
            component.append((px, py))
            for nx, ny in ((px - 1, py), (px + 1, py), (px, py - 1), (px, py + 1)):
                if 0 <= nx < w and 0 <= ny < h and mask[ny, nx] and not visited[ny, nx]:
                    visited[ny, nx] = True
                    queue.append((nx, ny))
        if len(component) > len(largest):
            largest = component
    result = np.zeros_like(mask, dtype=bool)
    for x, y in largest:
        result[y, x] = True
    return result


def signed_area(points):
    return sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(points, points[1:] + points[:1])) / 2


def simplify(points, tolerance=1.8):
    if len(points) < 3:
        return points
    a, b = points[0], points[-1]
    dx, dy = b[0] - a[0], b[1] - a[1]
    den = math.hypot(dx, dy)
    distances = [abs(dy * (p[0] - a[0]) - dx * (p[1] - a[1])) / den if den else math.dist(p, a) for p in points]
    index = max(range(len(points)), key=distances.__getitem__)
    if distances[index] <= tolerance:
        return [a, b]
    return simplify(points[:index + 1], tolerance)[:-1] + simplify(points[index:], tolerance)


def contours(mask, min_area):
    h, w = mask.shape
    edges = defaultdict(list)
    for y, x in zip(*np.nonzero(mask)):
        x, y = int(x), int(y)
        if y == 0 or not mask[y - 1, x]:
            edges[(x, y)].append((x + 1, y))
        if x == w - 1 or not mask[y, x + 1]:
            edges[(x + 1, y)].append((x + 1, y + 1))
        if y == h - 1 or not mask[y + 1, x]:
            edges[(x + 1, y + 1)].append((x, y + 1))
        if x == 0 or not mask[y, x - 1]:
            edges[(x, y + 1)].append((x, y))
    loops = []
    while edges:
        start = next(iter(edges))
        point = start
        loop = [point]
        while True:
            next_point = edges[point].pop()
            if not edges[point]:
                del edges[point]
            point = next_point
            loop.append(point)
            if point == start:
                break
        area = signed_area(loop)
        if abs(area) >= min_area:
            # Split the closed ring in two so RDP has distinct endpoints.
            mid = len(loop) // 2
            clean = simplify(loop[:mid + 1])[:-1] + simplify(loop[mid:])[:-1]
            loops.append({'area': round(area), 'points': clean})
    return sorted(loops, key=lambda loop: abs(loop['area']), reverse=True)


def svg_path(loops):
    return ' '.join('M' + ' L'.join(f'{x},{y}' for x, y in loop['points']) + ' Z' for loop in loops)


def main():
    im = Image.open(ROOT / 'referncia_googlemaps.png').convert('RGB')
    pixels = np.asarray(im).astype(int)
    road_mask = np.max(np.abs(pixels - [170, 185, 200]), axis=2) < 5
    # The enclosed land islands exceed 1,100 px. Smaller holes are map text,
    # direction arrows and antialiasing, and must not become holes in the road.
    road = contours(largest_component(road_mask), min_area=1100)
    # Remove the route-70 shields touching the image edge from the street outline.
    outer = road[0]['points']
    cleaned = []
    for x, y in outer:
        if x < 19 and 100 < y < 139 and (x, y) != (0, 138):
            continue
        if x < 40 and y > 625:
            continue
        cleaned.append((x, y))
        if (x, y) == (122, 590):
            cleaned.extend([(33, 649), (0, 649)])
    road[0]['points'] = cleaned
    buildings = contours(np.max(np.abs(pixels - [231, 232, 235]), axis=2) < 4, min_area=100)
    landmarks = contours(np.max(np.abs(pixels - [252, 249, 239]), axis=2) < 4, min_area=150)
    geometry = {
        'width': im.width, 'height': im.height,
        'road': svg_path(road), 'buildings': svg_path(buildings), 'landmarks': svg_path(landmarks),
        'roadRings': road,
    }
    (ROOT / 'map_geometry.json').write_text(json.dumps(geometry, ensure_ascii=False), encoding='utf-8')
    preview = Image.new('RGB', im.size, '#f1f1e9')
    draw = ImageDraw.Draw(preview)
    for loops, color in ((buildings, '#dedfd7'), (landmarks, '#e7e5d5')):
        for loop in loops:
            draw.polygon(loop['points'], fill=color)
    for loop in road:
        draw.polygon(loop['points'], fill='#53616a' if loop['area'] > 0 else '#f1f1e9')
    (ROOT / 'verificacion').mkdir(exist_ok=True)
    preview.save(ROOT / 'verificacion' / 'geometria.png')
    print(json.dumps({'road_rings': [{'area': ring['area'], 'points': ring['points']} for ring in road]}, ensure_ascii=False))


if __name__ == '__main__':
    main()

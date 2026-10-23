"""Package the map geometry and its original reference into one offline HTML."""
import base64
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
geometry = json.loads((ROOT / 'map_geometry.json').read_text(encoding='utf-8'))
template = (ROOT / 'tools' / 'simulation.template.html').read_text(encoding='utf-8')
source = base64.b64encode((ROOT / 'referncia_googlemaps.png').read_bytes()).decode('ascii')
for key in ('road', 'buildings', 'landmarks'):
    template = template.replace('{{' + key.upper() + '}}', geometry[key])
template = template.replace('{{REFERENCE}}', source)
template = template.replace('{{SIMULATION}}', (ROOT / 'tools' / 'simulation.js').read_text(encoding='utf-8'))
(ROOT / 'calles_2d.html').write_text(template, encoding='utf-8')
print('Created calles_2d.html (offline, no dependencies).')

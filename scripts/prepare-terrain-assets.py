"""Package the three credited Wildfire Games terrain textures (Pillow required)."""
import hashlib
import json
import argparse
from pathlib import Path
from urllib.request import urlopen
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / '.art-source' / 'terrain0ad'
OUT = ROOT / 'public' / 'art' / 'terrain0ad'
SOURCE.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--revision', help='Explicit official mirror commit; defaults to the packaged manifest revision')
args = parser.parse_args()
manifest = OUT / 'manifest.json'
REVISION = args.revision or (json.loads(manifest.read_text(encoding='utf-8'))['revision'] if manifest.exists() else json.loads(urlopen('https://api.github.com/repos/0ad/0ad/commits/master').read())['sha'])
BASE = f'https://raw.githubusercontent.com/0ad/0ad/{REVISION}/binaries/data/mods/public/art/'
NAMES = {'temp_grass_mod_02.png': 'grass.jpg', 'temp_dirt_gravel_b.png': 'dirt.jpg', 'temp_cliff_c.png': 'cliff.jpg'}
entries = []
for original, packed in NAMES.items():
    url = BASE + 'textures/terrain/types/' + original
    source = SOURCE / original
    source.write_bytes(urlopen(url).read())
    target = OUT / packed
    Image.open(source).convert('RGB').resize((512, 512), Image.Resampling.LANCZOS).save(target, quality=88)
    entries.append({'file': packed, 'source': url, 'original': original,
                    'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                    'packedSha256': hashlib.sha256(target.read_bytes()).hexdigest(),
                    'modifications': 'RGB conversion, resized to 512 x 512, JPEG quality 88',
                    'license': 'CC BY-SA 3.0', 'author': 'Wildfire Games'})
(OUT / 'LICENSE.txt').write_bytes(urlopen(BASE + 'LICENSE.txt').read())
(OUT / 'manifest.json').write_text(json.dumps({'revision': REVISION, 'assets': entries}, indent=2) + '\n', encoding='utf-8')
(OUT / 'CREDITS.txt').write_text('Terrain texture artwork by Wildfire Games: https://www.wildfiregames.com/\n'
    'Source project: https://gitea.wildfiregames.com/0ad/0ad\n'
    'Originals and these resized JPEG derivatives are licensed under Creative Commons Attribution-ShareAlike 3.0:\n'
    'https://creativecommons.org/licenses/by-sa/3.0/\n'
    'See LICENSE.txt and manifest.json for original files, modifications and source revision.\n', encoding='utf-8')
print(f'Packaged {len(entries)} terrain textures at revision {REVISION}')

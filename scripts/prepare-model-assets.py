"""Bundle selected CC0 Hearthguard/Quaternius sources; no runtime network service.

python scripts/prepare-model-assets.py [--source ../hearthguard] [--fetch-animals]
The optional fetch reads three public glTFs from Quaternius's original Drive
distribution, falling back to the CC0 archive mirror if its quota is exhausted.
Existing animal GLBs are retained when that flag is omitted. Pillow is required
to resize texture images to the 512px RTS texture budget.
"""
from pathlib import Path
import argparse, base64, copy, hashlib, json, shutil, struct, urllib.parse, urllib.request

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/models'
ANIMALS = {
    'cow': '1lS3t1Sof0FVne1C1WXfdX48qaHES_pDG',
    'alpaca': '13dxCPosR1tVx24LKXr6gN44sIOY4hZgo',
    'fox': '1z-CWoUC2vJxrqgGFTYlMaywpE1ooV-bA',
}


def serialize(data, binary, destination):
    data['buffers'] = [{'byteLength': len(binary)}]
    data['asset']['generator'] = 'Ironvale selected CC0 source packaging'
    encoded = json.dumps(data, separators=(',', ':')).encode('utf-8')
    encoded += b' ' * (-len(encoded) % 4)
    binary += b'\0' * (-len(binary) % 4)
    destination.write_bytes(struct.pack('<III', 0x46546c67, 2, 28 + len(encoded) + len(binary))
                           + struct.pack('<II', len(encoded), 0x4e4f534a) + encoded
                           + struct.pack('<II', len(binary), 0x004e4942) + binary)


def compact(data, binary, destination, clips=None, animations_only=False):
    data = copy.deepcopy(data)
    if clips is not None:
        data['animations'] = [a for a in data.get('animations', []) if a.get('name') in clips]
    if animations_only:
        for node in data['nodes']:
            node.pop('mesh', None)
            node.pop('skin', None)
        for key in ['meshes', 'skins', 'materials', 'images', 'textures', 'samplers']:
            data.pop(key, None)
    used = set()
    def use(i):
        used.add(i)
        return i
    for mesh in data.get('meshes', []):
        for primitive in mesh['primitives']:
            for index in primitive['attributes'].values(): use(index)
            if 'indices' in primitive: use(primitive['indices'])
            for target in primitive.get('targets', []):
                for index in target.values(): use(index)
    for skin in data.get('skins', []):
        if 'inverseBindMatrices' in skin: use(skin['inverseBindMatrices'])
    for animation in data.get('animations', []):
        for sampler in animation['samplers']:
            use(sampler['input']); use(sampler['output'])
    accessor_map = {old: new for new, old in enumerate(sorted(used))}
    accessors = [data['accessors'][i] for i in sorted(used)]
    for mesh in data.get('meshes', []):
        for primitive in mesh['primitives']:
            primitive['attributes'] = {k: accessor_map[i] for k, i in primitive['attributes'].items()}
            if 'indices' in primitive: primitive['indices'] = accessor_map[primitive['indices']]
            for target in primitive.get('targets', []):
                for key in target: target[key] = accessor_map[target[key]]
    for skin in data.get('skins', []):
        if 'inverseBindMatrices' in skin: skin['inverseBindMatrices'] = accessor_map[skin['inverseBindMatrices']]
    for animation in data.get('animations', []):
        for sampler in animation['samplers']:
            sampler['input'] = accessor_map[sampler['input']]
            sampler['output'] = accessor_map[sampler['output']]
    views = sorted({a['bufferView'] for a in accessors})
    view_map, packed, new_views = {}, bytearray(), []
    for i in views:
        view = data['bufferViews'][i]
        packed.extend(b'\0' * (-len(packed) % 4))
        offset = len(packed)
        packed.extend(binary[view.get('byteOffset', 0):view.get('byteOffset', 0) + view['byteLength']])
        view_map[i] = len(new_views)
        new_views.append({**view, 'buffer': 0, 'byteOffset': offset})
    for accessor in accessors: accessor['bufferView'] = view_map[accessor['bufferView']]
    data['accessors'], data['bufferViews'] = accessors, new_views
    serialize(data, bytes(packed), destination)
    return data


def read_glb(path):
    raw = path.read_bytes()
    length = struct.unpack_from('<I', raw, 12)[0]
    return json.loads(raw[20:20 + length]), raw[28 + length:]


def raw_uri(uri):
    if not uri.startswith('data:'):
        raise ValueError(f'Expected embedded Quaternius source buffer, received {uri}')
    return base64.b64decode(uri.split(',', 1)[1])


def fetch(file_id, mirror_name=None):
    request = urllib.request.Request(f'https://drive.google.com/uc?export=download&id={file_id}', headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(request, timeout=60) as response:
        raw = response.read()
    if raw.lstrip().startswith(b'<!DOCTYPE html>') and mirror_name:
        # Author's public Drive returned "Quota exceeded" on 2026-10-15.
        mirror_path = 'Ultimate Animated Animals - July 2021/' + ('License.txt' if mirror_name == 'License.txt' else f'glTF/{mirror_name}.gltf')
        mirror = 'https://raw.githubusercontent.com/agentkaerf/FreeModels/main/' + urllib.parse.quote(mirror_path)
        with urllib.request.urlopen(mirror, timeout=60) as response: raw = response.read()
    if raw.lstrip().startswith(b'<!DOCTYPE html>'): raise ValueError('Quaternius download returned HTML instead of an asset')
    return raw


def main():
    parser = argparse.ArgumentParser(__doc__)
    parser.add_argument('--source', type=Path, default=ROOT.parent / 'hearthguard')
    parser.add_argument('--fetch-animals', action='store_true')
    args = parser.parse_args()
    source = args.source / 'public/models'
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'textures').mkdir(exist_ok=True)
    records = []
    for name in ['character', 'ranger', 'head', 'hair', 'animations', 'actions', 'deer', 'horse']:
        data, binary = read_glb(source / f'{name}.glb')
        clips = {'Idle_Loop', 'Walk_Loop', 'Sword_Attack'} if name == 'animations' else {'TreeChopping_Loop'} if name == 'actions' else {'Idle', 'Walk', 'Gallop', 'Eating'} if name in ['deer', 'horse'] else None
        packed = compact(data, binary, OUT / f'{name}.glb', clips, name in ['animations', 'actions'])
        for image in packed.get('images', []):
            shutil.copy2(source / image['uri'], OUT / image['uri'])
        records.append({'file': f'{name}.glb', 'source': f'hearthguard/public/models/{name}.glb'})
    if args.fetch_animals:
        for name, file_id in ANIMALS.items():
            raw = fetch(file_id, name.title())
            data = json.loads(raw)
            binary = bytearray()
            offsets = []
            for buffer in data['buffers']:
                binary.extend(b'\0' * (-len(binary) % 4)); offsets.append(len(binary)); binary.extend(raw_uri(buffer['uri']))
            for view in data['bufferViews']:
                view['byteOffset'] = view.get('byteOffset', 0) + offsets[view.get('buffer', 0)]; view['buffer'] = 0
            compact(data, bytes(binary), OUT / f'{name}.glb', {'Idle', 'Walk', 'Gallop', 'Eating'})
        (OUT / 'animals-license.txt').write_bytes(fetch('1F2uy8T2fRpdc6gZ4mnS02_C2E63WvKtn', 'License.txt'))
    for name, file_id in ANIMALS.items():
        if not (OUT / f'{name}.glb').exists(): raise FileNotFoundError(f'{name}.glb missing: rerun with --fetch-animals')
        records.append({'file': f'{name}.glb', 'source': f'https://drive.google.com/file/d/{file_id}/view', 'downloadMirror': 'https://github.com/agentkaerf/FreeModels/tree/main/Ultimate%20Animated%20Animals%20-%20July%202021'})
    for name in ['base', 'outfits', 'animations', 'animations2']:
        shutil.copy2(source / f'{name}-license.txt', OUT / f'{name}-license.txt')
    (OUT / 'materials').mkdir(exist_ok=True)
    for path in (source / 'materials').iterdir(): shutil.copy2(path, OUT / 'materials' / path.name)
    from PIL import Image
    for directory in ['textures', 'materials']:
        for path in (OUT / directory).iterdir():
            if path.suffix.lower() not in ['.png', '.jpg', '.jpeg']: continue
            with Image.open(path) as image:
                if max(image.size) > 512:
                    image.thumbnail((512, 512), Image.Resampling.LANCZOS)
                    image.save(path, optimize=True, **({'quality': 88} if path.suffix.lower() in ['.jpg', '.jpeg'] else {}))
    for record in records:
        path = OUT / record['file']
        record.update(bytes=path.stat().st_size, sha256=hashlib.sha256(path.read_bytes()).hexdigest())
    (OUT / 'manifest.json').write_text(json.dumps({'license': 'CC0-1.0', 'assets': records}, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps({'models': len(records), 'totalBytes': sum(p.stat().st_size for p in OUT.rglob('*') if p.is_file())}))


if __name__ == '__main__':
    main()

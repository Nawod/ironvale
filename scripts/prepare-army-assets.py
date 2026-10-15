"""Derive Ironvale-only actor data from the officially downloaded FREE 100 GLB set.

Usage: python scripts/prepare-army-assets.py path/to/AshenMarches_Free100_GLB
Requires Pillow. No download or purchase is performed. The source archive is private
project input; only the seven used characters and five used equipment pieces ship.
Palette colors become vertex colors. Authored cloth islands become a separate city
material; skin, leather, trim and metal retain their original colors and roughness.
"""
import io
import json
import struct
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(sys.argv[1])
DEST = ROOT / 'public/models/ashen'
ACTORS = {
    'guard': ('gth_huma_march_guard', {(5, 6), (1, 2)}),
    'marshal': ('nth_huma_castle_marshal', {(1, 5), (2, 5), (0, 2)}),
    'ranger': ('nth_huma_ranger', {(0, 5), (1, 5), (2, 5), (1, 2)}),
    'executioner': ('dun_huma_royal_executioner', {(0, 0), (1, 0), (0, 2)}),
    'apothecary': ('dun_huma_apothecary', {(5, 2), (5, 5), (6, 5), (7, 5), (0, 2)}),
    'falconer': ('dun_huma_falconer', {(5, 5), (6, 5), (7, 5), (1, 2)}),
    'alchemist': ('nth_huma_alchemist', {(5, 3), (5, 5), (7, 0), (0, 0)}),
}
EQUIPMENT = {'sword': 'gth_equi_arming_sword', 'shield': 'gth_equi_heater_shield',
             'kite': 'gth_equi_kite_shield', 'pike': 'nth_equi_pike', 'helm': 'dun_equi_great_helm'}
COMPONENTS = {5126: ('f', 4), 5125: ('I', 4), 5123: ('H', 2), 5121: ('B', 1)}
WIDTHS = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def prepare(name, source_id, category, cloth_cells):
    raw = (SOURCE / 'GLB' / category / (source_id + '.glb')).read_bytes()
    length = struct.unpack_from('<I', raw, 12)[0]
    gltf = json.loads(raw[20:20 + length])
    data = bytearray(raw[28 + length:])
    image_view = gltf['bufferViews'][gltf['images'][0]['bufferView']]
    start = image_view.get('byteOffset', 0)
    image = Image.open(io.BytesIO(data[start:start + image_view['byteLength']]))
    source_materials = gltf['materials']
    gltf['materials'] = []
    material_indices = {}

    def values(index):
        a = gltf['accessors'][index]
        view = gltf['bufferViews'][a['bufferView']]
        fmt, size = COMPONENTS[a['componentType']]
        width = WIDTHS[a['type']]
        offset = view.get('byteOffset', 0) + a.get('byteOffset', 0)
        stride = view.get('byteStride', width * size)
        return [struct.unpack_from('<' + fmt * width, data, offset + i * stride) for i in range(a['count'])]

    def append(values, component, width):
        while len(data) % 4:
            data.append(0)
        start = len(data)
        fmt, _ = COMPONENTS[component]
        for value in values:
            data.extend(struct.pack('<' + fmt * width, *value))
        view = len(gltf['bufferViews'])
        gltf['bufferViews'].append({'buffer': 0, 'byteOffset': start, 'byteLength': len(data) - start})
        accessor = len(gltf['accessors'])
        gltf['accessors'].append({'bufferView': view, 'componentType': component, 'count': len(values),
                                  'type': {1: 'SCALAR', 4: 'VEC4'}[width]})
        return accessor

    def material(role):
        if role not in material_indices:
            material_indices[role] = len(gltf['materials'])
            gltf['materials'].append({'name': role, 'doubleSided': True,
                'pbrMetallicRoughness': {'roughnessFactor': .48 if role == 'Metal' else .9,
                                       'metallicFactor': .65 if role == 'Metal' else 0}})
        return material_indices[role]

    def linear(value):
        value /= 255
        return value / 12.92 if value <= .04045 else ((value + .055) / 1.055) ** 2.4

    for mesh in gltf['meshes']:
        result = []
        for primitive in mesh['primitives']:
            original = source_materials[primitive['material']]
            uvs = values(primitive['attributes']['TEXCOORD_0'])
            colors, roles = [], []
            for u, v in uvs:
                cell = (min(7, int(u * 8)), min(7, int(v * 8)))
                metal = original['name'] == 'AM_Metal'
                # The original face/hand palette islands are never city-colored.
                skin = category == 'Characters' and cell[1] == 4 and cell[0] >= 4
                clothing = category == 'Characters' and not metal and not skin and cell in cloth_cells and mesh['name'] != 'Boot cuff'
                role = 'Metal' if metal else 'Skin' if skin else 'City cloth' if clothing else 'Leather and trim'
                if category == 'Equipment' and name in ('shield', 'kite') and not metal:
                    role = 'City cloth'
                rgba = image.getpixel((min(255, int(u * 256)), min(255, int(v * 256))))
                # Neutral light fabric keeps every saturated city equally readable.
                if name == 'helm' and role == 'Metal':
                    rgba = (105, 124, 143, 255)
                colors.append((.78, .78, .78, 1) if role == 'City cloth' else (*map(linear, rgba[:3]), 1))
                roles.append(role)
            color_index = append(colors, 5126, 4)
            indices = [a[0] for a in values(primitive['indices'])]
            split = {}
            for i in range(0, len(indices), 3):
                triangle = indices[i:i + 3]
                role = roles[triangle[0]]
                split.setdefault(role, []).extend((index,) for index in triangle)
            for role, triangles in split.items():
                result.append({**primitive, 'indices': append(triangles, 5125, 1),
                    'material': material(role), 'attributes': {**primitive['attributes'], 'COLOR_0': color_index}})
        mesh['primitives'] = result
    # Embedded original image bytes remain unused within the private game GLB buffer.
    # No reusable palette image or complete sampler archive is published.
    for key in ('images', 'textures', 'samplers'):
        gltf.pop(key, None)
    gltf['asset']['copyright'] = 'ChillLands Ashen Marches; modified for Ironvale. See AshenMarches_LICENSE.txt.'
    gltf['asset']['extras'] = {'project': 'Ironvale', 'sourceAsset': source_id, 'derived': 'vertex colors and city cloth material islands'}
    while len(data) % 4:
        data.append(0)
    gltf['buffers'] = [{'byteLength': len(data)}]
    encoded = json.dumps(gltf, separators=(',', ':')).encode()
    encoded += b' ' * (-len(encoded) % 4)
    total = 12 + 8 + len(encoded) + 8 + len(data)
    output = struct.pack('<III', 0x46546C67, 2, total) + struct.pack('<II', len(encoded), 0x4E4F534A) + encoded + struct.pack('<II', len(data), 0x004E4942) + data
    (DEST / (name + '.glb')).write_bytes(output)
    print(name, len(output), 'bytes', ', '.join(material_indices))


DEST.mkdir(parents=True, exist_ok=True)
for actor, (source_id, cells) in ACTORS.items():
    prepare(actor, source_id, 'Characters', cells)
for equipment, source_id in EQUIPMENT.items():
    prepare(equipment, source_id, 'Equipment', set())
(DEST / 'AshenMarches_LICENSE.txt').write_bytes((SOURCE / 'AshenMarches_LICENSE.txt').read_bytes())

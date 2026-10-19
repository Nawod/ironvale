"""Bundle a selective, pinned 0 A.D. artwork pack. Python + numpy + Pillow required.

Downloads artwork only (no engine code), reads COLLADA skinning and matrix animation,
and samples finite shared pose banks. All runtime dependencies are local. Re-running
uses .cache/historical/source; --offline rejects missing inputs. Derived artwork is
CC BY-SA 3.0, as are its source meshes, textures and animations.
"""
from pathlib import Path
import hashlib
import json
import sys
import urllib.request
import xml.etree.ElementTree as ET
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'public/models/historical'
CACHE = ROOT / '.cache/historical/source'
REV = '61a3b9507d974084e6badb88a0826bd89a6d5b8b'
BASE = f'https://raw.githubusercontent.com/0ad/0ad/{REV}/binaries/data/mods/public/art/'
NS = {'c': 'http://www.collada.org/2005/11/COLLADASchema'}
SAMPLES = 8
sources = {}
meshes = {}
textures = {}
binary = bytearray()
geometries = []


def source(path):
    target = CACHE / path
    if not target.exists():
        if '--offline' in sys.argv:
            raise FileNotFoundError(target)
        target.parent.mkdir(parents=True, exist_ok=True)
        print('Download', path, flush=True)
        target.write_bytes(urllib.request.urlopen(BASE + path, timeout=60).read())
    data = target.read_bytes()
    sources[path] = {'path': path, 'url': BASE + path, 'sha256': hashlib.sha256(data).hexdigest()}
    return target


def xml(path):
    return ET.parse(source(path)).getroot()


def values(node):
    return np.fromstring(node.text or '', sep=' ')


def data_sources(root):
    result = {}
    for node in root.findall('.//c:source', NS):
        array = node.find('c:float_array', NS)
        if array is not None:
            accessor = node.find('c:technique_common/c:accessor', NS)
            stride = int(accessor.get('stride', 1))
            result[node.get('id')] = values(array).reshape(-1, stride)
        else:
            names = node.find('c:Name_array', NS)
            if names is not None:
                result[node.get('id')] = names.text.split()
    return result


def local_matrix(node):
    matrix = node.find('c:matrix', NS)
    if matrix is not None:
        return values(matrix).reshape(4, 4)
    result = np.eye(4)
    for item in node:
        tag = item.tag.split('}')[-1]
        if tag == 'translate':
            m = np.eye(4); m[:3, 3] = values(item); result = result @ m
        elif tag == 'scale':
            result = result @ np.diag([*values(item), 1])
        elif tag == 'rotate':
            x, y, z, angle = values(item); angle = np.deg2rad(angle)
            v = np.array([x, y, z]); v /= np.linalg.norm(v)
            skew = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
            m = np.eye(4); m[:3, :3] = np.eye(3) + np.sin(angle) * skew + (1 - np.cos(angle)) * (skew @ skew)
            result = result @ m
    return result


def worlds(root, overrides=None):
    result = {}
    def visit(node, parent):
        matrix = parent @ (overrides or {}).get(node.get('id'), local_matrix(node))
        for key in ['id', 'sid', 'name']:
            if node.get(key): result[node.get(key)] = matrix
        for child in node.findall('c:node', NS): visit(child, matrix)
    scene = root.find('.//c:visual_scene', NS)
    for node in scene.findall('c:node', NS): visit(node, np.eye(4))
    return result


class Model:
    def __init__(self, path):
        self.path = path; self.root = xml('meshes/' + path)
        self.sources = data_sources(self.root)
        mesh = self.root.find('.//c:library_geometries/c:geometry/c:mesh', NS)
        vertices = {n.get('id'): n.find('c:input', NS).get('source')[1:] for n in mesh.findall('c:vertices', NS)}
        self.points = []; self.uv = []; self.original = []; self.indices = []
        remap = {}
        for primitive in list(mesh.findall('c:triangles', NS)) + list(mesh.findall('c:polylist', NS)):
            inputs = {n.get('semantic'): (n.get('source')[1:], int(n.get('offset'))) for n in primitive.findall('c:input', NS)}
            width = max(i[1] for i in inputs.values()) + 1
            corners = np.fromstring(primitive.find('c:p', NS).text, sep=' ', dtype=int).reshape(-1, width)
            counts = primitive.find('c:vcount', NS)
            if counts is not None:
                offset = 0; triangles = []
                for count in map(int, counts.text.split()):
                    for j in range(1, count - 1): triangles.extend([corners[offset], corners[offset + j], corners[offset + j + 1]])
                    offset += count
                corners = triangles
            for corner in corners:
                posid, poff = inputs['VERTEX']; pi = int(corner[poff]); pos = self.sources[vertices[posid]][pi]
                ui = 0; uv = [0, 0]
                if 'TEXCOORD' in inputs:
                    uid, uoff = inputs['TEXCOORD']; ui = int(corner[uoff]); uv = self.sources[uid][ui][:2]
                key = (pi, ui)
                if key not in remap:
                    remap[key] = len(self.points); self.points.append([*pos, 1]); self.original.append(pi); self.uv.extend(uv)
                self.indices.append(remap[key])
        self.points = np.array(self.points)
        self.skin = self.root.find('.//c:skin', NS)
        self.world = worlds(self.root)
        if self.skin is not None:
            joints = self.skin.find('c:joints', NS)
            ids = {n.get('semantic'): n.get('source')[1:] for n in joints}
            self.joints = self.sources[ids['JOINT']]
            self.inverse = self.sources[ids['INV_BIND_MATRIX']].reshape(-1, 4, 4)
            self.bind = values(self.skin.find('c:bind_shape_matrix', NS)).reshape(4, 4)
            weights = self.skin.find('c:vertex_weights', NS)
            inputs = {n.get('semantic'): (n.get('source')[1:], int(n.get('offset'))) for n in weights.findall('c:input', NS)}
            width = max(i[1] for i in inputs.values()) + 1
            packed = np.fromstring(weights.find('c:v', NS).text, sep=' ', dtype=int).reshape(-1, width)
            self.weights = []; offset = 0
            for count in map(int, weights.find('c:vcount', NS).text.split()):
                self.weights.append([(int(row[inputs['JOINT'][1]]), float(self.sources[inputs['WEIGHT'][0]][row[inputs['WEIGHT'][1]], 0])) for row in packed[offset:offset + count]])
                offset += count
        else:
            # Mesh node's own transform, and named attachment points in prop files.
            self.world = worlds(self.root)
            self.transform = np.eye(4)
            for node in self.root.findall('.//c:node', NS):
                if node.find('c:instance_geometry', NS) is not None:
                    self.transform = self.world[node.get('id')]; break

    def pose(self, bones=None, attach=None):
        if self.skin is not None:
            rig = bones if bones is not None and all(name in bones for name in self.joints) else self.world
            matrices = [(attach if attach is not None else np.eye(4)) @ rig[name] @ inverse @ self.bind for name, inverse in zip(self.joints, self.inverse)]
            points = np.zeros_like(self.points)
            for index, original in enumerate(self.original):
                for joint, weight in self.weights[original]: points[index] += weight * (matrices[joint] @ self.points[index])
        else:
            points = ((attach if attach is not None else np.eye(4)) @ self.transform @ self.points.T).T
        # COLLADA Z up -> game Y up; authored humans are approximately 4m tall.
        return points[:, [0, 2, 1]] * np.array([.46, .46, -.46,])


def model(path):
    if path not in meshes: meshes[path] = Model(path)
    return meshes[path]


def texture(path):
    if path not in textures:
        target = 'textures/' + path.replace('/', '_').rsplit('.', 1)[0] + '.png'
        image = Image.open(source('textures/skins/' + path)).convert('RGBA')
        image.thumbnail((512, 512))
        (DEST / target).parent.mkdir(parents=True, exist_ok=True)
        image.save(DEST / target, optimize=True)
        textures[path] = target
    return textures[path]


def prop(actor, pick=0):
    root = xml('actors/' + actor)
    variants = root.findall('.//mesh')
    if not variants: raise ValueError(actor)
    mesh = variants[pick % len(variants)].text
    maps = [n.get('file') for n in root.findall('.//texture') if n.get('name') == 'baseTex']
    if not maps:
        for variant in root.findall('.//variant'):
            if variant.get('file'):
                v = xml('variants/' + variant.get('file'))
                maps.extend(n.get('file') for n in v.findall('.//texture') if n.get('name') == 'baseTex')
    return mesh, texture(maps[pick % len(maps)]) if maps else None


def animation(path):
    root = xml('animation/' + path); sources = data_sources(root); channels = {}
    samplers = {s.get('id'): {n.get('semantic'): n.get('source')[1:] for n in s} for s in root.findall('.//c:sampler', NS)}
    duration = 0
    for channel in root.findall('.//c:channel', NS):
        target, transform = channel.get('target').split('/', 1)
        sample = samplers[channel.get('source')[1:]]
        output = sources[sample['OUTPUT']]
        if transform != 'transform' or output.shape[1] != 16: continue
        times = sources[sample['INPUT']].ravel(); duration = max(duration, float(times[-1]))
        channels[target] = (times, output.reshape(-1, 4, 4))
    poses = []
    for frame in range(SAMPLES):
        t = duration * frame / SAMPLES
        overrides = {name: matrices[np.abs(times - t).argmin()] for name, (times, matrices) in channels.items()}
        poses.append(worlds(root, overrides))
    return duration, poses


def append(values, dtype):
    while len(binary) % 4: binary.append(0)
    array = np.asarray(values, dtype=dtype).ravel(); offset = len(binary)
    binary.extend(array.tobytes())
    return {'offset': offset, 'count': len(array)}


def geometry(mesh, positions, attachment):
    if not np.isfinite(positions).all(): raise ValueError('Invalid positions ' + mesh.path)
    index = len(geometries)
    geometries.append({'position': append(positions, '<f4'), 'uv': append(mesh.uv, '<f4'), 'index': append(mesh.indices, '<u2'), 'attachment': attachment})
    return index


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    (DEST / 'SOURCE-LICENSE.txt').write_bytes(source('LICENSE.txt').read_bytes())
    # Preserve the source actor recipes alongside the actual mesh/clip provenance.
    for actor in ['units/britons/infantry_spearman_b.xml', 'units/gauls/infantry_swordsman_b.xml', 'units/athenians/infantry_archer_b.xml']:
        source('actors/' + actor)
    body = model('skeletal/new/m_pants.dae')
    archer_body = model('skeletal/new/m_tunic_short.dae')
    head_mesh, _ = prop('props/units/heads/new/head_celt.xml')
    head = model(head_mesh)
    spear_mesh, spear_tex = prop('props/units/weapons/spear.xml')
    spear = model(spear_mesh)
    blade_mesh, blade_tex = prop('props/units/weapons/blades/spear_blade.xml')
    blade = model(blade_mesh)
    sword_mesh, sword_tex = prop('props/units/weapons/csword.xml')
    sword = model(sword_mesh)
    shield_mesh, shield_tex = prop('props/units/shields/brit_shield_spear_oval_e_01.xml')
    shield = model(shield_mesh)
    bow_mesh, bow_tex = prop('props/units/weapons/bow_short.xml')
    bow = model(bow_mesh)
    helmet_mesh, helmet_tex = prop('props/units/helmets/celt_helmet_montefortino_01.xml')
    helmet = model(helmet_mesh)
    arrow_mesh, arrow_tex = prop('props/units/weapons/arrow_back.xml')
    arrow = model(arrow_mesh)
    pike_mesh, pike_tex = prop('props/units/weapons/sarissa.xml')
    pike = model(pike_mesh)
    sets = {}
    for kind, variant_file in [('spearman', 'base_spearman_shield_relax_celt'), ('swordsman', 'base_swordsman_shield_relax_celt'), ('archer', 'base_archer_relax'), ('pikeman', 'base_pikeman_relax')]:
        root = xml('variants/biped/' + variant_file + '.xml')
        clips = {}
        for name in ['idle', 'walk']:
            item = next(n for n in root.findall('.//animation') if n.get('name').lower() == name)
            clips[name] = item.get('file')
        if kind == 'archer':
            attack = xml('variants/biped/attack_ranged_archer.xml')
            clips['attack'] = attack.find('.//animation').get('file')
        else:
            clips['attack'] = next(n for n in root.findall('.//animation') if n.get('name').lower() == 'attack_melee').get('file')
        base = archer_body if kind in ['archer', 'pikeman'] else body
        variants = []
        for v in range(3):
            body_tex = texture(f'skeletal/hele/tunic_{["01_01", "01_02", "02_01"][v]}.png') if kind in ['archer', 'pikeman'] else texture(f'skeletal/gaul/{"pants_basic" if kind == "spearman" else "tunic_sleeveless_01"}_0{v + 1}.png')
            face_tex = texture(f'props/head/celt_{"abc"[v]}.dds')
            shield_variant = texture(f'props/shield/celt_shield_0{v + 1}.png')
            variants.append({'body': body_tex, 'head': face_tex, 'weapon': bow_tex if kind == 'archer' else pike_tex if kind == 'pikeman' else spear_tex if kind == 'spearman' else sword_tex, 'shield': shield_variant, 'helmet': helmet_tex, 'blade': blade_tex, 'arrow': arrow_tex})
        cycles = {}
        for action, clip in clips.items():
            duration, poses = animation(clip); frames = []
            for bones in poses:
                points = base.pose(bones); floor = points[:, 1].min()
                parts = []
                def attachment(name):
                    # The authored prop children correct the rig's bone axes.
                    # In particular prop-head undoes the head bone's 90deg tilt.
                    return bones.get('prop-' + name, bones[name])
                def add(mesh, role, attach=None, body_points=None):
                    p = body_points.copy() if body_points is not None else mesh.pose(bones, attach)
                    p[:, 1] -= floor
                    parts.append({'geometry': geometry(mesh, p, role != 'body'), 'role': role})
                add(base, 'body', body_points=points)
                add(head, 'head', attachment('head'))
                if kind == 'archer':
                    add(bow, 'weapon', attachment('weapon_bow')); add(arrow, 'arrow', attachment('weapon_R'))
                elif kind == 'pikeman':
                    add(pike, 'weapon', attachment('weapon_R')); add(helmet, 'helmet', attachment('helmet'))
                else:
                    add(spear if kind == 'spearman' else sword, 'weapon', attachment('weapon_R'))
                    add(shield, 'shield', attachment('shield'))
                    if kind == 'spearman':
                        blade_attach = next((m for key, m in spear.world.items() if key in ['prop-blade', 'blade', 'prop_blade']), np.eye(4))
                        add(blade, 'blade', attachment('weapon_R') @ blade_attach)
                    else:
                        add(helmet, 'helmet', attachment('helmet'))
                frames.append(parts)
            cycles[action] = {'duration': max(.3, duration), 'frames': frames}
        # Working defaults to a native attack pose rather than exposing a bind pose.
        cycles['work'] = cycles['attack']
        sets[kind] = {'variants': variants, 'cycles': cycles}
    bank = {'version': 1, 'samples': SAMPLES, 'binary': 'characters.bin', 'geometries': geometries, 'sets': sets}
    (DEST / 'characters.json').write_text(json.dumps(bank, separators=(',', ':')))
    (DEST / 'characters.bin').write_bytes(binary)
    (DEST / 'manifest.json').write_text(json.dumps({'title': '0 A.D. historical characters for Ironvale', 'authors': 'Wildfire Games and 0 A.D. art contributors', 'authorUrl': 'https://www.wildfiregames.com/', 'license': 'CC-BY-SA-3.0', 'licenseUrl': 'https://creativecommons.org/licenses/by-sa/3.0/', 'repository': 'https://github.com/0ad/0ad', 'revision': REV, 'changes': 'Selective actor assembly; COLLADA CPU skinning into eight shared pose samples; Z-up to Y-up conversion; character scale; DDS to PNG conversion. Original alpha player-color masks preserved.', 'sources': list(sources.values())}, indent=2))
    (DEST / 'LICENSE.txt').write_text('0 A.D. artwork by Wildfire Games and 0 A.D. art contributors.\nhttps://www.wildfiregames.com/\nCopyright its respective authors. Licensed under Creative Commons Attribution-ShareAlike 3.0 Unported.\nhttps://creativecommons.org/licenses/by-sa/3.0/\nThese derived character pose banks and converted textures are distributed under that same license.\nSee manifest.json for pinned source files, hashes, attribution and changes, and SOURCE-LICENSE.txt for the original artwork license notice.\nNo 0 A.D. engine code is included.\n')
    print(f'Baked {len(geometries)} geometries, {len(binary):,} bytes, {len(sources)} source files', flush=True)


if __name__ == '__main__': main()

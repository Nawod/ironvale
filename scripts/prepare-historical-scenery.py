"""Reproduce compact 0 A.D. CC BY-SA 3.0 foliage. Requires Pillow and numpy.
Run from repository root. Only downloads pinned source files, never a full game pack.
COLLADA transforms/UVs/normals are baked; authored triangles remain unchanged.
"""
import hashlib, io, json, pathlib, struct, tempfile, urllib.request
import xml.etree.ElementTree as ET
import numpy as np
from PIL import Image

REV = '61a3b9507d974084e6badb88a0826bd89a6d5b8b'
BASE = f'https://raw.githubusercontent.com/0ad/0ad/{REV}/'
ART = 'binaries/data/mods/public/art/'
ROOT = pathlib.Path('public/models/historical-nature')
CACHE = pathlib.Path(tempfile.gettempdir()) / 'ironvale-historical-nature' / REV
NS = {'c': 'http://www.collada.org/2005/11/COLLADASchema'}
ASSETS = [('oak-a', 'oak_tree_a', 'oak_tree_a.png'), ('oak-b', 'oak_tree_b', 'oak_tree_b.png'), ('pine', 'pine1', 'pine.dds'), ('berries', 'berry_bush_01', 'berry_bush_01.png')]
sources = []

def download(path):
    target = CACHE / path
    if not target.exists():
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(urllib.request.urlopen(BASE + path, timeout=60).read())
    data = target.read_bytes()
    sources.append({'path': path, 'url': BASE + path, 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)})
    return data

def local_transform(node):
    transform = np.identity(4)
    for child in node:
        tag = child.tag.split('}')[-1]
        if tag not in ['matrix', 'translate', 'rotate', 'scale']: continue
        values = list(map(float, child.text.split())); step = np.identity(4)
        if tag == 'matrix': step = np.array(values).reshape(4, 4)
        if tag == 'translate': step[:3, 3] = values
        if tag == 'scale': step[:3, :3] = np.diag(values)
        if tag == 'rotate':
            axis = np.array(values[:3]); axis /= np.linalg.norm(axis); x, y, z = axis
            angle = np.deg2rad(values[3]); c, s = np.cos(angle), np.sin(angle)
            skew = np.array([[0, -z, y], [z, 0, -x], [-y, x, 0]])
            step[:3, :3] = c*np.identity(3)+(1-c)*np.outer(axis,axis)+s*skew
        transform = transform @ step
    return transform

def collada(data):
    root = ET.fromstring(data); geometries = {}
    for geometry in root.findall('c:library_geometries/c:geometry', NS):
        mesh = geometry.find('c:mesh', NS); arrays = {}; vertices = {}
        for source in mesh.findall('c:source', NS):
            array = source.find('c:float_array', NS)
            if array is None: continue
            stride = int(source.find('c:technique_common/c:accessor', NS).get('stride', '1'))
            arrays[source.get('id')] = np.array(list(map(float, array.text.split()))).reshape(-1, stride)
        for vertex in mesh.findall('c:vertices', NS):
            vertices[vertex.get('id')] = {i.get('semantic'): i.get('source')[1:] for i in vertex.findall('c:input', NS)}
        chunks = []
        for primitive in mesh:
            kind = primitive.tag.split('}')[-1]
            if kind not in ['triangles', 'polylist']: continue
            inputs = primitive.findall('c:input', NS); stride = max(int(i.get('offset', '0')) for i in inputs)+1
            indices = np.array(list(map(int, primitive.find('c:p', NS).text.split()))).reshape(-1, stride)
            if kind == 'polylist':
                flattened = []; offset = 0
                for count in map(int, primitive.find('c:vcount', NS).text.split()):
                    for j in range(1, count-1): flattened.extend([indices[offset], indices[offset+j], indices[offset+j+1]])
                    offset += count
                indices = np.array(flattened)
            attributes = {}
            for inp in inputs:
                semantic = inp.get('semantic'); source = inp.get('source')[1:]; column = int(inp.get('offset', '0'))
                if semantic == 'VERTEX': semantic, source = 'POSITION', vertices[source]['POSITION']
                if semantic in ['POSITION', 'NORMAL', 'TEXCOORD']: attributes[semantic] = arrays[source][indices[:, column]]
            chunks.append(attributes)
        geometries[geometry.get('id')] = chunks
    output = []; axis = np.identity(4)
    if root.find('c:asset/c:up_axis', NS).text == 'Z_UP': axis = np.array([[1,0,0,0],[0,0,1,0],[0,-1,0,0],[0,0,0,1]])
    def walk(node, parent):
        transform = parent @ local_transform(node)
        for instance in node.findall('c:instance_geometry', NS):
            for source in geometries[instance.get('url')[1:]]:
                p = source['POSITION'][:, :3]; n = source.get('NORMAL')
                p = (transform @ np.column_stack([p, np.ones(len(p))]).T).T[:, :3]
                if n is None:
                    tri = p.reshape(-1,3,3); face = np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]); n = np.repeat(face,3,axis=0)
                else: n = (np.linalg.inv(transform[:3,:3]).T @ n[:,:3].T).T
                n /= np.maximum(np.linalg.norm(n,axis=1,keepdims=True),1e-9)
                uv = source['TEXCOORD'][:,:2].copy(); uv[:,1] = 1-uv[:,1]
                output.append((p,n,uv))
        for child in node.findall('c:node', NS): walk(child, transform)
    for node in root.findall('c:library_visual_scenes/c:visual_scene/c:node', NS): walk(node, axis)
    return tuple(np.concatenate([piece[i] for piece in output]) for i in range(3))

def pack(name, data, texture):
    positions, normals, uvs = collada(data)
    # Detect foliage from the original atlas alpha, without replacing source geometry.
    alpha = np.asarray(texture.getchannel('A')); h,w = alpha.shape; cutout = []
    for triangle in uvs.reshape(-1,3,2):
        samples = []
        for i in range(9):
            for j in range(9-i): samples.append(triangle[0]+(triangle[1]-triangle[0])*i/8+(triangle[2]-triangle[0])*j/8)
        samples = np.array(samples); x = np.clip((samples[:,0]*w).astype(int),0,w-1); y = np.clip((samples[:,1]*h).astype(int),0,h-1)
        cutout.append(bool(np.any(alpha[y,x] < 230)))
    binary=bytearray(); doc={'asset':{'version':'2.0','generator':'Ironvale pinned 0 A.D. static COLLADA conversion','copyright':'Wildfire Games and contributors; CC BY-SA 3.0'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'mesh':0}],'meshes':[{'name':name,'primitives':[]}],'materials':[],'accessors':[],'bufferViews':[]}
    for leaf in [False, True]:
        mask = np.repeat(np.array(cutout) == leaf,3)
        if not mask.any(): continue
        attributes={}
        for semantic, array, width in [('POSITION',positions,3),('NORMAL',normals,3),('TEXCOORD_0',uvs,2)]:
            values=array[mask].astype('<f4'); offset=len(binary); payload=values.tobytes(); binary.extend(payload)
            view=len(doc['bufferViews']); accessor=len(doc['accessors']); doc['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(payload),'target':34962})
            record={'bufferView':view,'componentType':5126,'count':len(values),'type':f'VEC{width}'}
            if semantic=='POSITION': record.update(min=values.min(axis=0).tolist(),max=values.max(axis=0).tolist())
            doc['accessors'].append(record); attributes[semantic]=accessor
        material=len(doc['materials']); doc['materials'].append({'name':f'{name} '+('foliage' if leaf else 'trunk'),'alphaMode':'MASK' if leaf else 'OPAQUE','alphaCutoff':.45,'doubleSided':leaf,'pbrMetallicRoughness':{'metallicFactor':0,'roughnessFactor':.96}})
        doc['meshes'][0]['primitives'].append({'attributes':attributes,'material':material})
    doc['buffers']=[{'byteLength':len(binary)}]; header=json.dumps(doc,separators=(',',':')).encode(); header+=b' '*((-len(header))%4); binary+=b'\0'*((-len(binary))%4)
    glb=struct.pack('<III',0x46546c67,2,28+len(header)+len(binary))+struct.pack('<II',len(header),0x4e4f534a)+header+struct.pack('<II',len(binary),0x004e4942)+binary
    return glb,len(positions)//3

def main():
    ROOT.mkdir(parents=True,exist_ok=True); records=[]
    def write(name,data,**extra):
        (ROOT/name).write_bytes(data); records.append({'file':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),**extra})
    for name,mesh,skin in ASSETS:
        raw=download(ART+'meshes/gaia/'+mesh+'.dae'); source_texture=download(ART+'textures/skins/gaia/'+skin)
        image=Image.open(io.BytesIO(source_texture)).convert('RGBA'); image.thumbnail((512,512),Image.Resampling.LANCZOS)
        texture=io.BytesIO(); image.save(texture,format='PNG',optimize=True); write(name+'.png',texture.getvalue(),width=image.width,height=image.height)
        glb,triangles=pack(name,raw,image); write(name+'.glb',glb,triangles=triangles,sourceMesh=mesh+'.dae',sourceTexture=skin); print(name,triangles,len(glb),len(texture.getvalue()))
    for actor in ['flora/trees/oak.xml','flora/trees/pine.xml','props/flora/berry_bush.xml']: download(ART+'actors/'+actor)
    for source,target in [('LICENSE.txt','0ad-LICENSE.txt'),(ART+'LICENSE.txt','0ad-art-LICENSE.txt')]: write(target,download(source))
    write('NOTICE.txt',b'0 A.D. foliage derivatives. Original author: Wildfire Games and contributors.\nhttps://www.wildfiregames.com/\nhttps://play0ad.com/\nLicensed CC BY-SA 3.0: https://creativecommons.org/licenses/by-sa/3.0/\nAdapted by Ironvale: static GLB conversion, coordinate/UV conversion, 512px RGBA atlases, opaque/cutout split. These derivative assets remain CC BY-SA 3.0. See manifest.json for pinned original sources and hashes.\n')
    manifest={'license':'CC-BY-SA-3.0','author':'Wildfire Games and contributors','revision':REV,'sourceRepository':'https://github.com/0ad/0ad','modifications':'Static COLLADA world transforms and Z-up to Y-up; original triangles/UVs/normals retained; 512px RGBA PNG atlas derivatives; alpha-based trunk/foliage material split. No actor decal props or wind shader.','assets':records,'sources':sources}
    (ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')

if __name__=='__main__': main()

"""Retrieve exact CC0 Quaternius packs from author Drive folders; pack selected glTF/OBJ into GLB.
Run from repository root. Source IDs, hashes, and license notices are retained in realm/manifest.json.
"""
import json, re, urllib.request, pathlib, hashlib, concurrent.futures, struct, base64, tempfile
ROOT = pathlib.Path('public/models/realm')
ROOT.mkdir(parents=True, exist_ok=True)
SOURCE = pathlib.Path(tempfile.gettempdir()) / 'ironvale-realm-source'

def folder(id):
    text = urllib.request.urlopen('https://drive.google.com/drive/folders/' + id).read().decode()
    encoded = re.search(r"_DRIVE_ivd'\] = '(.*?)';", text).group(1)
    decoded = re.sub(r'\\x([0-9a-fA-F]{2})', lambda m: chr(int(m[1],16)), encoded).replace('\\/', '/')
    data = json.loads(decoded)
    return [{'id': x[0], 'name': x[2], 'mime': x[3]} for x in data[0]]

def download(item, target):
    if target.exists(): return target.read_bytes()
    data = urllib.request.urlopen('https://drive.google.com/uc?export=download&id=' + item['id']).read()
    if data[:15].lower().startswith(b'<!doctype html') or data.startswith(b'<html'): raise RuntimeError('Drive quota/HTML: ' + item['name'])
    target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(data)
    return data

def glb(doc, binary):
    encoded=json.dumps(doc,separators=(',',':')).encode(); encoded+=b' '*((-len(encoded))%4); binary+=b'\0'*((-len(binary))%4)
    return struct.pack('<III',0x46546c67,2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary

def convert_gltf(data):
    doc=json.loads(data); binary=bytearray()
    for buf in doc.get('buffers',[]):
        uri=buf.pop('uri'); assert uri.startswith('data:'); payload=base64.b64decode(uri.split(',')[1]); shift=len(binary); binary.extend(payload); binary.extend(b'\0'*((-len(binary))%4))
        for view in doc.get('bufferViews',[]):
            if view.get('buffer',0)==doc['buffers'].index(buf): view['buffer']=0; view['byteOffset']=view.get('byteOffset',0)+shift
    doc['buffers']=[{'byteLength':len(binary)}]
    return glb(doc,binary)

def convert_obj(data, mtl):
    colors={}; name=None
    for line in mtl.decode().splitlines():
        p=line.split()
        if p and p[0]=='newmtl': name=p[1]
        elif p and p[0]=='Kd': colors[name]=[float(x) for x in p[1:4]]
    vertices=[]; normals=[]; groups={}; name='default'
    for line in data.decode().splitlines():
        p=line.split()
        if not p: continue
        if p[0]=='v': vertices.append([float(x) for x in p[1:4]])
        elif p[0]=='vn': normals.append([float(x) for x in p[1:4]])
        elif p[0]=='usemtl': name=p[1]
        elif p[0]=='f':
            face=p[1:]
            for i in range(1,len(face)-1):
                for token in [face[0],face[i],face[i+1]]:
                    idx=token.split('/'); groups.setdefault(name,[]).append(vertices[int(idx[0])-1])
    binary=bytearray(); doc={'asset':{'version':'2.0','generator':'Ironvale CC0 OBJ conversion'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'mesh':0}],'meshes':[{'primitives':[]}],'materials':[],'accessors':[],'bufferViews':[]}
    for name, positions in groups.items():
        offset=len(binary); flat=[x for p in positions for x in p]; binary.extend(struct.pack('<'+'f'*len(flat),*flat)); view=len(doc['bufferViews']); accessor=len(doc['accessors']); material=len(doc['materials'])
        doc['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(flat)*4,'target':34962}); doc['accessors'].append({'bufferView':view,'componentType':5126,'count':len(positions),'type':'VEC3','min':[min(p[i] for p in positions) for i in range(3)],'max':[max(p[i] for p in positions) for i in range(3)]})
        doc['materials'].append({'name':name,'pbrMetallicRoughness':{'baseColorFactor':colors.get(name,[.4,.5,.25])+[1],'metallicFactor':0,'roughnessFactor':.94}}); doc['meshes'][0]['primitives'].append({'attributes':{'POSITION':accessor},'material':material})
    doc['buffers']=[{'byteLength':len(binary)}]; return glb(doc,binary)

RTS=[]
for stem in ['TownCenter','Houses','Storage','Barracks','Archery','Market','WatchTower','Wonder']:
    for age,level in [('FirstAge',1),('FirstAge',3),('SecondAge',3)]:
        prefix='Houses_'+age+'_1' if stem=='Houses' else stem+'_'+age
        name=prefix+'_Level'+str(level)
        if name=='Storage_FirstAge_Level3': name='Storage_FirstAge_Leve3'
        RTS.append(name)
RTS+=['Wall_FirstAge','Wall_SecondAge','WallTowers_SecondAge','Mountain_Single','Mountain_Group_1','Resource_Gold_1']
NATURE=['CommonTree_1','BirchTree_1','PineTree_1','CommonTree_3','BushBerries_1','Rock_1','Rock_3','Rock_Moss_2']

def prepare():
    listing={kind:{x['name']:x for x in json.loads((ROOT/(kind+'-listing.json')).read_text())} for kind in ['rts','nature']}
    jobs=[('rts',name) for name in RTS]+[('nature',name) for name in NATURE]
    records=[]
    def one(job):
        kind,name=job; ext='.gltf' if kind=='rts' else '.obj'; item=listing[kind][name+ext]; raw=download(item,SOURCE/kind/(name+ext))
        if kind=='rts': out=convert_gltf(raw)
        else: out=convert_obj(raw,download(listing[kind][name+'.mtl'],SOURCE/kind/(name+'.mtl')))
        (ROOT/(name+'.glb')).write_bytes(out)
        return {'file':name+'.glb','pack':kind,'sourceFile':name+ext,'sourceId':item['id'],'sourceSha256':hashlib.sha256(raw).hexdigest(),'sha256':hashlib.sha256(out).hexdigest(),'bytes':len(out)}
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        for record in pool.map(one,jobs): records.append(record); print(record['file'],record['bytes'])
    (ROOT/'manifest.json').write_text(json.dumps({'license':'CC0-1.0','author':'Quaternius','assets':records},indent=2))
    for kind,id in [('rts','1Vf_6mtufbmV2mQHY35l9tPqaR3Oe8Did'),('nature','1--Tpm7DFdhjE9-i75I1VFdX4hTr7OiA1')]: download({'id':id,'name':'License.txt'},ROOT/(kind+'-license.txt'))

if __name__ == '__main__':
    import sys
    if '--list' in sys.argv:
        import gdown # pip install gdown; embedded view lists all files, ordinary folder pages truncate at 50.
        for key, id in [('rts','17T5i1YOWsJRZD10Ko0rm5pKjXjke7UTK'),('nature','1y00kViOCktZMOnDLbujse0JnqLzWi5O_')]:
            rows=[{'id':x.id,'name':x.path} for x in gdown.download_folder(id=id,skip_download=True,quiet=True,use_cookies=False)]; (ROOT/(key+'-listing.json')).write_text(json.dumps(rows,indent=2)); print(key, '\n'.join(x['name'] for x in rows))
    else: prepare()

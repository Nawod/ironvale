"""CPU-only orthographic source preview for checking selected CC0 model silhouettes."""
import json,struct,math
from pathlib import Path
from PIL import Image,ImageDraw
names=['TownCenter_FirstAge_Level1','TownCenter_FirstAge_Level3','TownCenter_SecondAge_Level3','Storage_FirstAge_Level1','Houses_FirstAge_1_Level1','Wonder_SecondAge_Level3']
image=Image.new('RGB',(1200,800),(40,48,46)); draw=ImageDraw.Draw(image)
for index,name in enumerate(names):
 data=Path('public/models/realm/'+name+'.glb').read_bytes(); length=struct.unpack_from('<I',data,12)[0]; j=json.loads(data[20:20+length]); binary=data[28+length:]
 def attr(i):
  a=j['accessors'][i]; v=j['bufferViews'][a['bufferView']]; count={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]; fmt={5126:'f',5125:'I',5123:'H',5121:'B'}[a['componentType']]; off=v.get('byteOffset',0)+a.get('byteOffset',0); stride=v.get('byteStride',struct.calcsize(fmt)*count)
  return [struct.unpack_from('<'+fmt*count,binary,off+k*stride) for k in range(a['count'])]
 triangles=[]
 for mesh in j['meshes']:
  for primitive in mesh['primitives']:
   positions=attr(primitive['attributes']['POSITION']); indices=[x[0] for x in attr(primitive['indices'])] if 'indices'in primitive else list(range(len(positions))); color=j['materials'][primitive['material']]['pbrMetallicRoughness']['baseColorFactor']
   for k in range(0,len(indices),3):
    tri=[positions[v] for v in indices[k:k+3]]; points=[((p[0]-p[2])*.707,-p[1]*.85+(p[0]+p[2])*.36) for p in tri]; depth=sum(p[0]+p[2]+p[1]*.2 for p in tri); triangles.append((depth,points,tuple(int(max(0,min(1,c))**(1/2.2)*255) for c in color[:3])))
 allpoints=[p for t in triangles for p in t[1]]; minx=min(p[0]for p in allpoints); maxx=max(p[0]for p in allpoints); miny=min(p[1]for p in allpoints); maxy=max(p[1]for p in allpoints); scale=min(360/(maxx-minx),320/(maxy-miny)); ox=(index%3)*400+200-(maxx+minx)/2*scale; oy=(index//3)*400+190-(maxy+miny)/2*scale
 for _,points,color in sorted(triangles,reverse=True): draw.polygon([(x*scale+ox,y*scale+oy)for x,y in points],fill=color)
 draw.text(((index%3)*400+10,(index//3)*400+365),name,fill=(255,255,255))
image.save('public/models/realm/source-preview.png')

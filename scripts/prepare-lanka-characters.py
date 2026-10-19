"""Selective, pinned 0 A.D. artwork derivative for Lanka. No engine code.

Run with Python/numpy/Pillow. --offline requires cached original inputs.
This is a game interpretation of Sri Lankan kingdoms, using Mauryan artwork
as a regional clothing starting point, not a faithful historical reconstruction.
"""
import importlib.util
import json
from pathlib import Path
import numpy as np

spec = importlib.util.spec_from_file_location('native_art', Path(__file__).with_name('prepare-historical-characters.py'))
a = importlib.util.module_from_spec(spec)
spec.loader.exec_module(a)
a.DEST = a.ROOT / 'public/models/lanka'


def main():
    a.DEST.mkdir(parents=True, exist_ok=True)
    (a.DEST / 'SOURCE-LICENSE.txt').write_bytes(a.source('LICENSE.txt').read_bytes())
    body = a.model('skeletal/new/m_tunic_short.dae')
    head_path, _ = a.prop('props/units/heads/new/head_maur_short_hair.xml')
    head = a.model(head_path)
    equipment = {}
    for role, actor in [('spear', 'weapons/spear.xml'), ('sword', 'weapons/csword.xml'), ('bow', 'weapons/bow_short.xml'), ('pike', 'weapons/sarissa.xml'), ('shield', 'shields/maur_small_a.xml')]:
        path, tex = a.prop('props/units/' + actor)
        equipment[role] = (a.model(path), tex)
    blade_path,blade_texture=a.prop('props/units/weapons/blades/spear_blade.xml')
    blade=a.model(blade_path)
    sets = {}
    for kind, recipe in [('spearman','base_spearman_shield_relax_celt'),('swordsman','base_swordsman_shield_relax_celt'),('archer','base_archer_relax'),('pikeman','base_pikeman_relax')]:
        root = a.xml('variants/biped/' + recipe + '.xml')
        clips = {name:next(n for n in root.findall('.//animation') if n.get('name').lower()==name).get('file') for name in ['idle','walk']}
        clips['attack'] = a.xml('variants/biped/attack_ranged_archer.xml').find('.//animation').get('file') if kind=='archer' else next(n for n in root.findall('.//animation') if n.get('name').lower()=='attack_melee').get('file')
        weapon = {'spearman':'spear','swordsman':'sword','archer':'bow','pikeman':'pike'}[kind]
        variants=[]
        for v, cloth in enumerate(['tunic_01_01','tunic_02_01','tunic_leather_01_01']):
            variants.append({'body':a.texture('skeletal/maur/'+cloth+'.png'),'head':a.texture('props/head/maur_face_'+'abc'[v]+'.png'),'weapon':equipment[weapon][1],'shield':a.texture('props/shield/maur_shield_small_'+'abc'[v]+'.png'),'blade':blade_texture})
        cycles={}
        for action,clip in clips.items():
            duration,poses=a.animation(clip); frames=[]
            for bones in poses:
                points=body.pose(bones); floor=points[:,1].min(); parts=[]
                def add(mesh,role,attachment=None,points=None):
                    p=mesh.pose(bones,attachment) if points is None else points.copy();p[:,1]-=floor
                    parts.append({'geometry':a.geometry(mesh,p,role!='body'),'role':role})
                def attach(name):return bones.get('prop-'+name,bones[name])
                add(body,'body',points=points);add(head,'head',attach('head'))
                add(equipment[weapon][0],'weapon',attach('weapon_bow' if kind=='archer' else 'weapon_R'))
                if kind=='spearman':
                    spear=equipment['spear'][0]
                    tip=next((m for key,m in spear.world.items() if key in ['prop-blade','blade','prop_blade']),np.eye(4))
                    add(blade,'blade',attach('weapon_R')@tip)
                if kind in ['spearman','swordsman']:add(equipment['shield'][0],'shield',attach('shield'))
                frames.append(parts)
            cycles[action]={'duration':max(.3,duration),'frames':frames}
        cycles['work']=cycles['attack'];sets[kind]={'variants':variants,'cycles':cycles}
    # The actual Asian elephant mesh and authored skeletal motion, not a scaled horse.
    elephant_path, elephant_texture=a.prop('fauna/elephant_asian.xml')
    elephant=a.model(elephant_path);cycles={}
    base=elephant.pose();scale=2.65/(base[:,1].max()-base[:,1].min())
    for action,clip in [('idle','elephant_asian_idle_01'),('walk','elephant_asian_walk'),('attack','elephant_asian_attack_melee_01')]:
        duration,poses=a.animation('quadraped/'+clip+'.dae');frames=[]
        for bones in poses:
            points=elephant.pose(bones)*scale;points[:,1]-=points[:,1].min()
            frames.append([{'geometry':a.geometry(elephant,points,False),'role':'body'}])
        cycles[action]={'duration':max(.3,duration),'frames':frames}
    cycles['work']=cycles['attack'];sets['warElephant']={'variants':[{'body':elephant_texture}],'cycles':cycles}
    (a.DEST/'characters.json').write_text(json.dumps({'version':1,'samples':a.SAMPLES,'binary':'characters.bin','geometries':a.geometries,'sets':sets},separators=(',',':')))
    (a.DEST/'characters.bin').write_bytes(a.binary)
    (a.DEST/'manifest.json').write_text(json.dumps({'title':'Kingdom Lanka regional character and Asian elephant derivatives','authors':'Wildfire Games and 0 A.D. art contributors','authorUrl':'https://www.wildfiregames.com/','license':'CC-BY-SA-3.0','licenseUrl':'https://creativecommons.org/licenses/by-sa/3.0/','repository':'https://github.com/0ad/0ad','revision':a.REV,'changes':'Selective regional tunic, head and equipment assembly; COLLADA skinning sampled to eight finite shared animation frames; Z-up to Y-up; height normalization; original alpha player-color masks preserved. Original Lanka equipment overlays and architecture are separate runtime geometry. Regional game art interpretation, not historical reconstruction.','sources':list(a.sources.values())},indent=2))
    (a.DEST/'LICENSE.txt').write_text('0 A.D. artwork by Wildfire Games and 0 A.D. art contributors. Copyright its respective authors.\nhttps://www.wildfiregames.com/\nLicensed under Creative Commons Attribution-ShareAlike 3.0 Unported.\nhttps://creativecommons.org/licenses/by-sa/3.0/\nThese derived pose banks and converted textures are distributed under that same license.\nSee manifest.json for pinned source paths, hashes and changes; SOURCE-LICENSE.txt preserves the original notice. No engine code is included.\n')
    print(f'Lanka: {len(a.geometries)} geometries, {len(a.binary):,} bytes, {len(a.sources)} attributed sources',flush=True)


if __name__=='__main__':main()

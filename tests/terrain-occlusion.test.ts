import { afterEach, expect, it } from 'vitest';
import { BoxGeometry, Matrix4, MeshStandardMaterial, Raycaster, Scene, Vector3 } from 'three';
import { Battlefield } from '../src/render/battlefield';
import { ModelBatches } from '../src/render/batches3d';
import type { ModelPart } from '../src/render/models3d';
import type { Entity } from '../src/sim/types';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });
const resource = (type = 'gold') => ({ id: 9, type, kind: 'resource', owner: -1, hp: 100, amount: 100, x: 6, y: 4, ghost: false }) as Entity;
function fieldWith(entity: Entity, ridge = 5, elevation = true): any {
 const field = new Battlefield({} as HTMLElement, { select() {}, action() {}, cancel() {}, error() {} }) as any;
 field.ready = true; field.app.screen = { width: 900, height: 600 }; field.center({ x: 6, y: 6 }); field.rotate(-Math.PI / 4);
 field.snapshot = { size: 12, entities: [entity], fog: Array(144).fill(2), terrain: Array(144).fill(0), ...(elevation ? { elevation: Array.from({ length: 169 }, (_, i) => { const row = Math.floor(i / 13); return row >= 6 && row <= 8 ? ridge : 0; }) } : {}) };
 cleanup.push(() => { field.batches.dispose(); field.models.dispose(); });
 return field;
}
function body(field: any, entity: Entity): void {
 const part: ModelPart = { geometry: new BoxGeometry(.6, 1.4, .6), material: new MeshStandardMaterial(), position: [0, 0, 0], scale: [1, 1, 1], rotation: [0, 0, 0] };
 field.batches.add(part, new Matrix4().makeTranslation(entity.x, .7, entity.y), 0xffffff, 0, 0, false, false, false, entity.id); field.batches.end();
 cleanup.push(() => { part.geometry.dispose(); part.material.dispose(); });
}

it('rejects an exact resource mesh hidden behind the foreground mountain', () => {
 const e = resource(), field = fieldWith(e); body(field, e);
 const point = field.view.project(e, .7);
 expect(field.screenToWorld(point).y).toBeGreaterThan(8);
 expect(field.hit(point)).toBeUndefined();
});

it('rejects a building footprint behind the mountain when its open mesh has no hit', () => {
 const e = { ...resource(), type: 'palisade', kind: 'building', owner: 0 } as Entity, field = fieldWith(e);
 expect(field.hit(field.view.project({ x: 6.5, y: 4.5 }, .4))).toBeUndefined();
});

it.each(['gold', 'deer'])('rejects the touch margin for fully occluded %s', type => {
 const e = resource(type), field = fieldWith(e), point = field.view.project(e, type === 'deer' ? .7 : .45);
 point.x += 10;
 expect(field.hit(point, true)).toBeUndefined();
});

it('retains visible unit tops above a nearer hill while rejecting their buried lower silhouette', () => {
 const e = { ...resource(), kind: 'unit', type: 'villager', owner: 0 } as Entity, field = fieldWith(e, 2.4); body(field, e);
 expect(field.hit(field.view.project(e, .1))).toBeUndefined();
 expect(field.hit(field.view.project(e, 1.3))?.id).toBe(e.id);
});

it('retains the legacy flat-map picking behavior', () => {
 const e = resource(), field = fieldWith(e, 5, false); body(field, e);
 expect(field.hit(field.view.project(e, .7))?.id).toBe(e.id);
});

it('keeps an elevated own-building courtyard and the nearby hunting touch margin usable', () => {
 const building = { ...resource(), type: 'palisade', kind: 'building', owner: 0 } as Entity, field = fieldWith(building, 0);
 field.snapshot.elevation.fill(1.25);
 expect(field.hit(field.view.project({ x: 6.5, y: 4.5 }, 1.65))?.id).toBe(building.id);
 const deer = resource('deer'); field.snapshot.entities = [deer];
 const point = field.view.project(deer, 1.95); point.x += 10;
 expect(field.hit(point, true)?.id).toBe(deer.id);
});

it('allows callers to bound batch picking without changing the ray or later unrestricted picks', () => {
 const batches = new ModelBatches(new Scene()), part: ModelPart = { geometry: new BoxGeometry(1, 1, 1), material: new MeshStandardMaterial(), position: [0, 0, 0], scale: [1, 1, 1], rotation: [0, 0, 0] };
 cleanup.push(() => { batches.dispose(); part.geometry.dispose(); part.material.dispose(); });
 batches.add(part, new Matrix4(), 0xffffff, 0, 0, false, false, false, 7); batches.end();
 const ray = new Raycaster(new Vector3(0, 5, 0), new Vector3(0, -1, 0));
 expect(batches.pick(ray, 4)).toBeUndefined();
 expect(batches.pick(ray, 4.6)).toBe(7);
 expect(batches.pick(ray)).toBe(7); expect(ray.far).toBe(Infinity);
});

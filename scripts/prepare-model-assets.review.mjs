/** Review on an already running Vite server; does not start or stop any server.
 * node scripts/prepare-model-assets.review.mjs [origin] [output screenshot]
 */
import { chromium } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const origin = process.argv[2] ?? 'http://127.0.0.1:5179';
const output = process.argv[3] ?? join(tmpdir(), 'ironvale-imported-models-preview.png');
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=d3d11', '--enable-webgl', '--ignore-gpu-blocklist'] });
try {
 const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
 const errors = [];
 page.on('pageerror', error => errors.push(error.message));
 await page.goto(`${origin}/models/manifest.json`);
 await page.setContent('<body style="margin:0;background:#e7e1d2;color:#26372d;font:16px system-ui"><div id="title" style="position:absolute;left:35px;top:25px;z-index:2;font-weight:700;letter-spacing:.15em">IRONVALE · LOCAL CC0 MODEL REVIEW</div><div style="position:absolute;left:35px;bottom:25px;z-index:2;line-height:2">Villager · Swordsman · Spearman · Pikeman · Archer · Crossbowman<br>Deer · Cow · Alpaca · Fox · Horse</div></body>');
 await page.addScriptTag({ type: 'module', content: `
import * as T from '/node_modules/.vite/deps/three.js';
import {ImportedModels} from '/src/render/imported-models3d.ts';
import {ModelBatches} from '/src/render/batches3d.ts';
window.reviewModules = {T, ImportedModels, ModelBatches};
` });
 await page.waitForFunction(() => window.reviewModules);
 const preview = await page.evaluate(async () => {
  const { T, ImportedModels } = window.reviewModules;
  const renderer = new T.WebGLRenderer({ antialias: true });
  renderer.setSize(1600, 1000); renderer.setClearColor('#e7e1d2');
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap;
  document.body.appendChild(renderer.domElement);
  const scene = new T.Scene(); scene.add(new T.HemisphereLight('#f1f4f5', '#9d9479', 2.3));
  const sun = new T.DirectionalLight('#fff5da', 3); sun.position.set(3, 8, 5); sun.castShadow = true;
  sun.shadow.camera.left = sun.shadow.camera.bottom = -12; sun.shadow.camera.right = sun.shadow.camera.top = 12;
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -.001; scene.add(sun);
  const floor = new T.Mesh(new T.PlaneGeometry(100, 100), new T.MeshStandardMaterial({ color: '#b7bfa5', roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -.01; floor.receiveShadow = true; scene.add(floor);
  const camera = new T.OrthographicCamera(-8, 8, 5, -5, .1, 200); camera.position.set(3, 6, 14); camera.lookAt(0, .9, 1.5);
  const models = new ImportedModels(), started = performance.now(); await models.load(); const loadMs = performance.now() - started;
  const previewGroup = new T.Group(); scene.add(previewGroup);
  const types = ['villager', 'swordsman', 'spearman', 'pikeman', 'archer', 'crossbowman', 'deer', 'cow', 'alpaca', 'fox', 'horse'];
  for (const [i, type] of types.entries()) {
   const parts = models.get({ type, id: i + 1, owner: i % 3 }, { time: .32, moving: false, working: false, attacking: false });
   const root = new T.Group(); root.position.set(i < 6 ? (i - 2.5) * 2.1 : (i - 8) * 2.3, 0, i < 6 ? 0 : 3.7);
   for (const part of parts) { const mesh = new T.Mesh(part.geometry, part.material); mesh.position.fromArray(part.position); mesh.scale.fromArray(part.scale); mesh.rotation.set(...part.rotation); mesh.castShadow = true; root.add(mesh); }
   previewGroup.add(root);
  }
  renderer.render(scene, camera);
  window.reviewScene = { T, scene, camera, renderer, models, previewGroup, sun };
  return { loadMs, stats: models.stats(), drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, textures: renderer.info.memory.textures };
 });
 await page.screenshot({ path: output });
 const performanceResults = await page.evaluate(async () => {
  const { ModelBatches } = window.reviewModules;
  const { T, scene, camera, renderer, models, previewGroup, sun } = window.reviewScene;
  previewGroup.visible = false;
  const batches = new ModelBatches(scene), root = new T.Object3D();
  const types = ['villager', 'swordsman', 'spearman', 'pikeman', 'archer', 'crossbowman'];
  camera.left = -29; camera.right = 29; camera.top = 18.125; camera.bottom = -18.125;
  camera.position.set(25, 35, 45); camera.lookAt(0, .9, 0); camera.updateProjectionMatrix();
  sun.shadow.camera.left = sun.shadow.camera.bottom = -40; sun.shadow.camera.right = sun.shadow.camera.top = 40; sun.shadow.camera.updateProjectionMatrix();
  const results = [];
  for (const shadows of [false, true]) {
   renderer.shadowMap.enabled = shadows;
   for (const count of [400, 800]) {
    const cpu = [], frame = [], columns = Math.ceil(Math.sqrt(count));
    for (let tick = 0; tick < 25; tick++) {
     const before = performance.now(); batches.begin();
     for (let id = 0; id < count; id++) {
      const entity = { id, type: types[id % types.length], owner: id % 8 };
      root.position.set((id % columns - columns / 2) * 1.5, 0, (Math.floor(id / columns) - columns / 2) * 1.5); root.updateMatrix();
      for (const part of models.get(entity, { time: tick / 30, moving: true, working: false, attacking: false })) batches.add(part, root.matrix, 0xffffff, 0, 0, false, false, false, id + 1);
     }
     batches.end(); renderer.render(scene, camera); const submitted = performance.now();
     await new Promise(done => requestAnimationFrame(done));
     if (tick >= 5) { cpu.push(submitted - before); frame.push(performance.now() - before); }
    }
    const average = values => values.reduce((a, b) => a + b, 0) / values.length;
    results.push({ count, shadows, submitMs: average(cpu), frameMs: average(frame), drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, batches: batches.drawCalls() });
   }
  }
  batches.dispose(); models.dispose(); renderer.dispose();
  return results;
 });
 console.log(JSON.stringify({ output, preview, performance: performanceResults, errors }, null, 2));
 if (errors.length) process.exitCode = 1;
} finally { await browser.close(); }

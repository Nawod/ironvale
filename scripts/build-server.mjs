import {build} from 'esbuild';
await build({entryPoints:['server/index.ts','server/match-worker.ts'],outdir:'dist-server',entryNames:'[name]',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',target:'node24',format:'esm',external:['ws'],sourcemap:true});

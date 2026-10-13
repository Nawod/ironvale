import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],base:'./',server:{proxy:{'/ws':{target:'ws://127.0.0.1:5180',ws:true}}},build:{rollupOptions:{output:{manualChunks:(id:string)=>id.includes('node_modules')?(id.includes('three')?'graphics':id.includes('react')?'interface':undefined):undefined}}},test:{include:['tests/**/*.test.ts'],testTimeout:30000}} as any);

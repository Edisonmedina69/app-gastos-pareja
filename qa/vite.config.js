import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Servidor de QA optativo. Nunca forma parte de vite.config.js ni del build.
const root = fileURLToPath(new URL('../', import.meta.url));
export default defineConfig(({ mode }) => ({
  root,
  plugins: [{
    name: 'qa-isolated-services', enforce: 'pre',
    async load(id) {
      const path = id.split('?')[0];
      if (path.endsWith('/src/features/hogar/hooks/useHogar.js')) return `export { useHogar } from '/qa/hogar.jsx'`;
      if (/\/src\/services\/.*\.service\.js$/.test(path)) {
        const source = readFileSync(path, 'utf8');
        const names = [...source.matchAll(/export (?:async )?(?:function|const) (\w+)/g)].map(m => m[1]);
        return `import { call } from '/qa/store.js';\n` + names.map(name => `export const ${name} = (...args) => call('${name}', args);`).join('\n');
      }
      if (path.endsWith('/src/services/supabaseClient.js')) throw new Error('QA: acceso a Supabase bloqueado');
      if (mode === 'before' && path === root + 'src/index.css') {
        // También compilar las utilidades del commit anterior: leer solo JSX viejo
        // con el escáner actual perdería sus tamaños arbitrarios y max-width.
        const read = file => execFileSync('git', ['show', `bac4f70:${file}`], { cwd: root, encoding: 'utf8' });
        const config = new Function(read('tailwind.config.js').replace('export default', 'return'))();
        config.content = [{ raw: execFileSync('git', ['grep', '-h', '-e', '', 'bac4f70', '--', 'src'], { cwd: root, encoding: 'utf8' }), extension: 'jsx' }];
        return (await postcss([tailwind(config)]).process(read('src/index.css'), { from: undefined })).css;
      }
      if (mode === 'before' && path.startsWith(root + 'src/')) {
        return execFileSync('git', ['show', `bac4f70:${path.slice(root.length)}`], { cwd: root, encoding: 'utf8' });
      }
    },
  }, react()],
  server: { host: '127.0.0.1' },
}));

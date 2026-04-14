import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const servicePort = process.env['SERVICE_PORT'] ?? '4433';

function cspPortPlugin(): Plugin {
  return {
    name: 'csp-service-port',
    transformIndexHtml(html) {
      return html.replace(/__SERVICE_PORT__/g, servicePort);
    },
  };
}

export default defineConfig({
  plugins: [react(), cspPortPlugin()],
  root: path.join(__dirname, 'src/renderer'),
  base: './',
  build: {
    outDir: path.join(__dirname, 'dist/renderer'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@nexusorder/shared-types': path.join(__dirname, '../../packages/shared-types/src/index.ts'),
      '@nexusorder/shared-rbac': path.join(__dirname, '../../packages/shared-rbac/src/index.ts'),
      '@nexusorder/shared-logging': path.join(__dirname, '../../packages/shared-logging/src/index.ts'),
      '@nexusorder/shared-validation': path.join(__dirname, '../../packages/shared-validation/src/index.ts'),
    },
  },
  define: {
    'import.meta.env.VITE_SERVICE_PORT': JSON.stringify(process.env['SERVICE_PORT'] ?? '4433'),
  },
});

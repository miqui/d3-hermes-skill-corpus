import { cp, mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const dataDir = resolve(process.cwd(), 'data');

function corpusDataPlugin(): Plugin {
  return {
    name: 'corpus-data',
    configureServer(server) {
      server.middlewares.use('/data', async (req, res, next) => {
        const requestPath = req.url ? req.url.split('?')[0] : '/';
        const resolvedPath = resolve(dataDir, `.${requestPath}`);

        if (!resolvedPath.startsWith(dataDir)) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }

        try {
          const file = await readFile(resolvedPath);
          if (resolvedPath.endsWith('.json')) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
          }
          res.end(file);
        } catch {
          next();
        }
      });
    },
    async writeBundle() {
      const distDataDir = resolve(process.cwd(), 'dist/data');
      await mkdir(distDataDir, { recursive: true });
      await cp(dataDir, distDataDir, { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [react(), corpusDataPlugin()],
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
  },
});

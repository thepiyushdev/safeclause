import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import fs from 'fs';
import auditHandler from './api/audit.js';

// Load .env variables locally
if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf-8');
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/['"]/g, '');
      process.env[key] = val;
    }
  });
}

export default defineConfig({
  plugins: [
    svelte(),
    {
      name: 'local-api-middleware',
      configureServer(server) {
        server.middlewares.use('/api/audit', async (req, res) => {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
              try {
                req.body = JSON.parse(body);
              } catch (e) {
                req.body = {};
              }

              res.status = (code) => { res.statusCode = code; return res; };
              res.json = (data) => {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
              };

              await auditHandler(req, res);
            });
          } else {
            res.statusCode = 405;
            res.end('Method Not Allowed');
          }
        });
      }
    }
  ],
  server: {
    host: true,
    port: 5173
  }
});

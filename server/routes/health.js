import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
const pkg = JSON.parse(fs.readFileSync(path.join(config.root, 'package.json'), 'utf8'));
export default async function healthRoutes(app) {
  app.get('/api/health', async () => {
    const db = app.db.prepare('SELECT COUNT(*) AS n FROM pages').get();
    return { ok: true, version: pkg.version, db: 'ok', pages: db.n, time: new Date().toISOString() };
  });
}

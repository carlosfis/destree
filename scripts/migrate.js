// Aplica migraciones pendientes (server/db/migrations) y crea org/página por defecto.
import { openDb, migrate, seed } from '../server/db/sqlite.js';
import { config } from '../server/config.js';
const db = openDb();
const applied = migrate(db);
const pageId = seed(db);
db.close();
console.log(`migrate: ${config.dbPath} · aplicadas: ${applied.length ? applied.join(', ') : 'ninguna'} · página principal: ${pageId}`);

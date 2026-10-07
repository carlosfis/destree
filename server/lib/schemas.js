// Carga /schema/*.schema.json (draft-07). Fastify los registra con addSchema; tests/scripts usan createValidator().
import fs from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv';
import ajvFormats from 'ajv-formats';
import { config } from '../config.js';

export const AJV_OPTIONS = { strict: false, allErrors: true, coerceTypes: false, useDefaults: false };
export function loadSchemas(dir = config.schemaDir) {
  return fs.readdirSync(dir).filter(f => f.endsWith('.schema.json')).sort()
    .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
}
/** Ajv independiente de Fastify (misma configuración) con todos los schemas cargados. */
export function createValidator() {
  const ajv = new Ajv(AJV_OPTIONS);
  ajvFormats(ajv);
  for (const s of loadSchemas()) ajv.addSchema(s);
  return { ajv, validate: (id, data) => { const ok = ajv.validate(id, data); return { ok, errors: ok ? [] : ajv.errors }; } };
}
export const formatErrors = errs => (errs || []).map(e => ({ path: e.instancePath || '/', message: e.message, keyword: e.keyword, params: e.params }));

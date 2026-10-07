-- F7: elimina nodes.image_legacy. Guarda en db/sqlite.js: solo se aplica cuando la columna ya está vacía (lib/images.js#migrateLegacyImages la vacía al arrancar).
ALTER TABLE nodes DROP COLUMN image_legacy;

-- Thumbnail (PNG 1920×1080 para pegar en Figma): geografía (ISO 3166-1 alfa-2, '' = ninguna) e icono propio (images.id; NULL = usa image_id).
ALTER TABLE nodes ADD COLUMN geo TEXT NOT NULL DEFAULT '';
ALTER TABLE nodes ADD COLUMN thumb_icon_id TEXT;

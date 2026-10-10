-- Degradado de marca de las Main instances (id de preset en lib/normalize.js GRADIENTS; '' en cards anidadas). Sustituye a la imagen hero (image_id se conserva por compatibilidad con exports y versiones).
ALTER TABLE nodes ADD COLUMN gradient TEXT NOT NULL DEFAULT '';

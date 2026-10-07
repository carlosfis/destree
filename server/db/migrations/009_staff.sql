-- Equipo por card (usuario/rol) en el editor por pestañas: nodes.staff_json [{ name, role }]. owner_label se conserva igual a staff[0].name.
ALTER TABLE nodes ADD COLUMN staff_json TEXT NOT NULL DEFAULT '[]';

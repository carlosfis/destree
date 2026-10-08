-- P7: correo SMTP. invites.email_sent_at = cuándo se envió la invitación por correo (NULL = enlace copiado a mano).
-- password_resets: token de un solo uso (hash sha256; el token viaja solo en el enlace), caduca a la hora.
ALTER TABLE invites ADD COLUMN email_sent_at TEXT;
CREATE TABLE password_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX password_resets_user ON password_resets(user_id, used_at);

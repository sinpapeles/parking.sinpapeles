const Database = require("better-sqlite3");
const db = new Database("database.db", { verbose: console.log });

db.exec(`
CREATE TABLE IF NOT EXISTS domains (
    name text PRIMARY KEY,
    length integer,
    contact text,
    value text,
	views integer DEFAULT 0,
    clicks integer DEFAULT 0,
    active integer DEFAULT 1
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS length ON domains(length);
`);

try {
  db.exec(`ALTER TABLE domains ADD COLUMN first_block integer DEFAULT 0`);
  db.exec(`ALTER TABLE domains ADD COLUMN last_block integer DEFAULT 0`);
} catch (e) {
  console.log("first_block, last_block already exists");
}

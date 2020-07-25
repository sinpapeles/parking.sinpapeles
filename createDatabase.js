const Database = require("better-sqlite3");
const db = new Database("database.db", { verbose: console.log });

db.exec(`
CREATE TABLE IF NOT EXISTS domains (
    name text PRIMARY KEY,
    length integer,
    value text,
	views integer DEFAULT 0,
	clicks integer DEFAULT 0
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS length ON domains(length);
`);

try {
  db.exec(`
ALTER TABLE domains
ADD COLUMN active integer DEFAULT 1;
`);
} catch (e) {
  console.log('Column "active" already exists');
}

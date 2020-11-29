const Database = require('better-sqlite3');
const db = new Database('database.db', { verbose: console.log });
const { v4: uuid } = require('uuid');

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
    console.log('first_block, last_block already exists');
}

db.exec(`
CREATE TABLE IF NOT EXISTS auth (
    name text PRIMARY KEY,
    key text
) WITHOUT ROWID;
`);

db.exec(`
CREATE TABLE IF NOT EXISTS meta (
    name text PRIMARY KEY,
    content text
) WITHOUT ROWID;
`);

try {
    db.exec(`ALTER TABLE domains ADD COLUMN ga_code text`);
} catch (e) {
    console.log('ga_code already exists');
}

db.exec(`
CREATE TABLE IF NOT EXISTS contact (
    id text PRIMARY KEY,
    contact text UNIQUE
) WITHOUT ROWID;
`);

db.prepare('SELECT contact FROM `domains` group by contact')
    .all()
    .forEach(({ contact }) => {
        const id = uuid();

        db.prepare(`INSERT OR IGNORE INTO contact (id, contact) VALUES ($id, $contact)`).run({
            id,
            contact,
        });
    });

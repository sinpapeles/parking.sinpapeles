const Database = require('better-sqlite3');
const emojiRegex = require('emoji-regex');
const XRegExp = require('xregexp');

const databaseRegex = database => {
    const emojiExpression = `(${emojiRegex().source})`;

    XRegExp.addToken(/\\m/, () => emojiExpression, {
        scope: 'default',
    });

    database.function('REGEXP', { deterministic: true }, function (regex, str) {
        const r = XRegExp(decodeURIComponent(regex), 'i');
        const puny = getPunyCode(str);

        return r.test(str) || (puny && r.test(puny)) ? 1 : 0;
    });
};

const database = new Database('database.db', { verbose: console.log });
databaseRegex(database);

module.exports = database;

const { exec } = require("child_process");
const camelCase = require("camelcase");
const punycode = require("punycode");
const { tldExists, getDomain } = require("tldjs");

const DNS_SERVER = process.env.DNS_SERVER || "server.falci.me";
const DNS_PORT = process.env.DNS_PORT || "12053";
console.log({ DNS_SERVER, DNS_PORT });

// prettier-ignore
const CHARSET = new Uint8Array([
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0,
  0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,
  2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 4,
  0, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
  3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 0, 0, 0, 0, 0
]);

const verifyFullDomain = (str) => {
  if (typeof str !== "string") {
    return false;
  }

  return str.split(".").every(verifyString);
};

const verifyString = (str) => {
  if (typeof str !== "string") {
    return false;
  }

  if (str.length === 0) return false;

  if (str.length > 63) return false;

  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);

    // No unicode characters.
    if (ch & 0xff80) return false;

    const type = CHARSET[ch];

    switch (type) {
      case 0: // non-printable
        return false;
      case 1: // 0-9
        break;
      case 2: // A-Z
        return false;
      case 3: // a-z
        break;
      case 4: // - and _
        // Do not allow at end or beginning.
        if (i === 0 || i === str.length - 1) return false;
        break;
    }
  }

  return true;
};

const getTXT = (domain) =>
  new Promise((resolve, reject) => {
    if (!verifyFullDomain(domain)) {
      return new Promise.reject();
    }

    const command = `dig @${DNS_SERVER} -p ${DNS_PORT} ${domain} TXT +short`;
    exec(command, (error, out) => {
      if (error) {
        return reject(error);
      }

      resolve(
        out
          .split("\n")
          .map((line) => line.substring(1, line.length - 1))
          .filter((line) => line.indexOf("parking") === 0)
          .reduce((data, line) => {
            const [key, value] = line.split(/=(.+)/);
            const camel = camelCase(key);
            return { ...data, [camel]: value };
          }, {})
      );
    });
  });

const isLink = (txt) =>
  ["mailto:", "http://", "https://"].some(
    (protocol) => txt.indexOf(protocol) === 0
  );

const isPrice = (txt) => /^[0-9]{1,15}(\.[0-9]{1,8})? ?[A-Z]{1,5}$/.test(txt);

const getPunyCode = (txt) => {
  try {
    const punyCode = punycode.toUnicode(txt);
    return punyCode !== txt && punyCode;
  } catch (e) {
    return false;
  }
};

const getSubdomainSuggestion = (host) => {
  const parts = host.split(".");

  if (tldExists(host)) {
    const domain = getDomain(host);
    return host !== domain && domain;
  }

  if (parts.length > 1) {
    const [, ...suggestion] = parts;
    return suggestion.join(".");
  }
};

const getName = (db, domain) =>
  db.prepare("SELECT * FROM domains WHERE name = ?").get(domain);

const updateClicks = (db, domain) =>
  db.prepare("UPDATE domains SET clicks = clicks+1 WHERE name = ?").run(domain);

const updateViews = (db, domain) =>
  db.prepare("UPDATE domains SET views = views+1 WHERE name = ?").run(domain);

const saveName = (db, name, contact, value) => {
  try {
    return db
      .prepare(
        `INSERT INTO domains (name, length, contact, value, active)
                      VALUES ($name, $length, $contact, $value, $active)
                  ON CONFLICT(name)
                   DO UPDATE SET contact=$contact, value=$value, active=$active;`
      )
      .run({
        name,
        contact,
        value,
        length: name.length,
        active: !!value && !!contact ? 1 : 0,
      });
  } catch (e) {
    console.log(e);
  }
};

const list = (db) =>
  db
    .prepare(`SELECT * FROM domains ORDER BY name`)
    .all()
    .map((domain) => ({
      ...domain,
      punyCode: getPunyCode(domain.name),
    }));

module.exports = {
  list,
  getTXT,
  isLink,
  isPrice,
  getPunyCode,
  getSubdomainSuggestion,
  getName,
  updateViews,
  updateClicks,
  saveName,
  verifyString,
  verifyFullDomain,
};

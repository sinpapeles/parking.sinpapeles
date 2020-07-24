const { exec } = require("child_process");
const camelCase = require("camelcase");
const punycode = require("punycode");
const { tldExists, getDomain } = require("tldjs");

const DNS_SERVER = process.env.DNS_SERVER || "server.falci.me";
const DNS_PORT = process.env.DNS_PORT || "12053";
console.log({ DNS_SERVER, DNS_PORT });

const getTXT = (domain) =>
  new Promise((resolve, reject) => {
    if (!/^[a-z0-9-._]+$/.test(domain)) {
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
  ["mailto", "http", "https"].some(
    (protocol) => txt.indexOf(`${protocol}://`) === 0
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

const getStats = (db, domain, value) => {
  const stats = db
    .prepare("SELECT views, clicks FROM domains WHERE name = ?")
    .get(domain);

  if (!stats) {
    db.prepare(
      "INSERT INTO domains (name, length, value, views) VALUES (?, ?, ?, 1) "
    ).run(domain, domain.length, value);
    return { views: 0, clicks: 0 };
  } else {
    db.prepare(
      "UPDATE domains SET views = views+1, value=? WHERE name = ?"
    ).run(value, domain);

    return stats;
  }
};

const updateClicks = (db, domain) => {
  db.prepare("UPDATE domains SET clicks = clicks+1 WHERE name = ?").run(domain);
};

module.exports = {
  getTXT,
  isLink,
  isPrice,
  getPunyCode,
  getSubdomainSuggestion,
  getStats,
  updateClicks,
};

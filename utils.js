const { exec } = require("child_process");
const camelCase = require("camelcase");
const punycode = require("punycode");

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

module.exports = { getTXT, isLink, isPrice, getPunyCode };

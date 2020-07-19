const { exec } = require("child_process");

const DNS_SERVER = process.env.DNS_SERVER || "127.0.0.1";
console.log({ DNS_SERVER });

const getTXT = (domain) =>
  new Promise((resolve, reject) => {
    console.log({ domain });
    if (!/^[a-z0-9-._]+$/.test(domain)) {
      return new Promise.reject();
    }

    exec(`dig @${DNS_SERVER} ${domain} TXT +short`, (error, out) => {
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
            return { ...data, [key]: value };
          }, {})
      );
    });
  });

const isLink = (txt) =>
  ["mailto", "http", "https"].some(
    (protocol) => txt.indexOf(`${protocol}://`) === 0
  );

module.exports = { getTXT, isLink };

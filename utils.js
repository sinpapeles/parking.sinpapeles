const { exec } = require("child_process");

const DNS_SERVER = "192.168.1.55";

const getTXT = (domain) =>
  new Promise((resolve, reject) => {
    if (/^[a-z0-9-._]+$/.test(domain)) {
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

module.exports = { getTXT };

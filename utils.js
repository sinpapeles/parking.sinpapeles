const { exec } = require("child_process");
const camelCase = require("camelcase");
const handlebars = require("handlebars");
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

const saveName = (db, name, contact, value, height) => {
  try {
    return db
      .prepare(
        `INSERT INTO domains (name, length, contact, value, active, first_block, last_block)
                      VALUES ($name, $length, $contact, $value, $active, $height, $height)
                  ON CONFLICT(name)
                   DO UPDATE SET contact=$contact, value=$value, active=$active, last_block=$height;`
      )
      .run({
        name,
        contact,
        value,
        length: name.length,
        active: !!contact ? 1 : 0,
        height,
      });
  } catch (e) {
    console.log(e);
  }
};

const list = (db, { page = 1, start }) => {
  const where = ["active=1"];

  if (start) {
    if (start === "punycode") {
      where.push(`name LIKE 'xn--%'`);
    } else if (start === "number") {
      const condition = new Array(10)
        .fill(null)
        .map((_, i) => `name LIKE '${i}%'`)
        .join(" OR ");

      where.push(`(${condition})`);
    } else {
      where.push(`name LIKE '${start}%'`);
    }
  }

  const whereStr = where.join(" AND ");

  const { total } = db
    .prepare(`SELECT count(*) as total FROM domains WHERE ${whereStr}`)
    .get();
  const perPage = 25;
  const offset = perPage * (page - 1);

  const domains = db
    .prepare(
      `SELECT * FROM domains WHERE ${whereStr} ORDER BY name LIMIT ${offset}, ${perPage}`
    )
    .all()
    .map((domain) => ({
      ...domain,
      punyCode: getPunyCode(domain.name),
    }));

  const latest =
    !start && page === 1
      ? db
          .prepare(
            `SELECT * FROM domains WHERE active=1 AND last_block > 0 ORDER BY last_block DESC, value LIMIT 5`
          )
          .all()
          .map((domain) => ({
            ...domain,
            punyCode: getPunyCode(domain.name),
          }))
      : [];

  const popular =
    !start && page === 1
      ? db
          .prepare(
            `SELECT * FROM domains WHERE active=1 ORDER BY views DESC, clicks DESC, value LIMIT 5`
          )
          .all()
          .map((domain) => ({
            ...domain,
            punyCode: getPunyCode(domain.name),
          }))
      : [];

  return {
    pagination: {
      perPage,
      total,
      page,
    },
    domains,
    latest,
    popular,
  };
};

function isUnknownValue(arg1, options) {
  return !arg1 ? options.fn(this) : options.inverse(this);
}

const pageUrl = (p, query) => {
  const params = new URLSearchParams(query);
  params.set("page", p);
  return params.toString();
};

function pagintation({ page, total, perPage }, query) {
  const pages = Math.ceil(total / perPage);
  const maxButtons = 10;

  const offset =
    pages > maxButtons
      ? Math.max(
          Math.min(page - Math.ceil(maxButtons / 2), pages - maxButtons + 1),
          1
        )
      : 1;

  const buttons = new Array(Math.min(maxButtons, pages))
    .fill(null)
    .map((_, index) => index + offset);

  return new handlebars.SafeString(`
    <div class="d-flex justify-content-center">
      <ul class='pagination'>
        <li class='page-item ${page === 1 && "disabled"}'>
          <a class='page-link' href='?${pageUrl(1, query)}'>
            &laquo;
          </a>
        </li>
        ${buttons
          .map(
            (n) =>
              `<li class='page-item ${page === n && "active"}'>
              ${
                page === n
                  ? `<span class='page-link'>${n}</span>`
                  : `<a class='page-link' href='?${pageUrl(n, query)}'>${n}</a>`
              }

      </li>`
          )
          .join("")}
        <li class='page-item ${page === pages && "disabled"}'>
          <a class='page-link' href='?${pageUrl(pages, query)}'>
            &raquo;
          </a>
        </li>
      </ul>
    </div>`);
}

const startWithFilter = (start) => {
  // prettier-ignore
  const options = ["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z","number","punycode"];
  const label = {
    number: "#",
    punycode: "😄",
  };

  return new handlebars.SafeString(`<div class="align-items-end d-flex justify-content-between overflow-auto m-2 mb-3">
  ${start ? '<a href="/" class="btn btn-link">All</a>' : ""}
  ${options
    .map(
      (option) =>
        `<a href="?start=${option}" class="btn btn-${
          start === option ? "primary" : "link"
        }">${label[option] || option}</a>`
    )
    .join("")}
  </div>`);
};

const domainTable = (domains) =>
  domains && domains.length
    ? new handlebars.SafeString(`<table class="table"><tr>${domains
        .map(
          (domain) => `
  <td>
      <a href="/domain/${domain.name}/">${domain.name}
      ${domain.punyCode ? ` (${domain.punyCode})` : ""}
      </a>
  </td>
  <td>
  ${domain.value ? domain.value : "<em>Make offer</em>"}
  </td>
`
        )
        .join("</tr><tr>")}
</tr></table>`)
    : "";

const helpers = {
  isUnknownValue,
  pagintation,
  startWithFilter,
  domainTable,
};

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
  helpers,
};

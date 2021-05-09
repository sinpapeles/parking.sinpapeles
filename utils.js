const handlebars = require('handlebars');
const punycode = require('punycode');
const { Remarkable } = require('remarkable');
const { tldExists, getDomain } = require('tldjs');
const { URL } = require('url');
const { v4: uuid } = require('uuid');
const db = require('./database');
const config = require('config');
const axios = require('axios');
const { parseTweet } = require('twitter-text');
const Twitter = require('twitter');

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

const verifyFullDomain = str => {
    if (typeof str !== 'string') {
        return false;
    }

    return str.split('.').every(verifyString);
};

const verifyString = str => {
    if (typeof str !== 'string') {
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

const isLink = txt =>
    !!txt && ['mailto:', 'http://', 'https://'].some(protocol => txt.indexOf(protocol) === 0);

const isPrice = txt => !!txt && /^[0-9]{1,15}(\.[0-9]{1,8})? ?[A-Z]{1,5}$/.test(txt);

const isAuth = txt => !!txt && /^[0-9a-f]{66}$/.test(txt);

// return punycode or false
const getPunyCode = txt => {
    try {
        const punyCode = punycode.toUnicode(txt);
        return punyCode !== txt && punyCode;
    } catch (e) {
        return false;
    }
};

// returns punycode + name or just name
const getPunycode = name => {
    try {
        const p = punycode.toUnicode(name);
        return p === name ? name : `${p} ${name}`;
    } catch (e) {
        return name;
    }
};

const getSubdomainSuggestion = host => {
    const parts = host.split('.');

    if (tldExists(host)) {
        const domain = getDomain(host);
        return host !== domain && domain;
    }

    if (parts.length > 1) {
        const [, ...suggestion] = parts;
        return suggestion.join('.');
    }
};

const getName = domain =>
    db
        .prepare(
            `       SELECT d.*, m.content, c.id as seller
                FROM domains d
           LEFT JOIN meta m ON m.name=d.name
           LEFT JOIN contact c ON c.contact=d.contact
               WHERE d.name = ? AND d.active=1`
        )
        .get(domain);

const updateClicks = domain =>
    db.prepare('UPDATE domains SET clicks = clicks+1 WHERE name = ?').run(domain);

const updateViews = domain =>
    db.prepare('UPDATE domains SET views = views+1 WHERE name = ?').run(domain);

const saveName = (name, contact, value, height) => {
    const active = !!contact ? 1 : 0;

    try {
        if (active) {
            db.prepare('INSERT OR IGNORE INTO contact (id, contact) VALUES ($id, $contact)').run({
                id: uuid(),
                contact,
            });

            return db
                .prepare(
                    `INSERT INTO domains (name, length, contact, value, active, first_block, last_block)
                      VALUES ($name, $length, $contact, $value, 1, $height, $height)
                  ON CONFLICT(name)
                   DO UPDATE SET contact=$contact, value=$value, active=1, last_block=$height;`
                )
                .run({
                    name,
                    contact,
                    value,
                    length: name.length,
                    height,
                });
        } else {
            return db
                .prepare('UPDATE domains SET last_block=$height, active=0 WHERE name=$name')
                .run({ height, name });
        }
    } catch (e) {
        console.log(e);
    }
};

const saveAuth = (name, auth) => {
    try {
        if (auth) {
            return db
                .prepare(
                    `INSERT INTO auth (name, key) VALUES ($name, $auth)
               ON CONFLICT(name)
               DO UPDATE SET key=$auth;`
                )
                .run({ name, auth });
        } else {
            return db.prepare('DELETE FROM auth WHERE name=$name').run({ name });
        }
    } catch (e) {
        console.log(e);
    }
};

const list = ({ page = 1, start, search, seller }) => {
    const where = ['active=?'];
    const params = [1];

    if (search) {
        where.push(`name REGEXP ?`);
        params.push(search);
    }

    if (start) {
        if (start === 'punycode') {
            where.push(`name LIKE ?`);
            params.push('xn--%');
        } else if (start === 'number') {
            const condition = new Array(10)
                .fill(null)
                .map((_, i) => `name LIKE '${i}%'`)
                .join(' OR ');

            where.push(`(${condition})`);
        } else {
            where.push(`name LIKE ?`);
            params.push(`${start}%`);
        }
    }

    if (seller) {
        where.push(`c.id = ?`);
        params.push(seller);
    }

    const hasFilters = !!search || !!start || !!seller;

    const whereStr = where.join(' AND ');

    const { total } = db
        .prepare(
            `SELECT count(d.name) as total FROM domains d
              LEFT JOIN contact c ON c.contact=d.contact
                  WHERE ${whereStr}`
        )
        .get(...params);
    const perPage = 25;
    const offset = perPage * (page - 1);

    const domains = db
        .prepare(
            `SELECT d.* FROM domains d
          LEFT JOIN contact c ON c.contact=d.contact
              WHERE ${whereStr}
              ORDER BY name
              LIMIT ${offset}, ${perPage}`
        )
        .all(...params)
        .map(domain => ({
            ...domain,
            punyCode: getPunyCode(domain.name),
        }));
    domains.showScore = true;

    const latest =
        !hasFilters && page === 1
            ? db
                  .prepare(
                      `SELECT * FROM domains WHERE active=1 AND last_block > 0 ORDER BY last_block DESC, value LIMIT 5`
                  )
                  .all()
                  .map(domain => ({
                      ...domain,
                      punyCode: getPunyCode(domain.name),
                  }))
            : [];

    const popular =
        !hasFilters && page === 1
            ? db
                  .prepare(
                      `SELECT * FROM domains WHERE active=1 ORDER BY views DESC, clicks DESC, value LIMIT 5`
                  )
                  .all()
                  .map(domain => ({
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
    params.set('page', p);
    return params.toString();
};

function pagintation({ page, total, perPage }, query) {
    const pages = Math.ceil(total / perPage);
    const maxButtons = 10;

    const offset =
        pages > maxButtons
            ? Math.max(Math.min(page - Math.ceil(maxButtons / 2), pages - maxButtons + 1), 1)
            : 1;

    const buttons = new Array(Math.min(maxButtons, pages))
        .fill(null)
        .map((_, index) => index + offset);

    return new handlebars.SafeString(`
    <div class="d-flex justify-content-center">
      <ul class='pagination'>
        <li class='page-item ${page === 1 && 'disabled'}'>
          <a class='page-link' href='?${pageUrl(1, query)}'>
            &laquo;
          </a>
        </li>
        ${buttons
            .map(
                n =>
                    `<li class='page-item ${page === n && 'active'}'>
              ${
                  page === n
                      ? `<span class='page-link'>${n}</span>`
                      : `<a class='page-link' href='?${pageUrl(n, query)}'>${n}</a>`
              }

      </li>`
            )
            .join('')}
        <li class='page-item ${page === pages && 'disabled'}'>
          <a class='page-link' href='?${pageUrl(pages, query)}'>
            &raquo;
          </a>
        </li>
      </ul>
    </div>`);
}

const startWithFilter = (start, hasOtherFilters) => {
    // prettier-ignore
    const options = ["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z","number","punycode"];
    const label = {
        number: '#',
        punycode: '😄',
    };

    return new handlebars.SafeString(`<div class="align-items-end d-flex justify-content-between overflow-auto mb-3">
  ${start || hasOtherFilters ? '<a href="/" class="btn btn-link">All</a>' : ''}
  ${options
      .map(
          option =>
              `<a href="?start=${option}" class="btn btn-${
                  start === option ? 'primary' : 'link'
              }">${label[option] || option}</a>`
      )
      .join('')}
  </div>`);
};

const domainTable = domains =>
    domains && domains.length
        ? new handlebars.SafeString(`<table class="table"><tr>${domains
              .map(
                  domain => `
  <td class="col-name ${domain.punyCode ? 'col-puny' : ''}">
  ${domain.punyCode ? `${domain.punyCode} &nbsp;` : ''}
      <a href="/domain/${domain.name}/">
      ${domain.name}
      </a>
  </td>
  ${
      domains.showScore
          ? `<td><a href="https://www.niami.io/domain/${domain.name}" target="_blank" rel="noopener noreferrer" title="Check the Niami's score">Score</a></td>`
          : ''
  }
  <td class="text-nowrap">
  ${domain.value ? domain.value : '<em>Make offer</em>'}
  </td>
`
              )
              .join('</tr><tr>')}
</tr></table>`)
        : '';

const md = new Remarkable();
const markdown = content => new handlebars.SafeString(md.render(content));

const helpers = {
    isUnknownValue,
    pagintation,
    startWithFilter,
    domainTable,
    markdown,
};

const richContact = (contact, name) => {
    const url = new URL(contact);
    const { searchParams } = url;

    if (url.protocol === 'mailto:' && !searchParams.has('subject')) {
        searchParams.set('subject', `Parking.Sinpapeles: ${name}`);
    }

    if (url.protocol.startsWith('http')) {
        Object.entries({
            utm_source: 'parking.sinpapeles',
            utm_medium: name,
            utm_campaign: 'get_in_touch',
        })
            .filter(([key]) => !searchParams.has(key))
            .forEach(([key, value]) => searchParams.set(key, value));
    }

    return url.href.replace('+', '%20');
};

const getNewNames = height =>
    db.prepare(`SELECT name FROM domains WHERE active=1 AND first_block=?`).all(height);

const sendTelegram = message => {
    const { token, channel } = config.telegram;
    axios
        .post(`https://api.telegram.org/bot${token}/sendMessage`, {
            chat_id: channel,
            text: message,
            parse_mode: 'MarkdownV2',
            disable_notification: true,
        })
        .catch(e => console.log(e.response.data));
};

const sentTwitter = async status => new Twitter(config.twitter).post('statuses/update', { status });

const processAndSendTwitter = parking => {
    const domains = parking.length > 1 ? 'domains' : 'domain';
    const hashtag = `\n\n#HNS`;

    let twitterText = `${parking.length} new ${domains} added to Parking.Sinpapeles:`;
    for (let i = 0; i < parking.length; i++) {
        const next = getPunycode(parking[i].name);
        const more = i < parking.length - 1 ? '\nand more...' : '';

        if (parseTweet(`${twitterText}\n${next}${more}${hashtag}`).valid) {
            twitterText += `\n${next}`;
        } else {
            twitterText += '\nand more...';
            break;
        }
    }
    twitterText += hashtag;

    sentTwitter(twitterText).catch(e => console.log(e));
};

module.exports = {
    getName,
    getNewNames,
    getPunyCode,
    getPunycode,
    getSubdomainSuggestion,
    helpers,
    isAuth,
    isLink,
    isPrice,
    list,
    processAndSendTwitter,
    richContact,
    saveAuth,
    saveName,
    sendTelegram,
    updateClicks,
    updateViews,
    verifyFullDomain,
    verifyString,
};

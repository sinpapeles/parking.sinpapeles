const config = require('config').hsd;
const debug = require('debug')('parking.sinpapeles:hsd');
const { NodeClient } = require('hs-client');
const camelCase = require('camelcase');

const client = new NodeClient(config);

if (client) {
    client.on('error', e => debug(e));
    client.on('connect', () => debug('WS connected'));
}

const getTxByConvenants = async (height, ...convenants) => {
    const { tx } = await client.execute('getblockbyheight', [height, 1, 1]);

    return tx.flatMap(({ vout }) => vout.filter(out => convenants.includes(out.covenant.action)));
};

const getParking = async height => {
    const txs = await getTxByConvenants(height, 'UPDATE', 'REGISTER', 'TRANSFER', 'REVOKE');

    const promises = txs.map(async tx => {
        const [nameHash] = tx.covenant.items;
        const name = await client.execute('getnamebyhash', [nameHash]);
        const resource = await client.execute('getnameresource', [name]);

        if (!resource || !resource.records) {
            return { name, txt: {} };
        }

        // prettier-ignore
        const txt = resource.records
                .filter(record =>record.type === 'TXT')
                .flatMap(({ txt }) => txt)
                .filter(txt => txt.startsWith('parking') || txt.startsWith('auth='))
                .reduce((data, txt) => {
                    const [key, value] = txt.split(/=(.+)/);
                    const camel = camelCase(key);
                    return { ...data, [camel]: value };
                  }, {});

        return { name, txt };
    });

    return await Promise.all(promises);
};

module.exports = {
    client,
    getTxByConvenants,
    getParking,
};

const debug = require('debug')('parking.sinpapeles:ws');
const { client, getParking } = require('./services/hsd');
const { ChainEntry } = require('hsd');
const {
    isLink,
    isPrice,
    isAuth,
    saveName,
    saveAuth,
    getNewNames,
    getPunycode,
    sendTelegram,
} = require('./utils');

module.exports = async () => {
    await client.open();
    return () => client.close();
};

client.bind('chain connect', async raw => {
    const { height } = ChainEntry.fromRaw(raw);
    debug(`New block: ${height}`);
    onNewBlock(height);
});

// onNewBlock(62579);

const onNewBlock = async height => {
    const data = await getParking(height);

    data.map(({ name, txt }) => {
        const contact = isLink(txt.parking) ? txt.parking : null;
        const value = isPrice(txt.parkingValue) ? txt.parkingValue : '';
        const auth = isAuth(txt.auth) ? txt.auth : '';

        saveName(name, contact, value, height);
        saveAuth(name, auth);
    });

    const parking = getNewNames(height);
    console.log(parking);

    if (parking.length) {
        sendTelegram(`*Parking Sinpapeles:* ${parking.length} new domain\\(s\\):
${parking.map(p => getPunycode(p.name).replace(/-/g, '\\-').replace(/_/g, '\\_')).join('\n')}`);
    }
};

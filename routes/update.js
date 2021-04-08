const fs = require('fs');
const jwt = require('jsonwebtoken');
const express = require('express');
const router = express.Router();
const { isLink, isPrice, isAuth, saveName, saveAuth } = require('../utils');

const cert = fs.readFileSync('public.pem'); // get public key

router.post('/update', (req, res) => {
    const { token } = req.body;

    jwt.verify(token, cert, function (err, { data }) {
        if (err) {
            return res.status(400).json({ err });
        }

        data.forEach(({ name, txt, height }) => {
            const contact = isLink(txt.parking) ? txt.parking : null;
            const value = isPrice(txt.parkingValue) ? txt.parkingValue : '';
            const auth = isAuth(txt.auth) ? txt.auth : '';

            saveName(name, contact, value, height);
            saveAuth(name, auth);
        });

        res.json({ data });
    });
});

module.exports = router;

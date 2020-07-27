const fs = require("fs");
const jwt = require("jsonwebtoken");
const express = require("express");
const router = express.Router();
const { isLink, isPrice, saveName } = require("../utils");

const cert = fs.readFileSync("public.pem"); // get public key

router.post("/update", (req, res) => {
  const { token } = req.body;

  jwt.verify(token, cert, function (err, { data }) {
    if (err) {
      return res.status(400).json({ err });
    }

    data.forEach(({ name, txt }) => {
      const contact = isLink(txt.parking) ? txt.parking : null;
      const value = isPrice(txt.parkingValue) ? txt.parkingValue : 0;

      saveName(req.db, name, contact, value);
    });

    res.json({ data });
  });
});

module.exports = router;

const express = require("express");
const router = express.Router();
const update = require("./update");
const { getTXT, isLink, isPrice } = require("../utils");

router.use(update);

router.get("/", async (req, res, next) => {
  const host = req.get("host");

  if (host === "parking.sinpapeles") {
    res.render("index");
  }

  const data = await getTXT(host).catch(() => false);
  if (data.parking && isLink(data.parking)) {
    const hasPrice = isPrice(data.parkingValue);

    res.render("parking", {
      host,
      contact: data.parking,
      hasPrice,
      price: data.parkingValue,
    });
  } else {
    res.render("missing", { host });
  }
});

module.exports = router;

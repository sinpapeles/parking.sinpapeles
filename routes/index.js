const express = require("express");
const router = express.Router();
const update = require("./update");
const {
  getTXT,
  isLink,
  isPrice,
  getPunyCode,
  getSubdomainSuggestion,
} = require("../utils");

router.use(update);

router.get("/", async (req, res, next) => {
  const host = req.get("host");

  if (host === "parking.sinpapeles") {
    res.render("index");
  }

  const data = await getTXT(host).catch(() => false);

  if (data.parking && isLink(data.parking)) {
    const hasPrice = isPrice(data.parkingValue);
    const punyCode = getPunyCode(host);

    res.render("parking", {
      host,
      contact: data.parking,
      hasPrice,
      price: data.parkingValue,
      punyCode,
    });
  } else {
    res.render("missing", { host, suggestion: getSubdomainSuggestion(host) });
  }
});

module.exports = router;

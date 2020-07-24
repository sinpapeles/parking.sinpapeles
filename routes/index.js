const express = require("express");
const router = express.Router();
const update = require("./update");
const {
  getTXT,
  isLink,
  isPrice,
  getPunyCode,
  getSubdomainSuggestion,
  getStats,
  updateClicks,
} = require("../utils");

router.use(update);

router.get("/", async (req, res) => {
  const host = encodeURIComponent(req.get("host"));

  if (host === "parking.sinpapeles") {
    res.render("index");
  }

  const data = await getTXT(host).catch(() => false);

  if (data.parking && isLink(data.parking)) {
    const hasPrice = isPrice(data.parkingValue);
    const punyCode = getPunyCode(host);

    const stats = getStats(req.db, host, data.parkingValue);

    res.cookie("contact", data.parking);
    res.render("parking", {
      host,
      hasPrice,
      price: data.parkingValue,
      punyCode,
      stats,
    });
  } else {
    res.render("missing", { host, suggestion: getSubdomainSuggestion(host) });
  }
});

router.get("/contact", async (req, res) => {
  const host = encodeURIComponent(req.get("host"));
  const { contact } = req.cookies;

  if (contact) {
    updateClicks(req.db, host);
    return res.redirect(contact);
  }

  res.redirect("/");
});

module.exports = router;

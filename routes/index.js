const express = require("express");
const router = express.Router();
const update = require("./update");
const {
  updateViews,
  isPrice,
  getPunyCode,
  getSubdomainSuggestion,
  getName,
  updateClicks,
  list,
} = require("../utils");

router.use(update);

router.get("/", async (req, res, next) => {
  const host = encodeURIComponent("xn--um8h" || req.get("host"));

  if (host === "parking.sinpapeles" || host === "localhost%3A2000") {
    next();
    return;
  }

  const data = await getName(req.db, host);

  if (data && data.contact) {
    const hasPrice = isPrice(data.value);
    const punyCode = getPunyCode(host);

    updateViews(req.db, host);

    res.render("parking", {
      host,
      hasPrice,
      price: data.value,
      punyCode,
      stats: {
        clicks: data.clicks,
        views: data.views,
      },
    });
  } else {
    res.render("missing", { host, suggestion: getSubdomainSuggestion(host) });
  }
});

router.get("/contact", async (req, res) => {
  const host = encodeURIComponent(req.get("host"));
  const data = await getName(req.db, host);

  if (data && data.contact) {
    updateClicks(req.db, host);
    return res.redirect(data.contact);
  }

  res.redirect("/");
});

router.get("/", (req, res) => {
  const domains = list(req.db);
  res.render("list", { domains });
});

router.get("/about", (req, res) => {
  res.render("about");
});

router.get("/donate", (req, res) => {
  res.render("donate");
});

module.exports = router;

const express = require("express");
const router = express.Router();
const api = require("./api");
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

router.use("/api", api);
router.use(update);

const index = async (h, req, res) => {
  const host = encodeURIComponent(h);
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
      content: data.content,
      stats: {
        clicks: data.clicks,
        views: data.views,
      },
    });
  } else {
    res.render("missing", {
      host,
      suggestion: getSubdomainSuggestion(host),
    });
  }
};

router.get("/", async (req, res, next) => {
  const host = req.get("host").replace(/^www\./, "");

  if (
    ["parking.sinpapeles", "parking.sinpapeles.xyz", "localhost:2000"].includes(
      host
    )
  ) {
    next();
    return;
  }

  index(host, req, res);
});

router.get("/domain/:host", (req, res) => {
  const { host } = req.params;

  index(host, req, res);
});

router.get("/contact/:host", async (req, res) => {
  const host = encodeURIComponent(req.params.host);
  const data = await getName(req.db, host);

  if (data && data.contact) {
    updateClicks(req.db, host);
    return res.redirect(data.contact);
  }

  res.redirect("/");
});

router.get("/", (req, res) => {
  const { query } = req;
  const { page, start } = query;
  const data = list(req.db, {
    page: parseInt(page || 1),
    start: encodeURIComponent(start || ""),
  });

  res.render("list", { ...data, query });
});

router.get("/about", (req, res) => {
  res.render("about");
});

router.get("/donate", (req, res) => {
  res.render("donate");
});

module.exports = router;

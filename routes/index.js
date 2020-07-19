const express = require("express");
const router = express.Router();
const { getTXT } = require("../utils");

router.get("/", async (req, res, next) => {
  const host = req.get("host");

  if (host === "parking.sinpapeles") {
    res.render("index");
  }

  const data = await getTXT(host).catch(() => false);
  if (data.parking) {
    res.render("parking", { host, contact: data.parking });
  } else {
    res.render("missing", { host });
  }
});

module.exports = router;

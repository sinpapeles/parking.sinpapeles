const express = require("express");
const authMW = require("../middleware/auth");
const ownerMW = require("../middleware/owner");
const router = express.Router();

router.get("/domains", authMW, (req, res) => {
  const { key } = req.auth;

  const sql = `SELECT a.name, d.views, d.clicks, d.value
                 FROM auth AS a
            LEFT JOIN domains AS d ON d.name=a.name
                WHERE a.key=$key
             ORDER BY a.name`;

  const items = req.db.prepare(sql).all({ key });
  res.json(items);
});

router.get("/domains/:domain", ownerMW, (req, res) => {
  const domain = encodeURIComponent(req.params.domain);
  const { key } = req.auth;

  const sql = `SELECT a.name, m.content
                 FROM auth AS a
            LEFT JOIN meta AS m ON m.name=a.name
                WHERE a.key=$key
                  AND a.name=$domain`;

  const data = req.db.prepare(sql).get({ key, domain });
  res.json(data);
});

router.post("/domains/:domain", ownerMW, (req, res) => {
  const domain = encodeURIComponent(req.params.domain);
  const { content } = req.body;

  const sql = `INSERT INTO meta (name, content) VALUES ($domain, $content)
                   ON CONFLICT(name)
                   DO UPDATE SET content=$content;`;

  req.db.prepare(sql).run({ domain, content });
  res.status(204).end();
});

module.exports = router;

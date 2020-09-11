const auth = require("./auth");

module.exports = (req, res, next) =>
  auth(req, res, () => {
    const domain = encodeURIComponent(req.params.domain);
    const { key } = req.auth;

    // prettier-ignore
    const validate = req.db.prepare(`
                        SELECT name
                          FROM auth
                         WHERE auth.key=$key
                           AND auth.name=$domain`
                        ).get({ domain, key});

    if (!validate || validate.name !== domain) {
      res.status(401).json({ message: "Domain auth validation failed" });
    } else {
      next();
    }
  });

const config = require("config");
const jwt = require("jsonwebtoken");

const secret = config.get("auth.secret");

module.exports = (req, res, next) => {
  const token = req.header("authorization");

  if (!token) {
    res.status(403).json({ message: "Auth required" }).end();
    return;
  }

  try {
    const { exp, ...auth } = jwt.verify(token, secret);
    req.auth = auth;

    const nextToken = jwt.sign(auth, secret, { expiresIn: "30m" });
    res.header("Authentication", nextToken);

    next();
  } catch (e) {
    res.status(403).json({ message: "Auth token invalid" }).end();
  }
};

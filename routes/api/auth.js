const express = require("express");
const router = express.Router();
const config = require("config");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const secret = config.get("auth.secret");
const random = require("bcrypto/lib/random");
const secp256k1 = require("bcrypto/lib/secp256k1");

router.get("/auth", (req, res) => {
  const data = {
    challenge: random.randomBytes(32).toString("hex"),
  };

  data.token = jwt.sign(data, secret);

  res.json(data);
});

router.post("/auth", async (req, res) => {
  const { domain, key, challenge, signature, token } = req.body;
  const error = (message = "Invalid request") =>
    res.status(403).json({ message });

  // all required fields are present?
  if (!domain || !key || !challenge || !signature || !token) {
    return error();
  }

  try {
    // JWT still valid?
    const auth = jwt.verify(token, secret);

    // Same challenge?
    if (auth.challenge !== challenge) {
      return error("Invalid token challenge");
    }
  } catch (e) {
    return error("Invalid token");
  }

  // What about the signature?
  const isValidSignature = secp256k1.verify(
    Buffer.from(challenge, "hex"),
    Buffer.from(signature, "hex"),
    Buffer.from(key, "hex")
  );

  if (!isValidSignature) {
    return error("Invalid signature");
  }

  // domain resolve to key ?
  const { data } = await axios.post("https://auth.sinpapeles.xyz/api", {
    domain,
  });
  if (data.key !== key) {
    return error("Domain did not return the same public key");
  }

  // seems legit
  const session = { domain, key };
  session.token = jwt.sign(session, secret);

  res.json(session);
});

module.exports = router;

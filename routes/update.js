const express = require("express");
const { v4: uuid } = require("uuid");
const axios = require("axios");
const router = express.Router();
const { updateStatus, verifyFullDomain } = require("../utils");

const memory = {};

router.post("/update", (req, res) => {
  const { names } = req.body;

  names
    .filter((name) => verifyFullDomain(name))
    .forEach(async (name) => {
      const secret = uuid();
      memory[name] = secret;

      try {
        const { code } = (await axios.get(`http://${name}/update`)).data;
        const isValid = code === secret;
        updateStatus(req.body, name, isValid);
      } catch (e) {
        updateStatus(req.body, name, false);
        console.error(e);
      }

      delete memory[name];
    });

  res.json({ ok: true });
});

router.get("/update", (req, res) => {
  const host = req.get("host");
  res.json({ code: memory[host] });
});

module.exports = router;

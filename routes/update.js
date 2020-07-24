const express = require("express");
const { v4: uuid } = require("uuid");
const axios = require("axios");
const router = express.Router();

const memory = {};

router.post("/update", (req, res) => {
  const { names } = req.body;

  names.forEach(async (name) => {
    const secret = uuid();
    memory[name] = secret;

    try {
      const { code } = (await axios.get(`http://${name}/update`)).data;
      const isValid = code === secret;
      // update database: {name, isValid}

      console.log({ name, isValid });
    } catch (e) {
      // remove from database
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

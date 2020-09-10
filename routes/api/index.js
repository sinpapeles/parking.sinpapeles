const express = require("express");
const auth = require("./auth");

const router = express.Router();

router.use(auth);

module.exports = router;

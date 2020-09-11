const express = require("express");
const auth = require("./auth");
const domains = require("./domains");

const router = express.Router();

router.use(auth);
router.use(domains);

module.exports = router;

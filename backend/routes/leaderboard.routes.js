'use strict';
const express             = require('express');
const router              = express.Router();
const ctrl                = require('../controllers/leaderboard.controller');
const { leaderboardLimiter } = require('../middleware/rateLimiter');

router.get('/', leaderboardLimiter, ctrl.getLeaderboard);

module.exports = router;

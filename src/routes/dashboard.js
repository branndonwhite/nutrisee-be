const express = require('express');
const router = express.Router();
const { getAIOverview, getDailyStats } = require('../controllers/dashboardController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/ai-overview', protect, getAIOverview);
router.get('/daily-stats', protect, getDailyStats);

module.exports = router;
const express = require('express');
const router = express.Router();
const { getAIOverview } = require('../controllers/dashboardController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/ai-overview', protect, getAIOverview);

module.exports = router;
const express = require('express');
const router = express.Router();
const { uploadProfileImage, getProfile, getAITips, getWeeklyStats, getWeightTarget } = require('../controllers/profileController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/',              protect, getProfile);
router.post('/avatar',       protect, uploadProfileImage);
router.get('/ai-tips',       protect, getAITips);
router.get('/weekly-stats',  protect, getWeeklyStats);
router.get('/weight-target', protect, getWeightTarget);

module.exports = router;
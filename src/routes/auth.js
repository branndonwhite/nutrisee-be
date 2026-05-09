const express = require('express');
const router = express.Router();
const { authenticate, completeProfile, checkProfile } = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/authenticate', authenticate);
router.post('/profile', protect, completeProfile);
router.get('/check', protect, checkProfile);

module.exports = router;
const express = require('express');
const router = express.Router();
const { register, completeProfile } = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/register', register);
router.post('/profile', protect, completeProfile);

module.exports = router;
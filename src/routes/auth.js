const express = require('express');
const router = express.Router();
const { authenticate, completeProfile } = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/authenticate', authenticate);   // replaces /register + /login
router.post('/profile', protect, completeProfile);

module.exports = router;
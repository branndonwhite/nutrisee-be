const express = require('express');
const router = express.Router();
const { getRestrictions, saveUserRestrictions } = require('../controllers/dietaryController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/', getRestrictions);                        // public - no auth needed
router.post('/user', protect, saveUserRestrictions);     // protected - needs token

module.exports = router;
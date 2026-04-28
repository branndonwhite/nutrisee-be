const express = require('express');
const router = express.Router();
const { getBadges, markShared } = require('../controllers/badgesController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/', protect, getBadges);
router.post('/shared', protect, markShared);

module.exports = router;
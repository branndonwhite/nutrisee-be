const express = require('express');
const router = express.Router();
const { getProfile, updateProfile } = require('../controllers/profileController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/', protect, getProfile);
router.put('/', protect, updateProfile);

module.exports = router;
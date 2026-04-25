const express = require('express');
const router = express.Router();
const { uploadProfileImage, getProfile } = require('../controllers/profileController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/',            protect, getProfile);           // GET  /api/profile
router.post('/avatar',     protect, uploadProfileImage);   // POST /api/profile/avatar

module.exports = router;
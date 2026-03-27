const express = require('express');
const router = express.Router();
const { getRandomFact } = require('../controllers/factsController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/random', protect, getRandomFact);

module.exports = router;
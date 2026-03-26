const express = require('express');
const router = express.Router();
const { analyzeMeal, logMeal, getMealHistory } = require('../controllers/mealController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/analyze', protect, analyzeMeal);        // no auth needed for analysis
router.post('/log', protect, logMeal);       // auth required to save
router.get('/history', protect, getMealHistory);

module.exports = router;
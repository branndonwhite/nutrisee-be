const express = require('express');
const router = express.Router();
const { analyzeMeal, logMeal, getMealHistory, analyzeTextMeal } = require('../controllers/mealController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/analyze', protect, analyzeMeal);        
router.post('/analyze-text', protect, analyzeTextMeal);
router.post('/log', protect, logMeal);       
router.get('/history', protect, getMealHistory);

module.exports = router;
const express = require('express');
const router = express.Router();
const { analyzeMeal, logMeal, getMealHistory, analyzeTextMeal, uploadImage, analyzeMealCombined } = require('../controllers/mealController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/analyze', protect, analyzeMeal);
router.patch('/analyze', protect, analyzeMealCombined);
router.post('/analyze-text', protect, analyzeTextMeal);
router.post('/log', protect, logMeal);
router.get('/history', protect, getMealHistory);
router.post('/upload-image', protect, uploadImage);

module.exports = router;
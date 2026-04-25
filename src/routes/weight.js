const express = require('express');
const router = express.Router();
const {
  logWeight,
  getWeightHistory,
  getWeightGoal,
  updateWeightGoal,
  deleteWeightEntry,
} = require('../controllers/weightController');
const { protect } = require('../middlewares/authMiddleware');

// All routes are protected
router.post('/log',         protect, logWeight);          // POST   /api/weight/log
router.get('/history',      protect, getWeightHistory);   // GET    /api/weight/history?limit=30
router.get('/goal',         protect, getWeightGoal);      // GET    /api/weight/goal
router.put('/goal',         protect, updateWeightGoal);   // PUT    /api/weight/goal
router.delete('/log/:id',   protect, deleteWeightEntry);  // DELETE /api/weight/log/:id

module.exports = router;
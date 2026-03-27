const pool = require('../db');
const calculateCalorieGoal = require('../utils/calculateCalorieGoal');

const getProfile = async (req, res) => {
  const userId = req.user.userId;

  try {
    const result = await pool.query(
      `SELECT 
        u.email,
        up.nickname,
        up.gender,
        TO_CHAR(up.date_of_birth, 'YYYY-MM-DD') as date_of_birth,
        up.height,
        up.weight,
        up.daily_calorie_goal
       FROM users u
       JOIN user_profiles up ON u.id = up.user_id
       WHERE u.id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const profile = result.rows[0];

    res.json({
      profile: {
        ...profile,
        height: parseFloat(profile.height),
        weight: parseFloat(profile.weight),
        daily_calorie_goal: parseFloat(profile.daily_calorie_goal),
      }
    });
  } catch (err) {
    console.error('getProfile error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

const updateProfile = async (req, res) => {
  const userId = req.user.userId;
  const { nickname, gender, date_of_birth, height, weight } = req.body;

  if (!nickname || !gender || !date_of_birth || !height || !weight) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    // Recalculate calorie goal with new data
    const dailyCalorieGoal = calculateCalorieGoal(weight, height, date_of_birth, gender);

    const result = await pool.query(
      `UPDATE user_profiles
       SET nickname = $1,
           gender = $2,
           date_of_birth = $3::date,
           height = $4,
           weight = $5,
           daily_calorie_goal = $6
       WHERE user_id = $7
       RETURNING id, user_id, nickname, gender,
       TO_CHAR(date_of_birth, 'YYYY-MM-DD') as date_of_birth,
       height, weight, daily_calorie_goal`,
      [nickname, gender, date_of_birth, height, weight, dailyCalorieGoal, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const profile = result.rows[0];

    res.json({
      profile: {
        ...profile,
        height: parseFloat(profile.height),
        weight: parseFloat(profile.weight),
        daily_calorie_goal: parseFloat(profile.daily_calorie_goal),
      }
    });
  } catch (err) {
    console.error('updateProfile error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { getProfile, updateProfile };
const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const calculateCalorieGoal = require('../utils/calculateCalorieGoal');

const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

// ─── Unified: register if new, login if exists ───────────────────────────────
const authenticate = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const existing = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    // ── Existing user → login ──────────────────────────────────────────────
    if (existing.rows.length > 0) {
      const user = existing.rows[0];
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Kata sandi salah' });
      }

      const profileResult = await pool.query(
        'SELECT id FROM user_profiles WHERE user_id = $1',
        [user.id]
      );
      const hasProfile = profileResult.rows.length > 0;

      return res.json({
        token: signToken(user.id),
        user: { id: user.id, email: user.email },
        isNewUser: false,
        hasProfile,
      });
    }

    // ── New user → register ────────────────────────────────────────────────
    if (password.length < 8) {
      return res.status(400).json({ error: 'Kata sandi minimal 8 karakter' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (email, password, provider)
       VALUES ($1, $2, 'email')
       RETURNING id, email`,
      [email, hashedPassword]
    );

    const user = result.rows[0];
    return res.status(201).json({
      token: signToken(user.id),
      user: { id: user.id, email: user.email },
      isNewUser: true,
      hasProfile: false,
    });
  } catch (err) {
    console.error('authenticate error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ─── Complete profile ─────────────────────────────────────────────────────────
const completeProfile = async (req, res) => {
  const {
    nickname, gender, date_of_birth, height, weight,
    activity_level, diet_goal,
    target_weight, target_date,
  } = req.body;
  const userId = req.user.userId;

  if (!nickname || !gender || !date_of_birth || !height || !weight || !activity_level || !diet_goal) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const dailyCalorieGoal = calculateCalorieGoal(
      weight, height, date_of_birth, gender, activity_level, diet_goal
    );

    const result = await pool.query(
      `INSERT INTO user_profiles
        (user_id, nickname, gender, date_of_birth, height, weight,
         activity_level, diet_goal, daily_calorie_goal,
         target_weight, target_date)
       VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (user_id) DO UPDATE SET
         nickname           = EXCLUDED.nickname,
         gender             = EXCLUDED.gender,
         date_of_birth      = EXCLUDED.date_of_birth,
         height             = EXCLUDED.height,
         weight             = EXCLUDED.weight,
         activity_level     = EXCLUDED.activity_level,
         diet_goal          = EXCLUDED.diet_goal,
         daily_calorie_goal = EXCLUDED.daily_calorie_goal,
         target_weight      = EXCLUDED.target_weight,
         target_date        = EXCLUDED.target_date
       RETURNING
         id, user_id, nickname, gender,
         TO_CHAR(date_of_birth, 'YYYY-MM-DD') AS date_of_birth,
         height, weight, activity_level, diet_goal, daily_calorie_goal,
         target_weight,
         TO_CHAR(target_date, 'YYYY-MM-DD') AS target_date`,
      [
        userId, nickname, gender, date_of_birth, height, weight,
        activity_level, diet_goal, dailyCalorieGoal,
        target_weight ?? null, target_date ?? null,
      ]
    );

    const profile = result.rows[0];
    res.status(201).json({
      profile: {
        ...profile,
        height:             parseFloat(profile.height),
        weight:             parseFloat(profile.weight),
        daily_calorie_goal: parseFloat(profile.daily_calorie_goal),
        target_weight:      profile.target_weight ? parseFloat(profile.target_weight) : null,
      },
    });
  } catch (err) {
    console.error('completeProfile error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { authenticate, completeProfile };
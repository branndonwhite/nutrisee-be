const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const calculateCalorieGoal = require('../utils/calculateCalorieGoal');

const register = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (email, password, provider)
       VALUES ($1, $2, $3)
       RETURNING id, email`,
      [email, hashedPassword, 'email']
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(201).json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const completeProfile = async (req, res) => {
  const {
    nickname, gender, date_of_birth, height, weight,
    activity_level, diet_goal,
    target_weight, target_date,   // ← optional weight goal fields
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
        activity_level, diet_goal, daily_calorie_goal, target_weight, target_date)
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
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { register, login, completeProfile };
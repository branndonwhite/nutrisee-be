const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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
  const { nickname, gender, date_of_birth, height, weight } = req.body;
  const userId = req.user.userId;

  if (!nickname || !gender || !date_of_birth || !height || !weight) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO user_profiles (user_id, nickname, gender, date_of_birth, height, weight)
      VALUES ($1, $2, $3, $4::date, $5, $6)
      RETURNING id, user_id, nickname, gender, 
      TO_CHAR(date_of_birth, 'YYYY-MM-DD') as date_of_birth,
      height, weight, created_at`,
      [userId, nickname, gender, date_of_birth, height, weight]
    );
    const profile = result.rows[0];

    res.status(201).json({
      profile: {
        ...profile,
        height: parseFloat(profile.height),
        weight: parseFloat(profile.weight),
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { register, login, completeProfile };
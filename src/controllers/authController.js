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
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ token, user });
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
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, nickname, gender, date_of_birth, height, weight]
    );

    res.status(201).json({ profile: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { register, completeProfile };
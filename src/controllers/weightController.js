const pool = require('../db');

// ─── Log a new weight entry ───────────────────────────────────────────────────
const logWeight = async (req, res) => {
  const { weight, logged_at } = req.body;
  const userId = req.user.userId;

  if (!weight || isNaN(weight) || weight <= 0) {
    return res.status(400).json({ error: 'A valid weight (kg) is required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO weight_logs (user_id, weight, logged_at)
       VALUES ($1, $2, COALESCE($3::timestamptz, NOW()))
       RETURNING id, weight, logged_at`,
      [userId, weight, logged_at ?? null]
    );

    // Also keep user_profiles.weight in sync with the latest entry
    await pool.query(
      `UPDATE user_profiles SET weight = $1 WHERE user_id = $2`,
      [weight, userId]
    );

    const entry = result.rows[0];
    res.status(201).json({
      entry: {
        id: entry.id,
        weight: parseFloat(entry.weight),
        logged_at: entry.logged_at,
      },
    });
  } catch (err) {
    console.error('logWeight error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ─── Get weight history (last N entries) ─────────────────────────────────────
const getWeightHistory = async (req, res) => {
  const userId = req.user.userId;
  const limit = Math.min(parseInt(req.query.limit) || 30, 100);

  try {
    const result = await pool.query(
      `SELECT id, weight, logged_at
       FROM weight_logs
       WHERE user_id = $1
       ORDER BY logged_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    res.json({
      history: result.rows.map((r) => ({
        id: r.id,
        weight: parseFloat(r.weight),
        logged_at: r.logged_at,
      })),
    });
  } catch (err) {
    console.error('getWeightHistory error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ─── Get current weight goal ──────────────────────────────────────────────────
const getWeightGoal = async (req, res) => {
  const userId = req.user.userId;

  try {
    const result = await pool.query(
      `SELECT weight, target_weight, target_date, diet_goal, daily_calorie_goal
       FROM user_profiles
       WHERE user_id = $1`,
      [userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const p = result.rows[0];

    // Derive progress metrics when a target exists
    let progress = null;
    if (p.target_weight !== null) {
      const current = parseFloat(p.weight);
      const target = parseFloat(p.target_weight);
      const diff = current - target;             // negative = needs to lose, positive = needs to gain
      const direction = diff < 0 ? 'gain' : 'lose';
      progress = {
        current_weight: current,
        target_weight: target,
        kg_remaining: Math.abs(diff),
        direction,                               // 'lose' | 'gain'
        target_date: p.target_date ?? null,
      };
    }

    res.json({
      current_weight: parseFloat(p.weight),
      target_weight: p.target_weight ? parseFloat(p.target_weight) : null,
      target_date: p.target_date ?? null,
      diet_goal: p.diet_goal,
      daily_calorie_goal: parseFloat(p.daily_calorie_goal),
      progress,
    });
  } catch (err) {
    console.error('getWeightGoal error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ─── Update weight goal (target_weight / target_date) ────────────────────────
const updateWeightGoal = async (req, res) => {
  const { target_weight, target_date } = req.body;
  const userId = req.user.userId;

  if (!target_weight || isNaN(target_weight) || target_weight <= 0) {
    return res.status(400).json({ error: 'A valid target_weight (kg) is required' });
  }

  try {
    const result = await pool.query(
      `UPDATE user_profiles
       SET target_weight = $1,
           target_date   = $2
       WHERE user_id = $3
       RETURNING weight, target_weight, target_date`,
      [target_weight, target_date ?? null, userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const p = result.rows[0];
    res.json({
      current_weight: parseFloat(p.weight),
      target_weight: parseFloat(p.target_weight),
      target_date: p.target_date ?? null,
    });
  } catch (err) {
    console.error('updateWeightGoal error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ─── Delete a specific weight log entry ──────────────────────────────────────
const deleteWeightEntry = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  try {
    const result = await pool.query(
      `DELETE FROM weight_logs
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [id, userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Entry not found or not yours' });
    }

    res.json({ deleted: result.rows[0].id });
  } catch (err) {
    console.error('deleteWeightEntry error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  logWeight,
  getWeightHistory,
  getWeightGoal,
  updateWeightGoal,
  deleteWeightEntry,
};
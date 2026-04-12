const pool = require('../db');

// GET all available restrictions (for the picker in Expo)
const getRestrictions = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name FROM dietary_restrictions ORDER BY name ASC'
    );
    res.json({ restrictions: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST save user's selected restrictions
const saveUserRestrictions = async (req, res) => {
  const { restriction_ids } = req.body;
  const userId = req.user.userId;

  if (!restriction_ids || !Array.isArray(restriction_ids) || restriction_ids.length === 0) {
    return res.status(400).json({ error: 'Please select at least one restriction' });
  }

  try {
    // Build bulk insert values
    const values = restriction_ids.map((restrictionId, index) => 
      `($1, $${index + 2})`
    ).join(', ');

    const params = [userId, ...restriction_ids];

    await pool.query(
      `INSERT INTO user_dietary_restrictions (user_id, restriction_id)
       VALUES ${values}
       ON CONFLICT (user_id, restriction_id) DO NOTHING`,
      params
    );

    res.status(201).json({ message: 'Dietary restrictions saved successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getRestrictions, saveUserRestrictions };
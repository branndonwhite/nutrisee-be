const pool = require('../db');
const { uploadBase64 } = require('../utils/cloudinary');
const sharp = require('sharp');

// ─── Upload profile image ─────────────────────────────────────────────────────
const uploadProfileImage = async (req, res) => {
  const { image } = req.body;
  const userId = req.user.userId;

  if (!image) {
    return res.status(400).json({ error: 'Image is required' });
  }

  try {
    // Compress to a square-friendly size before uploading
    const imageBuffer = Buffer.from(image, 'base64');
    const compressedBuffer = await sharp(imageBuffer)
      .resize(400, 400, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 80 })
      .toBuffer();

    const compressedBase64 = compressedBuffer.toString('base64');
    const avatar_url = await uploadBase64(compressedBase64, 'nutrisee/avatars');

    await pool.query(
      `UPDATE user_profiles SET avatar_url = $1 WHERE user_id = $2`,
      [avatar_url, userId]
    );

    res.json({ avatar_url });
  } catch (err) {
    console.error('uploadProfileImage error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ─── Get profile (includes avatar_url) ───────────────────────────────────────
const getProfile = async (req, res) => {
  const userId = req.user.userId;

  try {
    const result = await pool.query(
      `SELECT nickname, gender, date_of_birth, height, weight,
              activity_level, diet_goal, daily_calorie_goal,
              target_weight, target_date, avatar_url
       FROM user_profiles
       WHERE user_id = $1`,
      [userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const p = result.rows[0];
    res.json({
      profile: {
        ...p,
        height:             parseFloat(p.height),
        weight:             parseFloat(p.weight),
        daily_calorie_goal: parseFloat(p.daily_calorie_goal),
        target_weight:      p.target_weight ? parseFloat(p.target_weight) : null,
      },
    });
  } catch (err) {
    console.error('getProfile error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { uploadProfileImage, getProfile };
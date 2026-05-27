const pool = require('../db');

const getLocalDate = (timezone) =>
  new Date().toLocaleDateString('en-CA', { timeZone: timezone });

/**
 * Deletes today's cached AI overview + tips for a user so the next
 * request regenerates fresh content based on updated data.
 */
const invalidateAICache = async (userId, timezone = 'Asia/Jakarta') => {
  try {
    const today = getLocalDate(timezone);
    // Delete both the dashboard overview and the profile tips in one shot
    await pool.query(
      `DELETE FROM ai_overviews WHERE user_id = $1 AND date = $2`,
      [userId, today]
    );
  } catch (err) {
    console.error('invalidateAICache error:', err.message);
  }
};

module.exports = invalidateAICache;

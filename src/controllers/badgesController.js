const pool = require('../db');

const BADGE_DEFINITIONS = [
  { key: 'cons_7',    check: ({ streak }) => streak >= 7 },
  { key: 'cons_30',   check: ({ streak }) => streak >= 30 },
  { key: 'cons_365',  check: ({ streak }) => streak >= 365 },
  { key: 'food_10',   check: ({ totalMeals }) => totalMeals >= 10 },
  { key: 'food_100',  check: ({ totalMeals }) => totalMeals >= 100 },
  { key: 'food_1000', check: ({ totalMeals }) => totalMeals >= 1000 },
  { key: 'share',     check: ({ hasShared }) => hasShared },
  { key: 'nutrisi',   check: ({ daysAllNutrientsLogged }) => daysAllNutrientsLogged >= 1 },
  { key: 'berat',     check: ({ goalReached }) => goalReached },
];

const getTimezone = (req) => req.headers['x-timezone'] ?? 'Asia/Jakarta';

const getBadges = async (req, res) => {
  const userId = req.user.userId;
  const timezone = getTimezone(req);

  try {
    // Total meals logged
    const mealsResult = await pool.query(
      'SELECT COUNT(*) as total FROM meal_logs WHERE user_id = $1',
      [userId]
    );
    const totalMeals = parseInt(mealsResult.rows[0].total);

    // Streak — get all distinct logged dates in user's timezone
    const logsResult = await pool.query(
      `SELECT DISTINCT DATE(logged_at AT TIME ZONE $2) as log_date
       FROM meal_logs WHERE user_id = $1
       ORDER BY log_date DESC`,
      [userId, timezone]
    );
    const logDates = new Set(logsResult.rows.map(r =>
      r.log_date instanceof Date
        ? r.log_date.toISOString().split('T')[0]
        : String(r.log_date)
    ));

    // Duolingo-style: streak survives if today OR yesterday is logged
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: timezone });
    const startOffset = logDates.has(todayStr) ? 0 : 1;
    let streak = 0;
    for (let i = startOffset; i < 365; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('en-CA', { timeZone: timezone });
      if (logDates.has(key)) streak++;
      else break;
    }

    // Days where all micronutrients were logged with values > 0
    const nutrientResult = await pool.query(
      `SELECT COUNT(DISTINCT DATE(logged_at AT TIME ZONE $2)) as days
       FROM meal_logs
       WHERE user_id = $1
         AND vitamin_a > 0 AND vitamin_c > 0 AND vitamin_d > 0 AND calcium > 0`,
      [userId, timezone]
    );
    const daysAllNutrientsLogged = parseInt(nutrientResult.rows[0].days);

    // Goal reached
    const profileResult = await pool.query(
      'SELECT weight, target_weight, diet_goal, has_shared FROM user_profiles WHERE user_id = $1',
      [userId]
    );
    const profile = profileResult.rows[0];
    let goalReached = false;
    if (profile?.target_weight) {
      const current = parseFloat(profile.weight);
      const target = parseFloat(profile.target_weight);
      if (profile.diet_goal === 'lose_weight') goalReached = current <= target;
      else if (profile.diet_goal === 'gain_weight') goalReached = current >= target;
    }
    const hasShared = profile?.has_shared ?? false;

    const context = { streak, totalMeals, daysAllNutrientsLogged, goalReached, hasShared };
    const badges = BADGE_DEFINITIONS.map(def => ({
      key: def.key,
      achieved: def.check(context),
    }));

    res.json({
      badges,
      stats: { streak, totalMeals, daysAllNutrientsLogged, goalReached },
    });
  } catch (err) {
    console.error('getBadges error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

const markShared = async (req, res) => {
  const userId = req.user.userId;
  try {
    await pool.query(
      'UPDATE user_profiles SET has_shared = true WHERE user_id = $1',
      [userId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getBadges, markShared };
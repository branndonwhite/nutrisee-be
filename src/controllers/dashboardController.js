const pool = require('../db');
const getOpenAI = require('../openai');

const openai = getOpenAI();

// ─── Timezone helpers ─────────────────────────────────────────────────────────
const getLocalDate = (timezone) =>
  new Date().toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD

const getTimezone = (req) => req.headers['x-timezone'] ?? 'Asia/Jakarta';

// Get the YYYY-MM-DD of 6 days ago in the user's timezone
const get7DayStart = (timezone) => {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return d.toLocaleDateString('en-CA', { timeZone: timezone });
};

// ─── AI Overview ──────────────────────────────────────────────────────────────
const getAIOverview = async (req, res) => {
  const userId = req.user.userId;
  const timezone = getTimezone(req);
  const today = getLocalDate(timezone);
  const force = req.query.force === 'true';

  try {
    if (force) {
      await pool.query(
        `DELETE FROM ai_overviews WHERE user_id = $1 AND date = $2 AND type = 'overview'`,
        [userId, today]
      );
    }

    const cached = await pool.query(
      `SELECT content FROM ai_overviews
       WHERE user_id = $1 AND date = $2 AND type = 'overview'`,
      [userId, today]
    );
    if (cached.rows.length > 0) {
      return res.json({ overview: cached.rows[0].content, cached: true });
    }

    const profileResult = await pool.query(
      `SELECT nickname, gender, date_of_birth, height, weight,
              daily_calorie_goal, diet_goal, target_weight
       FROM user_profiles WHERE user_id = $1`,
      [userId]
    );
    const profile = profileResult.rows[0];
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found', code: 'NO_PROFILE' });
    }
    const age = new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear();

    const todayResult = await pool.query(
      `SELECT
        COALESCE(SUM(calories), 0) as calories,
        COALESCE(SUM(carbs), 0)   as carbs,
        COALESCE(SUM(protein), 0) as protein,
        COALESCE(SUM(fat), 0)     as fat,
        COALESCE(SUM(sugar), 0)   as sugar,
        COALESCE(SUM(fiber), 0)   as fiber
       FROM meal_logs
       WHERE user_id = $1
         AND (logged_at AT TIME ZONE $2)::date::text = $3`,
      [userId, timezone, today]
    );
    const todayNutrition = todayResult.rows[0];

    const weekResult = await pool.query(
      `SELECT
        (logged_at AT TIME ZONE $2)::date AS date,
        COALESCE(SUM(calories), 0) as calories
       FROM meal_logs
       WHERE user_id = $1
         AND (logged_at AT TIME ZONE $2)::date >= $3::date
       GROUP BY (logged_at AT TIME ZONE $2)::date
       ORDER BY date ASC`,
      [userId, timezone, get7DayStart(timezone)]
    );
    const weekData = weekResult.rows;
    const daysLogged = weekData.length;
    const avgCalories = daysLogged > 0
      ? Math.round(weekData.reduce((sum, r) => sum + parseFloat(r.calories), 0) / daysLogged)
      : 0;
    const goalAdherenceDays = weekData.filter(
      r => Math.abs(parseFloat(r.calories) - parseFloat(profile.daily_calorie_goal)) <= 200
    ).length;

    const weightResult = await pool.query(
      `SELECT weight, logged_at FROM weight_logs
       WHERE user_id = $1 ORDER BY logged_at DESC LIMIT 2`,
      [userId]
    );
    const latestWeight = weightResult.rows[0]?.weight ?? profile.weight;
    const prevWeight = weightResult.rows[1]?.weight ?? null;
    const weightChange = prevWeight
      ? (parseFloat(latestWeight) - parseFloat(prevWeight)).toFixed(1)
      : null;

    const prompt = `
Kamu adalah asisten nutrisi Nutrisee yang ramah dan suportif.
Buat ringkasan harian singkat (maksimal 4 kalimat) berdasarkan data pengguna berikut.

Profil:
- Nama: ${profile.nickname}
- Usia: ${age} tahun, ${profile.gender}
- Tinggi: ${profile.height}cm, Berat: ${latestWeight}kg
- Target berat: ${profile.target_weight ?? 'belum diset'}kg
- Tujuan diet: ${profile.diet_goal}
- Target kalori harian: ${profile.daily_calorie_goal}kkal

Hari ini:
- Kalori: ${todayNutrition.calories}kkal
- Karbo: ${todayNutrition.carbs}g, Protein: ${todayNutrition.protein}g, Lemak: ${todayNutrition.fat}g

7 hari terakhir:
- Hari aktif: ${daysLogged}/7, Rata-rata: ${avgCalories}kkal, Sesuai target: ${goalAdherenceDays}/7
${weightChange !== null ? `- Perubahan berat: ${weightChange > 0 ? '+' : ''}${weightChange}kg` : ''}

Berikan pujian spesifik, tips actionable, dan motivasi singkat. Bahasa Indonesia santai. Boleh emoji.
    `.trim();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
    });
    const content = completion.choices[0].message.content;

    await pool.query(
      `INSERT INTO ai_overviews (user_id, content, date, type)
       VALUES ($1, $2, $3, 'overview')
       ON CONFLICT (user_id, date, type)
       DO UPDATE SET content = EXCLUDED.content`,
      [userId, content, today]
    );

    res.json({ overview: content, cached: false });
  } catch (err) {
    console.error('getAIOverview error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ─── Daily Stats ──────────────────────────────────────────────────────────────
const getDailyStats = async (req, res) => {
  const userId = req.user.userId;
  const timezone = getTimezone(req);
  const today = getLocalDate(timezone);

  try {
    const profileResult = await pool.query(
      `SELECT daily_calorie_goal, diet_goal, weight, target_weight,
              nickname, gender, avatar_url
       FROM user_profiles WHERE user_id = $1`,
      [userId]
    );
    const profile = profileResult.rows[0];
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found', code: 'NO_PROFILE' });
    }
    const calorieGoal = parseFloat(profile.daily_calorie_goal);

    const macroSplit = {
      lose_weight:     { carbs: 0.40, protein: 0.30, fat: 0.30 },
      gain_weight:     { carbs: 0.50, protein: 0.25, fat: 0.25 },
      maintain_weight: { carbs: 0.50, protein: 0.20, fat: 0.30 },
    }[profile.diet_goal] ?? { carbs: 0.50, protein: 0.20, fat: 0.30 };

    const macroGoals = {
      carbs:   Math.round((calorieGoal * macroSplit.carbs)   / 4),
      protein: Math.round((calorieGoal * macroSplit.protein) / 4),
      fat:     Math.round((calorieGoal * macroSplit.fat)     / 9),
      sugar:   Math.round((calorieGoal * 0.10) / 4),
      fiber:   Math.round((calorieGoal / 1000) * 14),
    };

    const todayResult = await pool.query(
      `SELECT
        COALESCE(SUM(calories), 0)    as calories,
        COALESCE(SUM(carbs), 0)       as carbs,
        COALESCE(SUM(protein), 0)     as protein,
        COALESCE(SUM(fat), 0)         as fat,
        COALESCE(SUM(sugar), 0)       as sugar,
        COALESCE(SUM(fiber), 0)       as fiber,
        COALESCE(SUM(vitamin_a), 0)   as vitamin_a,
        COALESCE(SUM(vitamin_c), 0)   as vitamin_c,
        COALESCE(SUM(vitamin_d), 0)   as vitamin_d,
        COALESCE(SUM(calcium), 0)     as calcium,
        COALESCE(SUM(cholesterol), 0) as cholesterol
       FROM meal_logs
       WHERE user_id = $1
         AND (logged_at AT TIME ZONE $2)::date::text = $3`,
      [userId, timezone, today]
    );
    const todayStats = todayResult.rows[0];
    const caloriesConsumed = parseFloat(todayStats.calories);

    const progressionResult = await pool.query(
      `SELECT
        (logged_at AT TIME ZONE $2)::date AS date,
        COALESCE(SUM(calories), 0) as calories,
        COALESCE(SUM(carbs), 0)    as carbs,
        COALESCE(SUM(protein), 0)  as protein,
        COALESCE(SUM(fat), 0)      as fat,
        COALESCE(SUM(sugar), 0)    as sugar,
        COALESCE(SUM(fiber), 0)    as fiber
       FROM meal_logs
       WHERE user_id = $1
        AND (logged_at AT TIME ZONE $2)::date >= $3::date
       GROUP BY (logged_at AT TIME ZONE $2)::date
       ORDER BY date ASC`,
      [userId, timezone, get7DayStart(timezone)]
    );
    
    const pencapaianResult = await pool.query(
      `SELECT
        COALESCE(SUM(calories), 0) as total_calories,
        COUNT(DISTINCT DATE(logged_at AT TIME ZONE $2)) as days_logged
       FROM meal_logs
       WHERE user_id = $1
         AND (logged_at AT TIME ZONE $2)::date >= $3::date`,
      [userId, timezone, get7DayStart(timezone)]
    );
    const pencapaianData = pencapaianResult.rows[0];
    const daysLogged = parseInt(pencapaianData.days_logged);
    const totalCalories = parseFloat(pencapaianData.total_calories);
    const calorieDiff = Math.abs(Math.round((calorieGoal * daysLogged) - totalCalories));
    const pencapaianLabel = totalCalories < calorieGoal * daysLogged ? 'Defisit' : 'Surplus';

    const weightResult = await pool.query(
      `SELECT weight FROM weight_logs WHERE user_id = $1 ORDER BY logged_at DESC LIMIT 1`,
      [userId]
    );
    const currentWeight = weightResult.rows[0]
      ? parseFloat(weightResult.rows[0].weight)
      : parseFloat(profile.weight);
    const targetWeight = profile.target_weight ? parseFloat(profile.target_weight) : null;
    const weightLost = targetWeight !== null ? Math.abs(currentWeight - targetWeight) : null;
    const dietDirection = targetWeight !== null
      ? (currentWeight > targetWeight ? 'turun' : 'naik')
      : null;

    const favoritResult = await pool.query(
      `SELECT food_name, COUNT(*) as count
       FROM meal_logs
       WHERE user_id = $1
        AND (logged_at AT TIME ZONE $2)::date >= $3::date
       GROUP BY food_name ORDER BY count DESC LIMIT 1`,
      [userId, timezone, get7DayStart(timezone)]
    );
    const favoritFood = favoritResult.rows[0] ?? null;

    res.json({
      profile: { nickname: profile.nickname, gender: profile.gender?.toLowerCase() ?? '', avatar_url: profile.avatar_url ?? null },
      today: {
        calorie_goal: calorieGoal,
        calories_consumed: caloriesConsumed,
        calories_remaining: calorieGoal - caloriesConsumed,
        carbs:       parseFloat(todayStats.carbs),
        protein:     parseFloat(todayStats.protein),
        fat:         parseFloat(todayStats.fat),
        sugar:       parseFloat(todayStats.sugar),
        fiber:       parseFloat(todayStats.fiber),
        vitamin_a:   parseFloat(todayStats.vitamin_a),
        vitamin_c:   parseFloat(todayStats.vitamin_c),
        vitamin_d:   parseFloat(todayStats.vitamin_d),
        calcium:     parseFloat(todayStats.calcium),
        cholesterol: parseFloat(todayStats.cholesterol),
      },
      progression: progressionResult.rows.map(row => ({
        date: row.date,
        calories: parseFloat(row.calories),
        carbs:    parseFloat(row.carbs),
        protein:  parseFloat(row.protein),
        fat:      parseFloat(row.fat),
        sugar:    parseFloat(row.sugar),
        fiber:    parseFloat(row.fiber),
      })),
      pencapaian: { label: pencapaianLabel, value: calorieDiff, unit: 'kkal', description: `dalam ${daysLogged} hari` },
      diet: { current_weight: currentWeight, target_weight: targetWeight, kg_remaining: weightLost !== null ? parseFloat(weightLost.toFixed(1)) : null, direction: dietDirection },
      favorit: favoritFood ? { food_name: favoritFood.food_name, count: parseInt(favoritFood.count) } : null,
      macro_goals: macroGoals,
    });
  } catch (err) {
    console.error('getDailyStats error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getAIOverview, getDailyStats };
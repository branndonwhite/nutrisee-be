const pool = require('../db');
const openai = require('../openai');
const calculateCalorieGoal = require('../utils/calculateCalorieGoal');

const getAIOverview = async (req, res) => {
  const userId = req.user.userId;
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  try {
    // Check cache first
    const cached = await pool.query(
      'SELECT content FROM ai_overviews WHERE user_id = $1 AND date = $2',
      [userId, today]
    );

    if (cached.rows.length > 0) {
      return res.json({ overview: cached.rows[0].content, cached: true });
    }

    // Fetch user's health profile
    const profileResult = await pool.query(
      `SELECT nickname, gender, date_of_birth, height, weight 
       FROM user_profiles WHERE user_id = $1`,
      [userId]
    );
    const profile = profileResult.rows[0];

    // Fetch today's nutrition stats
    const nutritionResult = await pool.query(
      `SELECT 
        COALESCE(SUM(calories), 0) as calories,
        COALESCE(SUM(carbs), 0) as carbs,
        COALESCE(SUM(protein), 0) as protein,
        COALESCE(SUM(fat), 0) as fat,
        COALESCE(SUM(sugar), 0) as sugar,
        COALESCE(SUM(fiber), 0) as fiber
       FROM meal_logs
       WHERE user_id = $1 AND DATE(logged_at) = $2`,
      [userId, today]
    );
    const nutrition = nutritionResult.rows[0];

    // Calculate age from date_of_birth
    const age = new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear();

    // Build prompt
    const prompt = `
      You are a friendly nutrition assistant for the Nutrisee app. 
      Give a short, encouraging daily overview (max 3 sentences) based on this user's data.
      
      User profile:
      - Name: ${profile.nickname}
      - Age: ${age} years old
      - Gender: ${profile.gender}
      - Height: ${profile.height} cm
      - Weight: ${profile.weight} kg

      Today's nutrition:
      - Calories consumed: ${nutrition.calories} kcal
      - Carbohydrates: ${nutrition.carbs}g
      - Protein: ${nutrition.protein}g
      - Fat: ${nutrition.fat}g
      - Sugar: ${nutrition.sugar}g
      - Fiber: ${nutrition.fiber}g

      Be casual, friendly and give one specific actionable tip based on their data.
      Respond in the same language the user's name suggests (Indonesian if the name sounds Indonesian).
    `;

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
    });

    const content = completion.choices[0].message.content;

    // Cache the result
    await pool.query(
      `INSERT INTO ai_overviews (user_id, content, date)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, date) DO UPDATE SET content = $2`,
      [userId, content, today]
    );

    res.json({ overview: content, cached: false });
  } catch (err) {
    console.error('getAIOverview error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

const getDailyStats = async (req, res) => {
  const userId = req.user.userId;
  const today = new Date().toISOString().split('T')[0];

  try {
    // Fetch calorie goal from profile
    const profileResult = await pool.query(
      `SELECT daily_calorie_goal FROM user_profiles WHERE user_id = $1`,
      [userId]
    );
    const { daily_calorie_goal } = profileResult.rows[0];

    // Fetch today's nutrition
    const todayResult = await pool.query(
      `SELECT
        COALESCE(SUM(calories), 0) as calories,
        COALESCE(SUM(carbs), 0) as carbs,
        COALESCE(SUM(protein), 0) as protein,
        COALESCE(SUM(fat), 0) as fat,
        COALESCE(SUM(sugar), 0) as sugar,
        COALESCE(SUM(fiber), 0) as fiber
       FROM meal_logs
       WHERE user_id = $1 AND DATE(logged_at) = $2`,
      [userId, today]
    );
    const todayStats = todayResult.rows[0];

    // Fetch last 7 days progression
    const progressionResult = await pool.query(
      `SELECT
        DATE(logged_at) as date,
        COALESCE(SUM(calories), 0) as calories,
        COALESCE(SUM(carbs), 0) as carbs,
        COALESCE(SUM(protein), 0) as protein,
        COALESCE(SUM(fat), 0) as fat,
        COALESCE(SUM(sugar), 0) as sugar,
        COALESCE(SUM(fiber), 0) as fiber
       FROM meal_logs
       WHERE user_id = $1
       AND logged_at >= NOW() - INTERVAL '7 days'
       GROUP BY DATE(logged_at)
       ORDER BY date ASC`,
      [userId]
    );

    const caloriesConsumed = parseFloat(todayStats.calories);
    const calorieGoal = parseFloat(daily_calorie_goal);

    res.json({
      today: {
        calorie_goal: calorieGoal,
        calories_consumed: caloriesConsumed,
        calories_remaining: calorieGoal - caloriesConsumed,
        carbs: parseFloat(todayStats.carbs),
        protein: parseFloat(todayStats.protein),
        fat: parseFloat(todayStats.fat),
        sugar: parseFloat(todayStats.sugar),
        fiber: parseFloat(todayStats.fiber),
      },
      progression: progressionResult.rows.map(row => ({
        date: row.date,
        calories: parseFloat(row.calories),
        carbs: parseFloat(row.carbs),
        protein: parseFloat(row.protein),
        fat: parseFloat(row.fat),
        sugar: parseFloat(row.sugar),
        fiber: parseFloat(row.fiber),
      }))
    });
  } catch (err) {
    console.error('getDailyStats error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { getAIOverview, getDailyStats };
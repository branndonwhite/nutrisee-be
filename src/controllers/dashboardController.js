const pool = require('../db');
const openai = require('../openai');

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

module.exports = { getAIOverview };
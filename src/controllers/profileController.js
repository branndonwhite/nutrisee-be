const pool = require('../db');
const openai = require('../openai');

const getLocalDate = (timezone) =>
  new Date().toLocaleDateString('en-CA', { timeZone: timezone });
const getTimezone = (req) => req.headers['x-timezone'] ?? 'Asia/Jakarta';
const get7DayStart = (timezone) => {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return d.toLocaleDateString('en-CA', { timeZone: timezone });
};
const sharp = require('sharp');
const { uploadBase64 } = require('../utils/cloudinary');

const uploadProfileImage = async (req, res) => {
  const { image } = req.body;
  const userId = req.user.userId;
  if (!image) return res.status(400).json({ error: 'Image is required' });
  try {
    const imageBuffer = Buffer.from(image, 'base64');
    const compressedBuffer = await sharp(imageBuffer)
      .resize(400, 400, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 80 })
      .toBuffer();
    const avatar_url = await uploadBase64(compressedBuffer.toString('base64'), 'nutrisee/avatars');
    await pool.query('UPDATE user_profiles SET avatar_url = $1 WHERE user_id = $2', [avatar_url, userId]);
    res.json({ avatar_url });
  } catch (err) {
    console.error('uploadProfileImage error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

const getProfile = async (req, res) => {
  const userId = req.user.userId;
  try {
    const result = await pool.query(
      `SELECT nickname, gender, date_of_birth, height, weight,
              activity_level, diet_goal, daily_calorie_goal,
              target_weight, target_date, avatar_url
       FROM user_profiles WHERE user_id = $1`,
      [userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Profile not found' });
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

const getAITips = async (req, res) => {
  const userId = req.user.userId;
  const timezone = getTimezone(req);
  const today = getLocalDate(timezone);
  try {
    // Check cache
    const cached = await pool.query(
      `SELECT content FROM ai_overviews WHERE user_id = $1 AND date = $2 AND type = 'tips'`,
      [userId, today]
    );
    if (cached.rows.length > 0) {
      return res.json({ tips: JSON.parse(cached.rows[0].content), cached: true });
    }

    const profileResult = await pool.query(
      `SELECT nickname, gender, date_of_birth, height, weight,
              daily_calorie_goal, diet_goal, target_weight
       FROM user_profiles WHERE user_id = $1`,
      [userId]
    );
    const profile = profileResult.rows[0];
    const age = new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear();

    const weekResult = await pool.query(
      `SELECT
        COALESCE(AVG(calories), 0) as avg_cal,
        COALESCE(AVG(carbs), 0)    as avg_carbs,
        COALESCE(AVG(protein), 0)  as avg_protein,
        COALESCE(AVG(fat), 0)      as avg_fat,
        COALESCE(AVG(vitamin_a), 0) as avg_vita,
        COALESCE(AVG(vitamin_c), 0) as avg_vitc,
        COALESCE(AVG(calcium), 0)   as avg_calcium
       FROM (
         SELECT DATE(logged_at AT TIME ZONE 'UTC' AT TIME ZONE $2) as d,
           SUM(calories) as calories, SUM(carbs) as carbs,
           SUM(protein) as protein, SUM(fat) as fat,
           SUM(vitamin_a) as vitamin_a, SUM(vitamin_c) as vitamin_c,
           SUM(calcium) as calcium
         FROM meal_logs
         WHERE user_id = $1
           AND DATE(logged_at AT TIME ZONE 'UTC' AT TIME ZONE $2) >= $3::date
         GROUP BY DATE(logged_at AT TIME ZONE 'UTC' AT TIME ZONE $2)
       ) daily`,
      [userId, timezone, get7DayStart(timezone)]
    );
    const w = weekResult.rows[0];

    const weightResult = await pool.query(
      `SELECT weight FROM weight_logs WHERE user_id = $1 ORDER BY logged_at DESC LIMIT 1`,
      [userId]
    );
    const latestWeight = weightResult.rows[0]?.weight ?? profile.weight;
    const kgToTarget = profile.target_weight
      ? Math.abs(parseFloat(latestWeight) - parseFloat(profile.target_weight)).toFixed(1)
      : null;

    const prompt = `Kamu adalah asisten nutrisi Nutrisee. Buat AI Tips harian dalam format JSON persis ini, tanpa teks tambahan:
{"tips":[{"sections":[{"label":"Kalori","text":"..."},{"label":"Makro","text":"..."},{"label":"Mikro","text":"..."}]},{"sections":[{"label":"Ide Makanan","text":"..."},{"label":"Tips Aktivitas","text":"..."}]},{"sections":[{"label":"Catatan Diet","text":"..."}]}]}

Data: Nama ${profile.nickname}, ${age}th, ${profile.gender}, ${profile.height}cm, ${latestWeight}kg, target ${profile.target_weight ?? 'belum diset'}kg ${kgToTarget ? `(sisa ${kgToTarget}kg)` : ''}, diet goal: ${profile.diet_goal}, target kalori: ${profile.daily_calorie_goal}kkal.
Rata-rata 7 hari: Kalori ${Math.round(w.avg_cal)}kkal, Karbo ${Math.round(w.avg_carbs)}g, Protein ${Math.round(w.avg_protein)}g, Lemak ${Math.round(w.avg_fat)}g, VitA ${Math.round(w.avg_vita)}mcg, VitC ${Math.round(w.avg_vitc)}mg, Kalsium ${Math.round(w.avg_calcium)}mg.
Tiap section 2-4 kalimat, Bahasa Indonesia santai dan memotivasi. Ide Makanan berikan 3 rekomendasi menu. Catatan Diet proyeksikan waktu pencapaian target.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 900,
    });

    const raw = completion.choices[0].message.content.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(raw);

    await pool.query(
      `INSERT INTO ai_overviews (user_id, content, date, type)
       VALUES ($1, $2, $3, 'tips')
       ON CONFLICT (user_id, date, type) DO UPDATE SET content = $2`,
      [userId, JSON.stringify(parsed.tips), today]
    );

    res.json({ tips: parsed.tips, cached: false });
  } catch (err) {
    console.error('getAITips error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

const getWeeklyStats = async (req, res) => {
  const userId = req.user.userId;
  const timezone = getTimezone(req);
  try {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toLocaleDateString('en-CA', { timeZone: timezone });
    });

    const result = await pool.query(
      `SELECT DATE(logged_at AT TIME ZONE 'UTC' AT TIME ZONE $2) as date,
        COALESCE(SUM(calories), 0) as calories,
        COALESCE(SUM(carbs), 0)    as carbs,
        COALESCE(SUM(protein), 0)  as protein,
        COALESCE(SUM(fat), 0)      as fat,
        COALESCE(SUM(sugar), 0)    as sugar,
        COALESCE(SUM(fiber), 0)    as fiber
       FROM meal_logs
       WHERE user_id = $1
         AND DATE(logged_at AT TIME ZONE 'UTC' AT TIME ZONE $2) >= $3::date
       GROUP BY DATE(logged_at AT TIME ZONE 'UTC' AT TIME ZONE $2)`,
      [userId, timezone, get7DayStart(timezone)]
    );

    const byDate = {};
    result.rows.forEach(r => {
      // pg returns DATE as string 'YYYY-MM-DD' when using AT TIME ZONE
      const key = typeof r.date === 'string' ? r.date : r.date.toISOString().split('T')[0];
      byDate[key] = r;
    });

    const filled = days.map(d => ({
      date: d,
      label: new Date(d + 'T12:00:00').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', timeZone: timezone }),
      calories: byDate[d] ? parseFloat(byDate[d].calories) : 0,
      carbs:    byDate[d] ? parseFloat(byDate[d].carbs)    : 0,
      protein:  byDate[d] ? parseFloat(byDate[d].protein)  : 0,
      fat:      byDate[d] ? parseFloat(byDate[d].fat)      : 0,
      sugar:    byDate[d] ? parseFloat(byDate[d].sugar)    : 0,
      fiber:    byDate[d] ? parseFloat(byDate[d].fiber)    : 0,
    }));

    const profileResult = await pool.query(
      'SELECT daily_calorie_goal, diet_goal FROM user_profiles WHERE user_id = $1',
      [userId]
    );
    const profile = profileResult.rows[0];
    const cg = parseFloat(profile.daily_calorie_goal);
    const splits = { lose_weight: { carbs: 0.40, protein: 0.30, fat: 0.30 }, gain_weight: { carbs: 0.50, protein: 0.25, fat: 0.25 }, maintain_weight: { carbs: 0.50, protein: 0.20, fat: 0.30 } };
    const split = splits[profile.diet_goal] ?? splits.maintain_weight;

    res.json({
      week: filled,
      dates: filled.map(d => d.label),
      goals: {
        calories: cg,
        carbs:    Math.round((cg * split.carbs)   / 4),
        protein:  Math.round((cg * split.protein) / 4),
        fat:      Math.round((cg * split.fat)     / 9),
        sugar:    Math.round((cg * 0.10) / 4),
        fiber:    Math.round((cg / 1000) * 14),
      },
    });
  } catch (err) {
    console.error('getWeeklyStats error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

const getWeightTarget = async (req, res) => {
  const userId = req.user.userId;
  try {
    const profileResult = await pool.query(
      'SELECT weight, target_weight, diet_goal, daily_calorie_goal FROM user_profiles WHERE user_id = $1',
      [userId]
    );
    const profile = profileResult.rows[0];
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const weightResult = await pool.query(
      'SELECT weight FROM weight_logs WHERE user_id = $1 ORDER BY logged_at DESC LIMIT 1',
      [userId]
    );
    const currentWeight = weightResult.rows[0] ? parseFloat(weightResult.rows[0].weight) : parseFloat(profile.weight);
    const targetWeight = profile.target_weight ? parseFloat(profile.target_weight) : null;

    const calResult = await pool.query(
      `SELECT COUNT(DISTINCT DATE(logged_at)) as days_logged,
              COALESCE(SUM(calories), 0) as total_calories
       FROM meal_logs WHERE user_id = $1 AND logged_at >= NOW() - INTERVAL '30 days'`,
      [userId]
    );
    const daysLogged = parseInt(calResult.rows[0].days_logged);
    const totalCalories = parseFloat(calResult.rows[0].total_calories);
    const calorieGoal = parseFloat(profile.daily_calorie_goal);
    const avgDailyDiff = daysLogged > 0 ? (totalCalories / daysLogged) - calorieGoal : 0;
    const kgPerDay = avgDailyDiff / 7700;

    let daysToTarget = null;
    if (targetWeight !== null && kgPerDay !== 0) {
      const kgRemaining = currentWeight - targetWeight;
      if ((profile.diet_goal === 'lose_weight' && kgPerDay < 0) || (profile.diet_goal === 'gain_weight' && kgPerDay > 0)) {
        daysToTarget = Math.round(Math.abs(kgRemaining / kgPerDay));
      }
    }

    res.json({ current_weight: currentWeight, target_weight: targetWeight, kg_remaining: targetWeight !== null ? parseFloat(Math.abs(currentWeight - targetWeight).toFixed(1)) : null, avg_daily_calorie_diff: Math.round(avgDailyDiff), estimated_days_to_target: daysToTarget });
  } catch (err) {
    console.error('getWeightTarget error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { uploadProfileImage, getProfile, getAITips, getWeeklyStats, getWeightTarget };
const pool = require('../db');
const openai = require('../openai');
const sharp = require('sharp');

// Step 1: Analyze food photo
const analyzeMeal = async (req, res) => {
  const { image } = req.body;

  if (!image) {
    return res.status(400).json({ error: 'Image is required' });
  }

  try {
    // Convert base64 to buffer
    const imageBuffer = Buffer.from(image, 'base64');

    // Compress and resize image
    const compressedBuffer = await sharp(imageBuffer)
      .resize(800, 800, { 
        fit: 'inside',        // maintain aspect ratio
        withoutEnlargement: true  // don't upscale small images
      })
      .jpeg({ quality: 80 }) // convert to jpeg at 80% quality
      .toBuffer();

    // Convert back to base64
    const compressedBase64 = compressedBuffer.toString('base64');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${compressedBase64}`,
              },
            },
            {
              type: 'text',
              text: `Analyze this food image and provide nutritional information.
              Respond ONLY in this exact JSON format, no extra text:
              {
                "food_name": "name of the food",
                "calories": 000,
                "carbs": 00,
                "protein": 00,
                "fat": 00,
                "sugar": 00,
                "fiber": 00
              }
              All values should be numbers (not strings).
              Base estimates on a typical single serving size.`
            }
          ],
        }
      ],
      max_tokens: 200,
    });

    const content = response.choices[0].message.content;
    const cleaned = content.replace(/```json|```/g, '').trim();
    const nutrition = JSON.parse(cleaned);

    res.json({ nutrition });
  } catch (err) {
    console.error('analyzeMeal error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// Step 2: Save confirmed meal
const logMeal = async (req, res) => {
  const { food_name, calories, carbs, protein, fat, sugar, fiber } = req.body;
  const userId = req.user.userId;

  if (!food_name || !calories) {
    return res.status(400).json({ error: 'food_name and calories are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO meal_logs 
        (user_id, food_name, calories, carbs, protein, fat, sugar, fiber)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [userId, food_name, calories, carbs, protein, fat, sugar, fiber]
    );

    const meal = result.rows[0];

    res.status(201).json({
      meal: {
        ...meal,
        calories: parseFloat(meal.calories),
        carbs: parseFloat(meal.carbs),
        protein: parseFloat(meal.protein),
        fat: parseFloat(meal.fat),
        sugar: parseFloat(meal.sugar),
        fiber: parseFloat(meal.fiber),
      }
    });
  } catch (err) {
    console.error('logMeal error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// Get meal history
const getMealHistory = async (req, res) => {
  const userId = req.user.userId;

  try {
    const result = await pool.query(
      `SELECT id, food_name, calories, carbs, protein, fat, sugar, fiber, logged_at
       FROM meal_logs
       WHERE user_id = $1
       ORDER BY logged_at DESC
       LIMIT 20`,
      [userId]
    );

    const meals = result.rows.map(meal => ({
      ...meal,
      calories: parseFloat(meal.calories),
      carbs: parseFloat(meal.carbs),
      protein: parseFloat(meal.protein),
      fat: parseFloat(meal.fat),
      sugar: parseFloat(meal.sugar),
      fiber: parseFloat(meal.fiber),
    }));

    res.json({ meals });
  } catch (err) {
    console.error('getMealHistory error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { analyzeMeal, logMeal, getMealHistory };
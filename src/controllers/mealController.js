const pool = require('../db');
const getOpenAI = require('../openai');
const sharp = require('sharp');
const { uploadBase64 } = require('../utils/cloudinary');

const openai = getOpenAI();

// Step 1: Analyze food photo
const analyzeMeal = async (req, res) => {
  const { image } = req.body;

  if (!image) {
    return res.status(400).json({ error: 'Image is required' });
  }

  try {
    const imageBuffer = Buffer.from(image, 'base64');

    const compressedBuffer = await sharp(imageBuffer)
      .resize(600, 600, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 60 })
      .toBuffer();

    const compressedBase64 = compressedBuffer.toString('base64');

    // Upload to Cloudinary, get a stable URL
    const image_url = await uploadBase64(compressedBase64);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: image_url,  // URL instead of base64
              },
            },
            {
              type: 'text',
              text: `Analisis gambar makanan ini dan berikan informasi nutrisinya.
              Sebisa mungkin identifikasi makanan Indonesia sebelum mengidentifikasikannya sebagai makanan luar Indonesia.
              Respon dengan format JSON PERSIS di bawah ini, tanpa teks tambahan:
              {
                "food_name": "nama makanan dalam Bahasa Indonesia",
                "calories": 000,
                "carbs": 00,
                "protein": 00,
                "fat": 00,
                "sugar": 00,
                "fiber": 00,
                "vitamin_a": 00,
                "vitamin_c": 00,
                "vitamin_d": 00,
                "calcium": 00,
                "cholesterol": 00
              }
              Units:
              - calories: kcal
              - carbs, protein, fat, sugar, fiber: grams
              - vitamin_a: mcg (micrograms RAE)
              - vitamin_c: mg
              - vitamin_d: mcg
              - calcium: mg
              - cholesterol: mg
              Semua nilai dalam bentuk angka (bukan strings).
              Estimasikan berdasarkan jumlah per sajian.`
            }
          ],
        }
      ],
      max_tokens: 300,
    });

    const content = response.choices[0].message.content;
    const cleaned = content.replace(/```json|```/g, '').trim();
    const nutrition = JSON.parse(cleaned);

    // Return image_url so frontend can pass it to logMeal
    res.json({ nutrition, image_url });
  } catch (err) {
    console.error('analyzeMeal error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// Step 2: Save confirmed meal
const logMeal = async (req, res) => {
  const {
    food_name, calories, carbs, protein, fat, sugar, fiber,
    vitamin_a, vitamin_c, vitamin_d, calcium, cholesterol,
    image_url, description, location,
  } = req.body;
  const userId = req.user.userId;

  if (!food_name || calories == null) {
    return res.status(400).json({ error: 'food_name and calories are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO meal_logs
        (user_id, food_name, calories, carbs, protein, fat, sugar, fiber,
         vitamin_a, vitamin_c, vitamin_d, calcium, cholesterol,
         image_url, description, location)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        userId, food_name, calories, carbs, protein, fat, sugar, fiber,
        vitamin_a ?? 0, vitamin_c ?? 0, vitamin_d ?? 0, calcium ?? 0, cholesterol ?? 0,
        image_url ?? null, description ?? null, location ?? null,
      ]
    );

    const meal = result.rows[0];

    res.status(201).json({
      meal: {
        ...meal,
        calories:    parseFloat(meal.calories),
        carbs:       parseFloat(meal.carbs),
        protein:     parseFloat(meal.protein),
        fat:         parseFloat(meal.fat),
        sugar:       parseFloat(meal.sugar),
        fiber:       parseFloat(meal.fiber),
        vitamin_a:   parseFloat(meal.vitamin_a),
        vitamin_c:   parseFloat(meal.vitamin_c),
        vitamin_d:   parseFloat(meal.vitamin_d),
        calcium:     parseFloat(meal.calcium),
        cholesterol: parseFloat(meal.cholesterol),
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
  const limit = Math.min(parseInt(req.query.limit) || 20, 200);

  try {
    const result = await pool.query(
      `SELECT id, food_name, calories, carbs, protein, fat, sugar, fiber,
              vitamin_a, vitamin_c, vitamin_d, calcium, cholesterol,
              image_url, description, location, logged_at
       FROM meal_logs
       WHERE user_id = $1
       ORDER BY logged_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    const meals = result.rows.map(meal => ({
      ...meal,
      calories:    parseFloat(meal.calories),
      carbs:       parseFloat(meal.carbs),
      protein:     parseFloat(meal.protein),
      fat:         parseFloat(meal.fat),
      sugar:       parseFloat(meal.sugar),
      fiber:       parseFloat(meal.fiber),
      vitamin_a:   parseFloat(meal.vitamin_a),
      vitamin_c:   parseFloat(meal.vitamin_c),
      vitamin_d:   parseFloat(meal.vitamin_d),
      calcium:     parseFloat(meal.calcium),
      cholesterol: parseFloat(meal.cholesterol),
    }));

    res.json({ meals });
  } catch (err) {
    console.error('getMealHistory error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// Analyze by text description (+ optional image_url from Cloudinary)
const analyzeTextMeal = async (req, res) => {
  const { description, image_url } = req.body;

  if (!description && !image_url) {
    return res.status(400).json({ error: 'Food description or image is required' });
  }

  try {
    const content = [];

    if (image_url) {
      content.push({
        type: 'image_url',
        image_url: { url: image_url },
      });
    }

    const descriptionLine = description
      ? `Deskripsi makanan: "${description}"`
      : 'Identifikasi makanan dari gambar yang diberikan.';

    content.push({
      type: 'text',
      text: `Kamu adalah ahli nutrisi. Berdasarkan ${image_url && description ? 'deskripsi makanan dan gambar' : image_url ? 'gambar' : 'deskripsi makanan'} berikut, estimasikan informasi nutrisi.
      ${descriptionLine}
      
      Respon HANYA dalam format JSON persis ini, tanpa teks tambahan:
      {
        "food_name": "nama makanan dalam Bahasa Indonesia",
        "calories": 000,
        "carbs": 00,
        "protein": 00,
        "fat": 00,
        "sugar": 00,
        "fiber": 00,
        "vitamin_a": 00,
        "vitamin_c": 00,
        "vitamin_d": 00,
        "calcium": 00,
        "cholesterol": 00
      }
      Units:
      - calories: kcal
      - carbs, protein, fat, sugar, fiber: grams
      - vitamin_a: mcg (micrograms RAE)
      - vitamin_c: mg
      - vitamin_d: mcg
      - calcium: mg
      - cholesterol: mg
      Semua nilai dalam bentuk angka (bukan strings).
      Estimasikan berdasarkan jumlah per sajian.`
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content }],
      max_tokens: 300,
    });

    const responseContent = response.choices[0].message.content;
    const cleaned = responseContent.replace(/```json|```/g, '').trim();
    const nutrition = JSON.parse(cleaned);

    // Return description so frontend can pass it to logMeal
    res.json({ nutrition, description: description || nutrition.food_name });
  } catch (err) {
    console.error('analyzeTextMeal error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// Upload image to Cloudinary (no analysis) — used for additional-info re-scan
const uploadImage = async (req, res) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ error: 'Image is required' });
  try {
    const imageBuffer = Buffer.from(image, 'base64');
    const compressedBuffer = await sharp(imageBuffer)
      .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 60 })
      .toBuffer();
    const image_url = await uploadBase64(compressedBuffer.toString('base64'));
    res.json({ image_url });
  } catch (err) {
    console.error('uploadImage error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// Analyze image + description together (PATCH /meals/analyze)
const analyzeMealCombined = async (req, res) => {
  const { image, description } = req.body;

  if (!image) return res.status(400).json({ error: 'Image is required' });

  try {
    // Compress + upload image
    const imageBuffer = Buffer.from(image, 'base64');
    const compressedBuffer = await sharp(imageBuffer)
      .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 60 })
      .toBuffer();
    const image_url = await uploadBase64(compressedBuffer.toString('base64'));

    // Build prompt with both image and description
    const content = [
      { type: 'image_url', image_url: { url: image_url } },
      {
        type: 'text',
        text: `Kamu adalah ahli nutrisi. Berdasarkan gambar dan deskripsi makanan berikut, estimasikan informasi nutrisi.
        ${description ? `Deskripsi makanan: "${description}"` : 'Identifikasi makanan dari gambar yang diberikan.'}

        Respon HANYA dalam format JSON persis ini, tanpa teks tambahan:
        {
          "food_name": "nama makanan dalam Bahasa Indonesia",
          "calories": 000,
          "carbs": 00,
          "protein": 00,
          "fat": 00,
          "sugar": 00,
          "fiber": 00,
          "vitamin_a": 00,
          "vitamin_c": 00,
          "vitamin_d": 00,
          "calcium": 00,
          "cholesterol": 00
        }
        Units:
        - calories: kcal
        - carbs, protein, fat, sugar, fiber: grams
        - vitamin_a: mcg (micrograms RAE)
        - vitamin_c: mg
        - vitamin_d: mcg
        - calcium: mg
        - cholesterol: mg
        Semua nilai dalam bentuk angka (bukan strings).
        Estimasikan berdasarkan jumlah per sajian.`,
      },
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content }],
      max_tokens: 300,
    });

    const responseContent = response.choices[0].message.content;
    const cleaned = responseContent.replace(/```json|```/g, '').trim();
    const nutrition = JSON.parse(cleaned);

    res.json({ nutrition, image_url, description: description || nutrition.food_name });
  } catch (err) {
    console.error('analyzeMealCombined error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { analyzeMeal, logMeal, getMealHistory, analyzeTextMeal, uploadImage, analyzeMealCombined };
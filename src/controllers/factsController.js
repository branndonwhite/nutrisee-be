const getOpenAI = require('../openai');

const openai = getOpenAI();

const getRandomFact = async (req, res) => {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: `Generate a single interesting and surprising fun fact about Indonesian food, 
          nutrition, or ingredients. 
          
          Rules:
          - Keep it under 2 sentences
          - Make it genuinely surprising or educational
          - Respond in Indonesian language
          - Respond ONLY with the fact text, no extra formatting or labels`
        }
      ],
      max_tokens: 100,
    });

    const fact = response.choices[0].message.content.trim();
    res.json({ fact });
  } catch (err) {
    console.error('getRandomFact error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { getRandomFact };
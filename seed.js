/**
 * Nutrisee - Database Seed Script
 * --------------------------------
 * Creates 3 dummy users:
 *   - User A: Raka  → gym rat, nutritious food, gain_weight goal     (7 days)
 *   - User B: Dinda → sedentary, junk food, lose_weight goal         (7 days)
 *   - User C: Nadya → bad habits → gradually improving, lose_weight  (14 days)
 *
 * Usage:
 *   node seed.js           → seed all users
 *   node seed.js --reset   → wipe seed data first, then re-seed
 */

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ─── Calorie Goal Calculator (mirrors src/utils/calculateCalorieGoal.js) ─────
const ACTIVITY_MULTIPLIERS = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };
const DIET_GOAL_ADJUSTMENT  = { lose_weight: -500, maintain_weight: 0, gain_weight: +500 };

function calculateCalorieGoal(weight, height, dateOfBirth, gender, activityLevel, dietGoal) {
  const age = Math.floor((new Date() - new Date(dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000));
  const bmr = gender === 'laki-laki'
    ? (10 * weight) + (6.25 * height) - (5 * age) + 5
    : (10 * weight) + (6.25 * height) - (5 * age) - 161;
  const tdee       = Math.round(bmr * (ACTIVITY_MULTIPLIERS[activityLevel] || 1.55));
  const adjustment = DIET_GOAL_ADJUSTMENT[dietGoal] ?? 0;
  return Math.max(1200, tdee + adjustment);
}

// ─── User Definitions ─────────────────────────────────────────────────────────
const SEED_USERS = [
  {
    // ── User A: gym rat, eats clean ──
    email:    'raka@nutrisee.dev',
    password: 'password123',
    profile: {
      nickname:       'Raka',
      gender:         'laki-laki',
      date_of_birth:  '1998-03-15',   // 27 yo
      height:         175,
      weight:         72,
      activity_level: 'active',
      diet_goal:      'gain_weight',
    },
    location: 'Kemanggisan, Jakarta Barat',
    meals: [
      // Day 7 ✅ goal hit (~3420 kcal)
      { day: 7, food_name: 'Oatmeal + Pisang + Madu',                  calories: 380, carbs: 65, protein: 12, fat: 6,  sugar: 18, fiber: 7  },
      { day: 7, food_name: 'Whey Protein Shake + Susu Full Cream',      calories: 320, carbs: 18, protein: 36, fat: 8,  sugar: 10, fiber: 1  },
      { day: 7, food_name: 'Nasi Merah + Ayam Panggang + Brokoli',      calories: 720, carbs: 82, protein: 52, fat: 14, sugar: 4,  fiber: 8  },
      { day: 7, food_name: 'Roti Gandum + Selai Kacang + Pisang',       calories: 410, carbs: 54, protein: 14, fat: 16, sugar: 12, fiber: 5  },
      { day: 7, food_name: 'Salmon Kukus + Ubi Panggang + Salad',       calories: 680, carbs: 58, protein: 48, fat: 20, sugar: 6,  fiber: 9  },
      { day: 7, food_name: 'Greek Yogurt + Madu + Almond',              calories: 310, carbs: 30, protein: 18, fat: 12, sugar: 18, fiber: 3  },
      { day: 7, food_name: 'Nasi Merah + Telur Rebus 2 + Tempe',        calories: 600, carbs: 70, protein: 34, fat: 16, sugar: 3,  fiber: 7  },
      // Day 6 ✅ goal hit (~3450 kcal)
      { day: 6, food_name: 'Greek Yogurt + Granola + Buah Berry',       calories: 340, carbs: 48, protein: 18, fat: 7,  sugar: 20, fiber: 5  },
      { day: 6, food_name: 'Smoothie Mangga + Whey Protein',            calories: 380, carbs: 50, protein: 32, fat: 5,  sugar: 30, fiber: 3  },
      { day: 6, food_name: 'Nasi Merah + Tempe Bacem + Sayur Sop',      calories: 650, carbs: 78, protein: 32, fat: 12, sugar: 5,  fiber: 10 },
      { day: 6, food_name: 'Kacang Almond + Kurma 4 biji',              calories: 280, carbs: 28, protein: 8,  fat: 16, sugar: 18, fiber: 4  },
      { day: 6, food_name: 'Dada Ayam Rebus + Quinoa + Alpukat',        calories: 710, carbs: 62, protein: 54, fat: 18, sugar: 3,  fiber: 8  },
      { day: 6, food_name: 'Susu Full Cream + Oat Bar',                 calories: 360, carbs: 46, protein: 12, fat: 14, sugar: 20, fiber: 4  },
      { day: 6, food_name: 'Nasi + Ikan Goreng Kuning + Lalapan',       calories: 730, carbs: 84, protein: 42, fat: 18, sugar: 3,  fiber: 6  },
      // Day 5 ✅ goal hit (~3410 kcal)
      { day: 5, food_name: 'Telur Rebus 3 + Roti Gandum + Alpukat',     calories: 420, carbs: 32, protein: 24, fat: 20, sugar: 4,  fiber: 6  },
      { day: 5, food_name: 'Protein Bar + Pisang',                       calories: 340, carbs: 48, protein: 20, fat: 8,  sugar: 22, fiber: 4  },
      { day: 5, food_name: 'Nasi Merah + Gado-gado + Tempe',            calories: 680, carbs: 78, protein: 30, fat: 22, sugar: 8,  fiber: 12 },
      { day: 5, food_name: 'Whey Protein + Air Kelapa',                  calories: 280, carbs: 20, protein: 30, fat: 3,  sugar: 14, fiber: 1  },
      { day: 5, food_name: 'Ikan Tuna Panggang + Nasi Merah + Brokoli', calories: 660, carbs: 68, protein: 52, fat: 10, sugar: 2,  fiber: 7  },
      { day: 5, food_name: 'Ubi Rebus + Selai Kacang',                  calories: 350, carbs: 52, protein: 10, fat: 12, sugar: 8,  fiber: 6  },
      { day: 5, food_name: 'Ayam Panggang + Salad Caesar',              calories: 680, carbs: 38, protein: 58, fat: 28, sugar: 4,  fiber: 5  },
      // Day 4 ✅ goal hit (~3400 kcal)
      { day: 4, food_name: 'Smoothie Pisang + Whey Protein',            calories: 420, carbs: 58, protein: 34, fat: 5,  sugar: 28, fiber: 4  },
      { day: 4, food_name: 'Overnight Oats + Chia + Kiwi',              calories: 360, carbs: 54, protein: 12, fat: 8,  sugar: 16, fiber: 9  },
      { day: 4, food_name: 'Nasi + Pecel Lele + Lalapan + Tempe',       calories: 720, carbs: 82, protein: 40, fat: 16, sugar: 3,  fiber: 8  },
      { day: 4, food_name: 'Almond + Apel',                             calories: 250, carbs: 30, protein: 6,  fat: 14, sugar: 20, fiber: 5  },
      { day: 4, food_name: 'Sup Ayam Kampung + Nasi Merah',             calories: 620, carbs: 68, protein: 46, fat: 12, sugar: 4,  fiber: 6  },
      { day: 4, food_name: 'Roti Gandum + Telur Dadar + Keju',          calories: 380, carbs: 36, protein: 22, fat: 16, sugar: 4,  fiber: 4  },
      { day: 4, food_name: 'Nasi + Dada Ayam Bakar + Sayur Tumis',      calories: 650, carbs: 74, protein: 50, fat: 10, sugar: 3,  fiber: 7  },
      // Day 3 ✅ goal hit (~3420 kcal)
      { day: 3, food_name: 'Bubur Oat + Chia Seed + Kiwi',              calories: 350, carbs: 58, protein: 10, fat: 7,  sugar: 14, fiber: 9  },
      { day: 3, food_name: 'Whey Protein Shake + Susu Almond',          calories: 310, carbs: 16, protein: 34, fat: 6,  sugar: 8,  fiber: 1  },
      { day: 3, food_name: 'Nasi + Ikan Bakar + Tumis Kangkung',        calories: 700, carbs: 84, protein: 44, fat: 12, sugar: 3,  fiber: 8  },
      { day: 3, food_name: 'Pisang + Kacang Tanah Rebus',               calories: 290, carbs: 38, protein: 10, fat: 12, sugar: 16, fiber: 5  },
      { day: 3, food_name: 'Chicken Breast Grill + Sweet Potato',       calories: 690, carbs: 72, protein: 56, fat: 10, sugar: 10, fiber: 7  },
      { day: 3, food_name: 'Greek Yogurt + Granola',                    calories: 320, carbs: 40, protein: 16, fat: 8,  sugar: 18, fiber: 3  },
      { day: 3, food_name: 'Nasi Merah + Telur Rebus 2 + Tahu Goreng',  calories: 760, carbs: 86, protein: 36, fat: 22, sugar: 3,  fiber: 6  },
      // Day 2 ❌ rest day, ate less (~1430 kcal)
      { day: 2, food_name: 'Telur Dadar Putih Telur + Sayur',           calories: 280, carbs: 10, protein: 28, fat: 12, sugar: 3,  fiber: 4  },
      { day: 2, food_name: 'Nasi Merah + Rendang Ayam (sedikit)',       calories: 640, carbs: 78, protein: 36, fat: 16, sugar: 5,  fiber: 5  },
      { day: 2, food_name: 'Tahu Kukus + Edamame + Nasi Merah',         calories: 510, carbs: 64, protein: 32, fat: 8,  sugar: 4,  fiber: 11 },
      // Day 1 ❌ skip gym, busy day (~1680 kcal)
      { day: 1, food_name: 'Overnight Oats + Susu Almond',              calories: 390, carbs: 60, protein: 14, fat: 8,  sugar: 16, fiber: 8  },
      { day: 1, food_name: 'Nasi + Ayam Bakar + Lalapan + Tempe',       calories: 670, carbs: 80, protein: 46, fat: 13, sugar: 4,  fiber: 9  },
      { day: 1, food_name: 'Salmon Teriyaki + Nasi Merah',              calories: 620, carbs: 65, protein: 44, fat: 17, sugar: 8,  fiber: 5  },
    ],
  },
  {
    // ── User B: sedentary, junk food ──
    email:    'dinda@nutrisee.dev',
    password: 'password123',
    profile: {
      nickname:       'Dinda',
      gender:         'perempuan',
      date_of_birth:  '2000-07-22',   // 24 yo
      height:         158,
      weight:         68,
      activity_level: 'sedentary',
      diet_goal:      'lose_weight',
    },
    location: 'Melawai, Jakarta Selatan',
    meals: [
      // Day 7
      { day: 7, food_name: 'Indomie Goreng + Telur Ceplok',          calories: 620, carbs: 82, protein: 16, fat: 24, sugar: 6,  fiber: 2  },
      { day: 7, food_name: 'Burger BK Double + French Fries L',       calories: 980, carbs: 96, protein: 32, fat: 52, sugar: 12, fiber: 3  },
      { day: 7, food_name: 'Es Krim McFlurry + Nugget 10pcs',         calories: 780, carbs: 88, protein: 18, fat: 38, sugar: 42, fiber: 1  },
      // Day 6
      { day: 6, food_name: 'Pop Mie Cup + Keripik Chitato',           calories: 550, carbs: 74, protein: 8,  fat: 22, sugar: 5,  fiber: 1  },
      { day: 6, food_name: 'KFC 2pcs Ayam + Nasi + Pepsi',            calories: 1050, carbs: 90, protein: 38, fat: 52, sugar: 28, fiber: 2 },
      { day: 6, food_name: 'Gorengan 4pcs + Es Teh Manis Jumbo',      calories: 520, carbs: 68, protein: 6,  fat: 26, sugar: 30, fiber: 1  },
      // Day 5
      { day: 5, food_name: 'Roti Putih + Selai Coklat Nutella',       calories: 440, carbs: 68, protein: 6,  fat: 16, sugar: 36, fiber: 2  },
      { day: 5, food_name: 'Pizza Hut Personal 1 loyang',             calories: 980, carbs: 110, protein: 34, fat: 44, sugar: 14, fiber: 4 },
      { day: 5, food_name: 'Mie Ayam Bakso + Es Teh Manis',           calories: 720, carbs: 90, protein: 20, fat: 28, sugar: 22, fiber: 2  },
      // Day 4
      { day: 4, food_name: 'Donut JCo x2 + Kopi Susu Gula Aren',     calories: 680, carbs: 94, protein: 8,  fat: 26, sugar: 58, fiber: 1  },
      { day: 4, food_name: 'McD Big Mac + McFlurry + Coke',           calories: 1150, carbs: 128, protein: 30, fat: 54, sugar: 60, fiber: 2 },
      { day: 4, food_name: 'Indomie Kuah + Sosis 2pcs',               calories: 560, carbs: 76, protein: 14, fat: 22, sugar: 4,  fiber: 1  },
      // Day 3
      { day: 3, food_name: 'Roti Bakar Tebal + Susu Coklat',          calories: 510, carbs: 76, protein: 10, fat: 18, sugar: 32, fiber: 2  },
      { day: 3, food_name: 'Nasi Goreng Telur + Es Jeruk Manis',      calories: 750, carbs: 98, protein: 16, fat: 28, sugar: 26, fiber: 2  },
      { day: 3, food_name: 'Fried Chicken + Kentang Goreng + Soda',   calories: 920, carbs: 88, protein: 28, fat: 48, sugar: 18, fiber: 2  },
      // Day 2
      { day: 2, food_name: 'Boba Taro Brown Sugar + Croissant',       calories: 620, carbs: 90, protein: 6,  fat: 20, sugar: 54, fiber: 1  },
      { day: 2, food_name: 'Warteg: Nasi + Ayam Goreng + Sambel',     calories: 860, carbs: 96, protein: 28, fat: 36, sugar: 8,  fiber: 3  },
      { day: 2, food_name: 'Seblak Komplit Level 4',                  calories: 680, carbs: 80, protein: 18, fat: 28, sugar: 6,  fiber: 3  },
      // Day 1 (yesterday)
      { day: 1, food_name: 'Cereal Sugarpops + Susu Full Cream',      calories: 480, carbs: 82, protein: 8,  fat: 14, sugar: 46, fiber: 2  },
      { day: 1, food_name: 'Sushi Indomaret + Pocari Sweat',          calories: 620, carbs: 96, protein: 14, fat: 12, sugar: 30, fiber: 2  },
      { day: 1, food_name: 'Mie Goreng Jawa + Kerupuk + Boba',        calories: 890, carbs: 110, protein: 18, fat: 34, sugar: 42, fiber: 2  },
    ],
  },
  {
    // ── User C: Nadya — bad habits → gradually improving, with cheat days ──
    // Goal: ~1470 kcal/day  |  Arc: days 14–11 bad → 10–9 transition → 8–1 clean + 2 cheat days
    email:    'nadya@nutrisee.dev',
    password: 'password123',
    profile: {
      nickname:       'Nadya',
      gender:         'perempuan',
      date_of_birth:  '1997-05-10',   // 29 yo
      height:         163,
      weight:         72,
      activity_level: 'light',
      diet_goal:      'lose_weight',
    },
    location: 'Kemang, Jakarta Selatan',

    // Weight logs: shows weight creeping up during bad phase, then dropping
    weights: [
      { daysBack: 14, weight: 72.0 },  // baseline weigh-in
      { daysBack: 11, weight: 72.6 },  // peak — bad eating pushed it up
      { daysBack:  8, weight: 72.3 },  // starting to improve
      { daysBack:  5, weight: 71.9 },  // dropping 💪
      { daysBack:  2, weight: 71.5 },  // consistent progress
      { daysBack:  0, weight: 71.2 },  // today's weigh-in
    ],

    meals: [
      // ── BAD PHASE ── Days 14–11  (~2200–2780 kcal/day, goal is ~1470)

      // Day 14 — ~2580 kcal 🍟
      { day: 14, food_name: 'Roti Putih Selai Nutella + Susu Full Cream',         calories: 520, carbs: 80, protein: 8,  fat: 18, sugar: 42, fiber: 2 },
      { day: 14, food_name: 'McD Spicy Chicken Burger + Large Fries + Coke',      calories: 1080, carbs: 130, protein: 28, fat: 52, sugar: 48, fiber: 3 },
      { day: 14, food_name: 'Indomie Goreng Spesial x2 + Telur Ceplok + Sosis',  calories: 980, carbs: 130, protein: 22, fat: 38, sugar: 10, fiber: 2 },

      // Day 13 — ~2780 kcal 🍕
      { day: 13, food_name: 'Boba Matcha Brown Sugar + Croissant Keju',           calories: 680, carbs: 96, protein: 8,  fat: 24, sugar: 58, fiber: 1 },
      { day: 13, food_name: 'Pizza Hut Personal Pepperoni + Sprite',              calories: 1100, carbs: 120, protein: 36, fat: 50, sugar: 22, fiber: 3 },
      { day: 13, food_name: 'Mie Ayam Jumbo + Bakso 5biji + Es Teh Manis',       calories: 1000, carbs: 120, protein: 24, fat: 38, sugar: 28, fiber: 2 },

      // Day 12 — ~2420 kcal 🍗
      { day: 12, food_name: 'Donut JCo x2 + Kopi Susu Gula Aren',                calories: 620, carbs: 88, protein: 7,  fat: 24, sugar: 54, fiber: 1 },
      { day: 12, food_name: 'Nasi Goreng Spesial + Kerupuk x4 + Es Jeruk',       calories: 820, carbs: 108, protein: 20, fat: 32, sugar: 28, fiber: 2 },
      { day: 12, food_name: 'KFC 2pcs Ayam + Nasi + Coleslaw + Pepsi',           calories: 980, carbs: 100, protein: 36, fat: 50, sugar: 26, fiber: 2 },

      // Day 11 — ~2180 kcal 😬 (still bad but slightly less)
      { day: 11, food_name: 'Cereal Coco Pops + Susu Full Cream',                 calories: 460, carbs: 76, protein: 7,  fat: 14, sugar: 48, fiber: 2 },
      { day: 11, food_name: 'Seblak Basah Komplit + Cilok Bumbu Kacang',          calories: 780, carbs: 96, protein: 22, fat: 30, sugar: 12, fiber: 3 },
      { day: 11, food_name: 'Nasi + Ayam Goreng Tepung x2 + Gorengan + Teh Botol', calories: 940, carbs: 110, protein: 30, fat: 44, sugar: 24, fiber: 3 },

      // ── TRANSITION ── Days 10–9  (~1650–1780 kcal, still over but improving)

      // Day 10 — ~1780 kcal 🤔
      { day: 10, food_name: 'Indomie Kuah + Telur Rebus',                         calories: 480, carbs: 64, protein: 16, fat: 18, sugar: 6,  fiber: 2 },
      { day: 10, food_name: 'Nasi Putih + Sayur Asem + Ikan Goreng + Tempe',     calories: 680, carbs: 80, protein: 28, fat: 20, sugar: 4,  fiber: 6 },
      { day: 10, food_name: 'Bakso Kuah 8biji + Mie + Sayuran',                  calories: 620, carbs: 78, protein: 18, fat: 22, sugar: 5,  fiber: 3 },

      // Day 9 — ~1650 kcal 🙂 (getting there)
      { day: 9, food_name: 'Roti Gandum + Telur Rebus 2 + Susu Rendah Lemak',    calories: 420, carbs: 46, protein: 22, fat: 14, sugar: 8,  fiber: 4 },
      { day: 9, food_name: 'Nasi Putih + Tumis Kangkung + Ayam Rebus',           calories: 620, carbs: 74, protein: 30, fat: 14, sugar: 4,  fiber: 5 },
      { day: 9, food_name: 'Bubur Ayam + Cakwe 1biji + Teh Tawar Hangat',        calories: 610, carbs: 78, protein: 20, fat: 20, sugar: 5,  fiber: 3 },

      // ── GOOD PHASE ── Days 8–1  (clean eating ~1380–1470 kcal, 2 cheat days)

      // Day 8 — ~1420 kcal ✅ clean
      { day: 8, food_name: 'Oatmeal + Pisang + Madu',                            calories: 320, carbs: 58, protein: 8,  fat: 4,  sugar: 22, fiber: 6 },
      { day: 8, food_name: 'Nasi Merah + Tumis Brokoli + Dada Ayam Rebus',       calories: 580, carbs: 68, protein: 36, fat: 10, sugar: 4,  fiber: 7 },
      { day: 8, food_name: 'Sup Sayuran + Tahu Kukus + Tempe + Nasi Sedikit',    calories: 520, carbs: 60, protein: 24, fat: 12, sugar: 5,  fiber: 8 },

      // Day 7 — ~2060 kcal 🎉 CHEAT DAY (weekend)
      { day: 7, food_name: 'Pancake x3 + Madu + Susu Full Cream',                calories: 580, carbs: 82, protein: 12, fat: 20, sugar: 34, fiber: 2 },
      { day: 7, food_name: 'Pizza Personal + Salad Sayur',                        calories: 720, carbs: 84, protein: 26, fat: 30, sugar: 10, fiber: 5 },
      { day: 7, food_name: 'Nasi Goreng Kampung + Kerupuk + Es Teh Manis',       calories: 760, carbs: 96, protein: 18, fat: 28, sugar: 24, fiber: 2 },

      // Day 6 — ~1380 kcal ✅ clean (bounce back after cheat)
      { day: 6, food_name: 'Telur Rebus 2 + Roti Gandum + Kopi Hitam',           calories: 380, carbs: 36, protein: 20, fat: 14, sugar: 4,  fiber: 4 },
      { day: 6, food_name: 'Nasi Merah + Ikan Kukus + Sayur Rebus',              calories: 560, carbs: 68, protein: 30, fat: 10, sugar: 4,  fiber: 6 },
      { day: 6, food_name: 'Sup Ayam Kampung (tanpa nasi) + Tahu Kukus',         calories: 440, carbs: 20, protein: 32, fat: 18, sugar: 3,  fiber: 4 },

      // Day 5 — ~1460 kcal ✅ clean
      { day: 5, food_name: 'Smoothie Pisang Oat + Susu Rendah Lemak',            calories: 360, carbs: 62, protein: 12, fat: 6,  sugar: 26, fiber: 5 },
      { day: 5, food_name: 'Nasi Merah + Tempe Bacem + Tumis Kangkung',          calories: 540, carbs: 72, protein: 22, fat: 12, sugar: 6,  fiber: 8 },
      { day: 5, food_name: 'Gado-gado Sedang (tanpa lontong) + Teh Tawar',       calories: 560, carbs: 52, protein: 20, fat: 28, sugar: 8,  fiber: 7 },

      // Day 4 — ~1920 kcal 🎉 CHEAT DAY (friend's gathering)
      { day: 4, food_name: 'Nasi Uduk + Ayam Goreng + Kerupuk',                  calories: 720, carbs: 84, protein: 24, fat: 30, sugar: 6,  fiber: 2 },
      { day: 4, food_name: 'Soto Ayam Komplit + Nasi + Es Teh Manis',            calories: 680, carbs: 78, protein: 26, fat: 24, sugar: 22, fiber: 3 },
      { day: 4, food_name: 'Pisang Goreng x3 + Kopi Susu Gula Aren',             calories: 520, carbs: 80, protein: 6,  fat: 18, sugar: 38, fiber: 3 },

      // Day 3 — ~1440 kcal ✅ clean (back on track)
      { day: 3, food_name: 'Greek Yogurt Rendah Lemak + Granola Sedikit + Stroberi', calories: 320, carbs: 42, protein: 16, fat: 8,  sugar: 22, fiber: 4 },
      { day: 3, food_name: 'Nasi Merah + Ayam Panggang Tanpa Kulit + Brokoli',   calories: 580, carbs: 64, protein: 38, fat: 10, sugar: 4,  fiber: 7 },
      { day: 3, food_name: 'Sup Tahu Bayam + Nasi Sedikit (100g)',               calories: 540, carbs: 56, protein: 22, fat: 16, sugar: 4,  fiber: 6 },

      // Day 2 — ~1380 kcal ✅ clean
      { day: 2, food_name: 'Oatmeal + Susu Almond + Pisang',                     calories: 340, carbs: 58, protein: 10, fat: 8,  sugar: 20, fiber: 6 },
      { day: 2, food_name: 'Nasi Merah + Ikan Bakar + Lalapan + Sambal',         calories: 560, carbs: 66, protein: 32, fat: 12, sugar: 3,  fiber: 6 },
      { day: 2, food_name: 'Tumis Bayam Bawang Putih + Tahu + Nasi Sedikit',     calories: 480, carbs: 54, protein: 22, fat: 14, sugar: 3,  fiber: 7 },

      // Day 1 — ~1420 kcal ✅ clean
      { day: 1, food_name: 'Roti Gandum + Alpukat + Telur Rebus',                calories: 400, carbs: 38, protein: 18, fat: 18, sugar: 4,  fiber: 7 },
      { day: 1, food_name: 'Nasi Merah + Dada Ayam Bumbu Rempah + Sayur Tumis',  calories: 580, carbs: 68, protein: 38, fat: 10, sugar: 4,  fiber: 7 },
      { day: 1, food_name: 'Sup Jagung Wortel + Tempe Kukus + Nasi Sedikit',     calories: 440, carbs: 56, protein: 20, fat: 12, sugar: 8,  fiber: 8 },

      // Day 0 (today) — partial day ~700 kcal ✅
      { day: 0, food_name: 'Smoothie Buah Merah + Oat',                          calories: 320, carbs: 56, protein: 10, fat: 6,  sugar: 28, fiber: 5 },
      { day: 0, food_name: 'Salad Ayam Panggang + Dressing Lemon',               calories: 380, carbs: 24, protein: 32, fat: 16, sugar: 6,  fiber: 5 },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function mealTimestamp(daysBack, mealIndex) {
  // mealIndex: 0 = breakfast ~07:30, 1 = lunch ~12:45, 2 = dinner ~19:00
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  const hours   = [7, 12, 19][mealIndex % 3];
  const minutes = [30, 45, 0][mealIndex % 3];
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

function weightTimestamp(daysBack) {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  d.setHours(7, 0, 0, 0); // logged first thing in the morning
  return d.toISOString();
}

// ─── Reset ────────────────────────────────────────────────────────────────────
async function reset() {
  console.log('🗑️  Resetting seed data...');
  const emails = SEED_USERS.map(u => u.email);
  // Cascade delete handles user_profiles, meal_logs, weight_logs, ai_overviews
  await pool.query(`DELETE FROM users WHERE email = ANY($1::text[])`, [emails]);
  console.log('✅  Seed data wiped.\n');
}

// ─── Seed ─────────────────────────────────────────────────────────────────────
async function seed(users = SEED_USERS) {
  for (const userData of users) {
    const { email, password, profile, meals, weights } = userData;
    console.log(`\n👤  Seeding: ${profile.nickname} (${email})`);

    // 1. Create auth user
    const hashedPassword = await bcrypt.hash(password, 10);
    const userResult = await pool.query(
      `INSERT INTO users (email, password, provider) VALUES ($1, $2, 'email') RETURNING id`,
      [email, hashedPassword]
    );
    const userId = userResult.rows[0].id;
    console.log(`   ✅ User created → ${userId}`);

    // 2. Calculate calorie goal
    const { nickname, gender, date_of_birth, height, weight, activity_level, diet_goal } = profile;
    const dailyCalorieGoal = calculateCalorieGoal(
      weight, height, date_of_birth, gender, activity_level, diet_goal
    );
    console.log(`   📊 Calorie goal: ${dailyCalorieGoal} kcal/day`);

    // 3. Create profile
    await pool.query(
      `INSERT INTO user_profiles
         (user_id, nickname, gender, date_of_birth, height, weight, activity_level, diet_goal, daily_calorie_goal)
       VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8, $9)`,
      [userId, nickname, gender, date_of_birth, height, weight, activity_level, diet_goal, dailyCalorieGoal]
    );
    console.log(`   ✅ Profile saved`);

    // 4. Insert meal logs grouped by day
    const mealsByDay = {};
    for (const meal of meals) {
      if (!mealsByDay[meal.day]) mealsByDay[meal.day] = [];
      mealsByDay[meal.day].push(meal);
    }

    let mealCount = 0;
    const dayCount = Object.keys(mealsByDay).length;
    for (const [day, dayMeals] of Object.entries(mealsByDay)) {
      for (let i = 0; i < dayMeals.length; i++) {
        const m = dayMeals[i];
        await pool.query(
          `INSERT INTO meal_logs
             (user_id, food_name, description, calories, carbs, protein, fat, sugar, fiber,
              vitamin_a, vitamin_c, vitamin_d, calcium, cholesterol, location, logged_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
          [
            userId, m.food_name, m.food_name,
            m.calories, m.carbs, m.protein, m.fat, m.sugar, m.fiber,
            0, 0, 0, 0, 0,
            userData.location, mealTimestamp(Number(day), i),
          ]
        );
        mealCount++;
      }
    }
    console.log(`   ✅ ${mealCount} meals inserted across ${dayCount} days`);

    // 5. Insert weight logs (optional)
    if (weights && weights.length > 0) {
      for (const w of weights) {
        await pool.query(
          `INSERT INTO weight_logs (user_id, weight, logged_at) VALUES ($1, $2, $3)`,
          [userId, w.weight, weightTimestamp(w.daysBack)]
        );
      }
      console.log(`   ✅ ${weights.length} weight entries inserted`);
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const shouldReset = process.argv.includes('--reset');
  const onlyIndex   = process.argv.indexOf('--only');
  const onlyName    = onlyIndex !== -1 ? process.argv[onlyIndex + 1]?.toLowerCase() : null;

  try {
    console.log('🔌  Connecting to database...');
    await pool.query('SELECT 1'); // test connection
    console.log('✅  Connected\n');

    if (shouldReset) await reset();

    // Filter to a specific user if --only <nickname> is passed
    const usersToSeed = onlyName
      ? SEED_USERS.filter(u => u.profile.nickname.toLowerCase() === onlyName)
      : SEED_USERS;

    if (onlyName && usersToSeed.length === 0) {
      console.error(`❌  No user found with nickname "${onlyName}". Available: ${SEED_USERS.map(u => u.profile.nickname).join(', ')}`);
      process.exit(1);
    }

    await seed(usersToSeed);

    console.log('\n🌱  Seeding complete!');
    console.log('─'.repeat(56));
    console.log('📋  Credentials:');
    for (const u of SEED_USERS) {
      const goal = calculateCalorieGoal(
        u.profile.weight, u.profile.height, u.profile.date_of_birth,
        u.profile.gender, u.profile.activity_level, u.profile.diet_goal
      );
      console.log(`   ${u.profile.nickname.padEnd(8)} ${u.email.padEnd(28)} password123  (${goal} kcal/day)`);
    }
    console.log('─'.repeat(56));
  } catch (err) {
    console.error('\n❌  Seed failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

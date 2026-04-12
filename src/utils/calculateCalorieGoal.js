const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
};

const DIET_GOAL_ADJUSTMENT = {
  lose_weight: -500,
  maintain_weight: 0,
  gain_weight: +500,
};

const calculateCalorieGoal = (weight, height, dateOfBirth, gender, activityLevel = 'moderate', dietGoal = 'maintain_weight') => {
  const age = Math.floor(
    (new Date() - new Date(dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000)
  );

  let bmr;
  if (gender.toLowerCase() === 'male' || gender.toLowerCase() === 'laki-laki') {
    bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
  } else {
    bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161;
  }

  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] || 1.55;
  const tdee = Math.round(bmr * multiplier);

  const adjustment = DIET_GOAL_ADJUSTMENT[dietGoal] ?? 0;
  const finalGoal = tdee + adjustment;

  // Never go below 1200 kcal (minimum safe intake)
  return Math.max(1200, finalGoal);
};

module.exports = calculateCalorieGoal;
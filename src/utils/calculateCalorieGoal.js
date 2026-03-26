const calculateCalorieGoal = (weight, height, dateOfBirth, gender) => {
  const age = Math.floor(
    (new Date() - new Date(dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000)
  );

  let bmr;
  if (gender.toLowerCase() === 'male') {
    bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
  } else {
    bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161;
  }

  // Multiply by activity factor (moderately active = 1.55)
  const tdee = Math.round(bmr * 1.55);
  return tdee;
};

module.exports = calculateCalorieGoal;
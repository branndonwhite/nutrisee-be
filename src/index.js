require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const dietaryRoutes = require('./routes/dietary');
const dashboardRoutes = require('./routes/dashboard');
const mealRoutes = require('./routes/meals');
const factsRoutes = require('./routes/facts');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/dietary', dietaryRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/meals', mealRoutes);
app.use('/api/facts', factsRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
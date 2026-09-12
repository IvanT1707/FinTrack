require('dotenv').config();

const express = require('express');
const sequelize = require('./config/database');
const User = require('./models/User');
const RefreshToken = require('./models/RefreshToken');

const app = express();
const port = process.env.PORT || 3000;

User.hasMany(RefreshToken, {
  foreignKey: 'user_id',
  onDelete: 'CASCADE'
});

RefreshToken.belongsTo(User, {
  foreignKey: 'user_id'
});

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established');

    await sequelize.sync({ force: false });
    console.log('Database tables synced');

    app.listen(port, () => {
      console.log(`FinTrack API is running on port ${port}`);
    });
  } catch (error) {
    console.error('Unable to connect to the database:', error.message);
    process.exit(1);
  }
}

startServer();

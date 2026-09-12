require('dotenv').config();

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const sequelize = require('./config/database');
const User = require('./models/User');
const RefreshToken = require('./models/RefreshToken');

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

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

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function createAccessToken(user) {
  return jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '15m' });
}

function createRefreshToken(user) {
  return jwt.sign({ userId: user.id, type: 'refresh' }, JWT_SECRET, { expiresIn: '7d' });
}

app.post('/api/auth/register', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const fullName = String(req.body.full_name || '').trim();

    if (!email || !password || !fullName) {
      return res.status(400).json({ message: 'Email, password and full name are required' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must contain at least 8 characters' });
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email,
      passwordHash,
      fullName
    });

    return res.status(201).json({
      id: user.id,
      email: user.email,
      full_name: user.fullName
    });
  } catch (error) {
    return res.status(500).json({ message: 'Registration failed', error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordCorrect) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);

    await RefreshToken.create({
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    return res.status(200).json({
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.fullName
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Login failed', error: error.message });
  }
});

app.post('/api/auth/refresh', async (req, res) => {
  try {
    const refreshToken = String(req.body.refresh_token || '');

    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token is required' });
    }

    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    const storedToken = await RefreshToken.findOne({
      where: {
        token: refreshToken,
        userId: decoded.userId,
        expiresAt: { [Op.gt]: new Date() }
      }
    });

    if (!storedToken) {
      return res.status(401).json({ message: 'Refresh token is invalid or expired' });
    }

    const user = await User.findByPk(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const accessToken = createAccessToken(user);
    return res.status(200).json({ access_token: accessToken });
  } catch (error) {
    return res.status(401).json({ message: 'Refresh token is invalid or expired' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    const refreshToken = String(req.body.refresh_token || '');

    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }

    await RefreshToken.destroy({ where: { token: refreshToken } });
    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Logout failed', error: error.message });
  }
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

module.exports = app;

if (require.main === module) {
  startServer();
}

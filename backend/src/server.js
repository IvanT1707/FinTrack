require('dotenv').config();

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const sequelize = require('./config/database');
const User = require('./models/User');
const RefreshToken = require('./models/RefreshToken');
const Category = require('./models/Category');
const Transaction = require('./models/Transaction');

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

User.hasMany(Category, {
  foreignKey: 'user_id',
  onDelete: 'CASCADE'
});

Category.belongsTo(User, {
  foreignKey: 'user_id'
});

User.hasMany(Transaction, {
  foreignKey: 'user_id',
  onDelete: 'CASCADE'
});

Category.hasMany(Transaction, {
  foreignKey: 'category_id'
});

Transaction.belongsTo(User, {
  foreignKey: 'user_id'
});

Transaction.belongsTo(Category, {
  foreignKey: 'category_id'
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

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Authorization token is required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
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

app.get('/api/categories', authMiddleware, async (req, res) => {
  try {
    const categories = await Category.findAll({
      where: {
        [Op.or]: [
          { userId: req.user.userId },
          { userId: null }
        ]
      },
      order: [['name', 'ASC']]
    });

    return res.status(200).json(categories);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch categories', error: error.message });
  }
});

app.post('/api/categories', authMiddleware, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const type = String(req.body.type || '').trim();

    if (!name || name.length < 1 || name.length > 100) {
      return res.status(400).json({ message: 'Category name must be 1-100 characters' });
    }

    if (!['income', 'expense'].includes(type)) {
      return res.status(400).json({ message: 'Type must be income or expense' });
    }

    const category = await Category.create({
      userId: req.user.userId,
      name,
      type
    });

    return res.status(201).json(category);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create category', error: error.message });
  }
});

app.get('/api/transactions', authMiddleware, async (req, res) => {
  try {
    const transactions = await Transaction.findAll({
      where: { userId: req.user.userId },
      include: [
        {
          model: Category,
          attributes: ['id', 'name', 'type']
        }
      ],
      order: [['transactionDate', 'DESC']]
    });

    return res.status(200).json(transactions);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch transactions', error: error.message });
  }
});

app.post('/api/transactions', authMiddleware, async (req, res) => {
  try {
    const categoryId = Number(req.body.category_id);
    const amount = Number(req.body.amount);
    const type = String(req.body.type || '').trim();
    const description = req.body.description ? String(req.body.description).trim() : null;
    const transactionDate = req.body.transaction_date ? String(req.body.transaction_date).trim() : null;

    if (!categoryId || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: 'Amount must be a positive number' });
    }

    if (!['income', 'expense'].includes(type)) {
      return res.status(400).json({ message: 'Type must be income or expense' });
    }

    const category = await Category.findOne({
      where: {
        id: categoryId,
        [Op.or]: [{ userId: req.user.userId }, { userId: null }]
      }
    });

    if (!category) {
      return res.status(400).json({ message: 'Category does not exist or does not belong to this user' });
    }

    if (!transactionDate) {
      return res.status(400).json({ message: 'transaction_date is required' });
    }

    const transaction = await Transaction.create({
      userId: req.user.userId,
      categoryId,
      amount,
      type,
      description,
      transactionDate
    });

    return res.status(201).json(transaction);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create transaction', error: error.message });
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

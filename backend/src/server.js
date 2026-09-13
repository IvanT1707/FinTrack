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
const BudgetLimit = require('./models/BudgetLimit');
const { calculateBudgetStatus } = require('./utils/budget');
const { forecastCategory } = require('./utils/forecast');

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

User.hasMany(BudgetLimit, {
  foreignKey: 'user_id',
  onDelete: 'CASCADE'
});

Category.hasMany(BudgetLimit, {
  foreignKey: 'category_id'
});

BudgetLimit.belongsTo(User, {
  foreignKey: 'user_id'
});

BudgetLimit.belongsTo(Category, {
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

app.get('/api/budget-limits', authMiddleware, async (req, res) => {
  try {
    const month = Number(req.query.month);
    const year = Number(req.query.year);

    const limits = await BudgetLimit.findAll({
      where: {
        userId: req.user.userId,
        periodMonth: month,
        periodYear: year
      },
      include: [{ model: Category, attributes: ['id', 'name', 'type'] }],
      order: [['createdAt', 'DESC']]
    });

    const startDate = new Date(year, month - 1, 1);
    const nextMonthDate = month === 12 ? new Date(year + 1, 0, 1) : new Date(year, month, 1);

    const result = await Promise.all(
      limits.map(async (limit) => {
        const spent = await Transaction.sum('amount', {
          where: {
            userId: req.user.userId,
            categoryId: limit.categoryId,
            type: 'expense',
            transactionDate: {
              [Op.gte]: startDate.toISOString().slice(0, 10),
              [Op.lt]: nextMonthDate.toISOString().slice(0, 10)
            }
          }
        });

        const safeSpent = Number(spent || 0);
        const summary = calculateBudgetStatus(Number(limit.limitAmount), safeSpent);

        return {
          id: limit.id,
          category: limit.Category ? limit.Category.name : null,
          category_id: limit.categoryId,
          limit_amount: Number(limit.limitAmount).toFixed(2),
          spent: safeSpent,
          percent: summary ? summary.percent : 0,
          status: summary ? summary.status : 'ok'
        };
      })
    );

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch budget limits', error: error.message });
  }
});

app.post('/api/budget-limits', authMiddleware, async (req, res) => {
  try {
    const categoryId = Number(req.body.category_id);
    const limitAmount = Number(req.body.limit_amount);
    const periodMonth = Number(req.body.period_month);
    const periodYear = Number(req.body.period_year);

    if (!categoryId || !Number.isFinite(limitAmount) || limitAmount <= 0) {
      return res.status(400).json({ message: 'limit_amount must be a positive number' });
    }

    if (!Number.isInteger(periodMonth) || periodMonth < 1 || periodMonth > 12) {
      return res.status(400).json({ message: 'period_month must be between 1 and 12' });
    }

    if (!Number.isInteger(periodYear)) {
      return res.status(400).json({ message: 'period_year is required' });
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

    const limit = await BudgetLimit.create({
      userId: req.user.userId,
      categoryId,
      limitAmount,
      periodMonth,
      periodYear
    });

    return res.status(201).json({
      id: limit.id,
      user_id: limit.userId,
      category_id: limit.categoryId,
      limit_amount: Number(limit.limitAmount).toFixed(2),
      period_month: limit.periodMonth,
      period_year: limit.periodYear
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create budget limit', error: error.message });
  }
});

app.put('/api/budget-limits/:id', authMiddleware, async (req, res) => {
  try {
    const limit = await BudgetLimit.findOne({
      where: {
        id: Number(req.params.id),
        userId: req.user.userId
      }
    });

    if (!limit) {
      return res.status(404).json({ message: 'Budget limit not found' });
    }

    const categoryId = Number(req.body.category_id ?? limit.categoryId);
    const limitAmount = Number(req.body.limit_amount ?? limit.limitAmount);
    const periodMonth = Number(req.body.period_month ?? limit.periodMonth);
    const periodYear = Number(req.body.period_year ?? limit.periodYear);

    if (!categoryId || !Number.isFinite(limitAmount) || limitAmount <= 0) {
      return res.status(400).json({ message: 'limit_amount must be a positive number' });
    }

    if (!Number.isInteger(periodMonth) || periodMonth < 1 || periodMonth > 12) {
      return res.status(400).json({ message: 'period_month must be between 1 and 12' });
    }

    if (!Number.isInteger(periodYear)) {
      return res.status(400).json({ message: 'period_year is required' });
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

    await limit.update({ categoryId, limitAmount, periodMonth, periodYear });

    return res.status(200).json({
      id: limit.id,
      user_id: limit.userId,
      category_id: limit.categoryId,
      limit_amount: Number(limit.limitAmount).toFixed(2),
      period_month: limit.periodMonth,
      period_year: limit.periodYear
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update budget limit', error: error.message });
  }
});

app.delete('/api/budget-limits/:id', authMiddleware, async (req, res) => {
  try {
    const deletedCount = await BudgetLimit.destroy({
      where: {
        id: Number(req.params.id),
        userId: req.user.userId
      }
    });

    if (!deletedCount) {
      return res.status(404).json({ message: 'Budget limit not found' });
    }

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete budget limit', error: error.message });
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

app.get('/api/forecast', authMiddleware, async (req, res) => {
  try {
    const month = Number(req.query.month);
    const year = Number(req.query.year);

    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return res.status(400).json({ message: 'month must be between 1 and 12' });
    }

    if (!Number.isInteger(year)) {
      return res.status(400).json({ message: 'year is required' });
    }

    const targetStart = new Date(Date.UTC(year, month - 1, 1));
    const historyStart = new Date(Date.UTC(year, month - 4, 1));
    const toDateOnly = (date) => date.toISOString().slice(0, 10);

    const categories = await Category.findAll({
      where: {
        type: 'expense',
        [Op.or]: [{ userId: req.user.userId }, { userId: null }]
      },
      order: [['name', 'ASC']]
    });

    const transactions = await Transaction.findAll({
      where: {
        userId: req.user.userId,
        type: 'expense',
        transactionDate: {
          [Op.gte]: toDateOnly(historyStart),
          [Op.lt]: toDateOnly(targetStart)
        }
      },
      attributes: ['amount', 'categoryId', 'transactionDate']
    });

    const historyMonths = Array.from({ length: 3 }, (_, index) => {
      const date = new Date(Date.UTC(year, month - 4 + index, 1));

      return {
        key: date.toISOString().slice(0, 7),
        categories: new Map()
      };
    });

    const monthsByKey = new Map(historyMonths.map((item) => [item.key, item]));

    transactions.forEach((transaction) => {
      const monthTotals = monthsByKey.get(String(transaction.transactionDate).slice(0, 7));

      if (monthTotals) {
        const categoryTotal = monthTotals.categories.get(transaction.categoryId) || 0;
        monthTotals.categories.set(transaction.categoryId, categoryTotal + Number(transaction.amount));
      }
    });

    const categoryForecasts = categories.map((category) => {
      const history = historyMonths.map((monthTotals) => monthTotals.categories.get(category.id) || 0);
      const forecast = forecastCategory(history);

      return {
        category_id: category.id,
        category: category.name,
        forecast: Number(forecast.toFixed(2))
      };
    });

    return res.status(200).json({
      month,
      year,
      categories: categoryForecasts,
      total_forecast: Number(
        categoryForecasts.reduce((sum, item) => sum + item.forecast, 0).toFixed(2)
      )
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to calculate forecast', error: error.message });
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

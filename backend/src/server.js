require('dotenv').config();

const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('../swagger.json');
const { Op } = require('sequelize');
const sequelize = require('./config/database');
const User = require('./models/User');
const RefreshToken = require('./models/RefreshToken');
const Category = require('./models/Category');
const Transaction = require('./models/Transaction');
const BudgetLimit = require('./models/BudgetLimit');
const setupAssociations = require('./models/associations');
const { calculateBudgetStatus } = require('./utils/budget');
const { forecastCategory } = require('./utils/forecast');
const { createAuthMiddleware } = require('./middleware/authMiddleware');
const { createAuthRouter } = require('./routes/authRoutes');
const { createCategoryRouter } = require('./routes/categoryRoutes');
const { createTransactionRouter } = require('./routes/transactionRoutes');

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be configured in backend/.env');
}

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173,http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim());

setupAssociations({ User, RefreshToken, Category, Transaction, BudgetLimit });

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Origin is not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

function isValidDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const authMiddleware = createAuthMiddleware(JWT_SECRET);
app.use('/api/auth', createAuthRouter(JWT_SECRET));
app.use('/api/categories', createCategoryRouter({
  Category,
  Transaction,
  BudgetLimit,
  authMiddleware
}));
app.use('/api/transactions', createTransactionRouter({
  Transaction,
  Category,
  authMiddleware,
  isValidDateOnly
}));

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

    if (category.type !== 'expense') {
      return res.status(400).json({ message: 'Budget limits can only be assigned to expense categories' });
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

    if (category.type !== 'expense') {
      return res.status(400).json({ message: 'Budget limits can only be assigned to expense categories' });
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

app.get('/api/analytics/summary', authMiddleware, async (req, res) => {
  try {
    const month = Number(req.query.month);
    const year = Number(req.query.year);

    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return res.status(400).json({ message: 'month must be between 1 and 12' });
    }

    if (!Number.isInteger(year)) {
      return res.status(400).json({ message: 'year is required' });
    }

    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 1));
    const transactions = await Transaction.findAll({
      where: {
        userId: req.user.userId,
        transactionDate: {
          [Op.gte]: startDate.toISOString().slice(0, 10),
          [Op.lt]: endDate.toISOString().slice(0, 10)
        }
      },
      attributes: ['amount', 'type']
    });

    const totalIncome = transactions
      .filter((transaction) => transaction.type === 'income')
      .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
    const totalExpense = transactions
      .filter((transaction) => transaction.type === 'expense')
      .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

    return res.status(200).json({
      month,
      year,
      total_income: Number(totalIncome.toFixed(2)),
      total_expense: Number(totalExpense.toFixed(2)),
      balance: Number((totalIncome - totalExpense).toFixed(2))
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to calculate analytics summary', error: error.message });
  }
});

app.get('/api/analytics/by-category', authMiddleware, async (req, res) => {
  try {
    const month = Number(req.query.month);
    const year = Number(req.query.year);

    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return res.status(400).json({ message: 'month must be between 1 and 12' });
    }

    if (!Number.isInteger(year)) {
      return res.status(400).json({ message: 'year is required' });
    }

    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 1));
    const transactions = await Transaction.findAll({
      where: {
        userId: req.user.userId,
        type: 'expense',
        transactionDate: {
          [Op.gte]: startDate.toISOString().slice(0, 10),
          [Op.lt]: endDate.toISOString().slice(0, 10)
        }
      },
      include: [{ model: Category, attributes: ['id', 'name'] }],
      attributes: ['amount', 'categoryId']
    });

    const totals = new Map();
    transactions.forEach((transaction) => {
      const current = totals.get(transaction.categoryId) || {
        category_id: transaction.categoryId,
        category: transaction.Category ? transaction.Category.name : null,
        total_expense: 0
      };
      current.total_expense += Number(transaction.amount);
      totals.set(transaction.categoryId, current);
    });

    return res.status(200).json({
      month,
      year,
      categories: [...totals.values()].map((item) => ({
        ...item,
        total_expense: Number(item.total_expense.toFixed(2))
      }))
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to calculate category analytics', error: error.message });
  }
});

app.get('/api/analytics/trend', authMiddleware, async (req, res) => {
  try {
    const months = Number(req.query.months || 6);
    const targetMonth = Number(req.query.month || new Date().getUTCMonth() + 1);
    const targetYear = Number(req.query.year || new Date().getUTCFullYear());

    if (!Number.isInteger(months) || months < 1 || months > 24) {
      return res.status(400).json({ message: 'months must be between 1 and 24' });
    }

    if (!Number.isInteger(targetMonth) || targetMonth < 1 || targetMonth > 12) {
      return res.status(400).json({ message: 'month must be between 1 and 12' });
    }

    if (!Number.isInteger(targetYear)) {
      return res.status(400).json({ message: 'year is required' });
    }

    const startDate = new Date(Date.UTC(targetYear, targetMonth - months - 1, 1));
    const endDate = new Date(Date.UTC(targetYear, targetMonth, 1));
    const transactions = await Transaction.findAll({
      where: {
        userId: req.user.userId,
        transactionDate: {
          [Op.gte]: startDate.toISOString().slice(0, 10),
          [Op.lt]: endDate.toISOString().slice(0, 10)
        }
      },
      attributes: ['amount', 'type', 'transactionDate']
    });

    const trend = Array.from({ length: months }, (_, index) => {
      const date = new Date(Date.UTC(targetYear, targetMonth - months + index, 1));
      return {
        month: date.toISOString().slice(0, 7),
        income: 0,
        expense: 0
      };
    });
    const trendByMonth = new Map(trend.map((item) => [item.month, item]));

    transactions.forEach((transaction) => {
      const item = trendByMonth.get(String(transaction.transactionDate).slice(0, 7));
      if (item) {
        item[transaction.type] += Number(transaction.amount);
      }
    });

    return res.status(200).json({
      months: trend.map((item) => ({
        ...item,
        balance: Number((item.income - item.expense).toFixed(2))
      }))
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to calculate analytics trend', error: error.message });
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

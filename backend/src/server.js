require('dotenv').config();

const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('../swagger.json');
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
const { createBudgetLimitRouter } = require('./routes/budgetLimitRoutes');
const { createForecastRouter } = require('./routes/forecastRoutes');
const { createAnalyticsRouter } = require('./routes/analyticsRoutes');

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
app.use('/api/budget-limits', createBudgetLimitRouter({
  BudgetLimit,
  Category,
  Transaction,
  authMiddleware,
  calculateBudgetStatus
}));
app.use('/api/forecast', createForecastRouter({
  Category,
  Transaction,
  authMiddleware,
  forecastCategory
}));
app.use('/api/analytics', createAnalyticsRouter({
  Transaction,
  Category,
  authMiddleware
}));



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


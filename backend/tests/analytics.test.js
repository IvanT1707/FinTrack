const request = require('supertest');
const app = require('../src/server');
const sequelize = require('../src/config/database');
const User = require('../src/models/User');
const RefreshToken = require('../src/models/RefreshToken');
const Category = require('../src/models/Category');
const Transaction = require('../src/models/Transaction');

beforeAll(async () => {
  await sequelize.sync({ force: false });
});

beforeEach(async () => {
  await RefreshToken.destroy({ where: {}, force: true });
  await Transaction.destroy({ where: {}, force: true });
  await Category.destroy({ where: {}, force: true });
  await User.destroy({ where: {}, force: true });
});

afterAll(async () => {
  await RefreshToken.destroy({ where: {}, force: true });
  await Transaction.destroy({ where: {}, force: true });
  await Category.destroy({ where: {}, force: true });
  await User.destroy({ where: {}, force: true });
  await sequelize.close();
});

async function createUserAndCategories() {
  const email = `analytics-${Date.now()}@example.com`;

  await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'SecurePass123', full_name: 'Analytics User' });

  const loginResponse = await request(app)
    .post('/api/auth/login')
    .send({ email, password: 'SecurePass123' });
  const token = loginResponse.body.access_token;

  const incomeResponse = await request(app)
    .post('/api/categories')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Зарплата', type: 'income' });
  const foodResponse = await request(app)
    .post('/api/categories')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Продукти', type: 'expense' });
  const transportResponse = await request(app)
    .post('/api/categories')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Транспорт', type: 'expense' });

  return {
    token,
    incomeId: incomeResponse.body.id,
    foodId: foodResponse.body.id,
    transportId: transportResponse.body.id
  };
}

async function createTransaction(token, categoryId, amount, type, transactionDate) {
  const response = await request(app)
    .post('/api/transactions')
    .set('Authorization', `Bearer ${token}`)
    .send({
      category_id: categoryId,
      amount,
      type,
      transaction_date: transactionDate
    });

  expect(response.status).toBe(201);
}

test('returns summary, category breakdown, and monthly trend', async () => {
  const { token, incomeId, foodId, transportId } = await createUserAndCategories();

  await createTransaction(token, incomeId, 5000, 'income', '2026-09-05');
  await createTransaction(token, foodId, 1200, 'expense', '2026-09-10');
  await createTransaction(token, transportId, 300, 'expense', '2026-09-12');
  await createTransaction(token, foodId, 1000, 'expense', '2026-08-10');

  const summaryResponse = await request(app)
    .get('/api/analytics/summary?month=9&year=2026')
    .set('Authorization', `Bearer ${token}`);

  expect(summaryResponse.status).toBe(200);
  expect(summaryResponse.body).toEqual({
    month: 9,
    year: 2026,
    total_income: 5000,
    total_expense: 1500,
    balance: 3500
  });

  const categoryResponse = await request(app)
    .get('/api/analytics/by-category?month=9&year=2026')
    .set('Authorization', `Bearer ${token}`);

  expect(categoryResponse.status).toBe(200);
  expect(categoryResponse.body.categories).toEqual([
    { category_id: foodId, category: 'Продукти', total_expense: 1200 },
    { category_id: transportId, category: 'Транспорт', total_expense: 300 }
  ]);

  const trendResponse = await request(app)
    .get('/api/analytics/trend?months=3&month=9&year=2026')
    .set('Authorization', `Bearer ${token}`);

  expect(trendResponse.status).toBe(200);
  expect(trendResponse.body.months).toEqual([
    { month: '2026-07', income: 0, expense: 0, balance: 0 },
    { month: '2026-08', income: 0, expense: 1000, balance: -1000 },
    { month: '2026-09', income: 5000, expense: 1500, balance: 3500 }
  ]);
});

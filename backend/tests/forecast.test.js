const request = require('supertest');
const app = require('../src/server');
const sequelize = require('../src/config/database');
const User = require('../src/models/User');
const RefreshToken = require('../src/models/RefreshToken');
const Category = require('../src/models/Category');
const Transaction = require('../src/models/Transaction');
const { forecastCategory } = require('../src/utils/forecast');

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

test('forecastCategory calculates a weighted moving average', () => {
  expect(forecastCategory([2800, 3100, 3400])).toBe(3200);
});

test('forecastCategory handles empty and one-month history', () => {
  expect(forecastCategory([])).toBe(0);
  expect(forecastCategory([1250])).toBe(1250);
});

test('calculates expense forecasts for each category', async () => {
  const email = `forecast-${Date.now()}@example.com`;

  await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'SecurePass123', full_name: 'Forecast User' });

  const loginResponse = await request(app)
    .post('/api/auth/login')
    .send({ email, password: 'SecurePass123' });
  const token = loginResponse.body.access_token;

  const categoryResponse = await request(app)
    .post('/api/categories')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Продукти', type: 'expense' });
  const categoryId = categoryResponse.body.id;

  const secondCategoryResponse = await request(app)
    .post('/api/categories')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Транспорт', type: 'expense' });
  const secondCategoryId = secondCategoryResponse.body.id;

  await request(app)
    .post('/api/transactions')
    .set('Authorization', `Bearer ${token}`)
    .send({ category_id: categoryId, amount: 2800, type: 'expense', transaction_date: '2026-07-10' });

  await request(app)
    .post('/api/transactions')
    .set('Authorization', `Bearer ${token}`)
    .send({ category_id: categoryId, amount: 3100, type: 'expense', transaction_date: '2026-08-10' });

  await request(app)
    .post('/api/transactions')
    .set('Authorization', `Bearer ${token}`)
    .send({ category_id: categoryId, amount: 3400, type: 'expense', transaction_date: '2026-09-10' });

  for (const transactionDate of ['2026-07-10', '2026-08-10', '2026-09-10']) {
    await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        category_id: secondCategoryId,
        amount: 1000,
        type: 'expense',
        transaction_date: transactionDate
      });
  }

  const forecastResponse = await request(app)
    .get('/api/forecast?month=10&year=2026')
    .set('Authorization', `Bearer ${token}`);

  expect(forecastResponse.status).toBe(200);
  expect(forecastResponse.body.month).toBe(10);
  expect(forecastResponse.body.year).toBe(2026);
  expect(forecastResponse.body.categories).toEqual([
    { category_id: categoryId, category: 'Продукти', forecast: 3200 },
    { category_id: secondCategoryId, category: 'Транспорт', forecast: 1000 }
  ]);
  expect(forecastResponse.body.total_forecast).toBe(4200);
});
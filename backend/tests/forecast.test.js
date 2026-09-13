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

test('calculates a forecast from the selected number of previous months', async () => {
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
    .send({ name: 'Зарплата', type: 'income' });
  const categoryId = categoryResponse.body.id;

  await request(app)
    .post('/api/transactions')
    .set('Authorization', `Bearer ${token}`)
    .send({ category_id: categoryId, amount: 3000, type: 'income', transaction_date: '2026-07-10' });

  await request(app)
    .post('/api/transactions')
    .set('Authorization', `Bearer ${token}`)
    .send({ category_id: categoryId, amount: 1000, type: 'income', transaction_date: '2026-08-10' });

  const forecastResponse = await request(app)
    .get('/api/forecast?month=9&year=2026&months=2')
    .set('Authorization', `Bearer ${token}`);

  expect(forecastResponse.status).toBe(200);
  expect(forecastResponse.body.target_month).toBe('2026-09');
  expect(forecastResponse.body.monthsAnalyzed).toBe(2);
  expect(forecastResponse.body.averageIncome).toBe(2000);
  expect(forecastResponse.body.averageExpense).toBe(0);
  expect(forecastResponse.body.projectedBalance).toBe(2000);
  expect(forecastResponse.body.history_months).toHaveLength(2);
});
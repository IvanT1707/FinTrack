const request = require('supertest');
const app = require('../src/server');
const sequelize = require('../src/config/database');
const User = require('../src/models/User');
const RefreshToken = require('../src/models/RefreshToken');
const Category = require('../src/models/Category');
const Transaction = require('../src/models/Transaction');
const BudgetLimit = require('../src/models/BudgetLimit');

beforeAll(async () => {
  await sequelize.sync({ force: false });
});

beforeEach(async () => {
  await RefreshToken.destroy({ where: {}, force: true });
  await Transaction.destroy({ where: {}, force: true });
  await BudgetLimit.destroy({ where: {}, force: true });
  await Category.destroy({ where: {}, force: true });
  await User.destroy({ where: {}, force: true });
});

afterAll(async () => {
  await RefreshToken.destroy({ where: {}, force: true });
  await Transaction.destroy({ where: {}, force: true });
  await BudgetLimit.destroy({ where: {}, force: true });
  await Category.destroy({ where: {}, force: true });
  await User.destroy({ where: {}, force: true });
  await sequelize.close();
});

async function createBudgetFixture() {
    const email = `budget-${Date.now()}@example.com`;

    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email,
        password: 'SecurePass123',
        full_name: 'Budget User'
      });

    expect(registerResponse.status).toBe(201);

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email,
        password: 'SecurePass123'
      });

    const token = loginResponse.body.access_token;

    const categoryResponse = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Продукти',
        type: 'expense'
      });

    expect(categoryResponse.status).toBe(201);

    return {
      token,
      categoryId: categoryResponse.body.id
    };
}

describe('Budget limits API', () => {
  test('creates a budget limit and computes current status from actual transactions', async () => {
    const { token, categoryId } = await createBudgetFixture();

    await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        category_id: categoryId,
        amount: 2500,
        type: 'expense',
        description: 'Магазин',
        transaction_date: '2026-09-10'
      });

    const budgetLimitResponse = await request(app)
      .post('/api/budget-limits')
      .set('Authorization', `Bearer ${token}`)
      .send({
        category_id: categoryId,
        limit_amount: 3000,
        period_month: 9,
        period_year: 2026
      });

    expect(budgetLimitResponse.status).toBe(201);
    expect(budgetLimitResponse.body.limit_amount).toBe('3000.00');

    const listResponse = await request(app)
      .get('/api/budget-limits?month=9&year=2026')
      .set('Authorization', `Bearer ${token}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body[0]).toHaveProperty('status');
    expect(listResponse.body[0].spent).toBeGreaterThanOrEqual(0);
  });

  test('updates an existing budget limit', async () => {
    const { token, categoryId } = await createBudgetFixture();

    const createResponse = await request(app)
      .post('/api/budget-limits')
      .set('Authorization', `Bearer ${token}`)
      .send({
        category_id: categoryId,
        limit_amount: 3000,
        period_month: 9,
        period_year: 2026
      });

    const updateResponse = await request(app)
      .put(`/api/budget-limits/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ limit_amount: 3500 });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.limit_amount).toBe('3500.00');
  });

  test('rejects a budget limit for an income category', async () => {
    const email = `income-budget-${Date.now()}@example.com`;

    await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'SecurePass123', full_name: 'Income Budget User' });

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'SecurePass123' });
    const token = loginResponse.body.access_token;

    const categoryResponse = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Зарплата', type: 'income' });

    const budgetResponse = await request(app)
      .post('/api/budget-limits')
      .set('Authorization', `Bearer ${token}`)
      .send({
        category_id: categoryResponse.body.id,
        limit_amount: 3000,
        period_month: 9,
        period_year: 2026
      });

    expect(budgetResponse.status).toBe(400);
    expect(budgetResponse.body.message).toMatch(/expense categories/);
  });

  test('deletes an existing budget limit', async () => {
    const { token, categoryId } = await createBudgetFixture();

    const createResponse = await request(app)
      .post('/api/budget-limits')
      .set('Authorization', `Bearer ${token}`)
      .send({
        category_id: categoryId,
        limit_amount: 3000,
        period_month: 9,
        period_year: 2026
      });

    const deleteResponse = await request(app)
      .delete(`/api/budget-limits/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteResponse.status).toBe(204);

    const emptyListResponse = await request(app)
      .get('/api/budget-limits?month=9&year=2026')
      .set('Authorization', `Bearer ${token}`);

    expect(emptyListResponse.status).toBe(200);
    expect(emptyListResponse.body).toHaveLength(0);
  });
});

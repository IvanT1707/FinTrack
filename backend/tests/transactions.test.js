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

describe('Transactions API', () => {
  test('creates a transaction for an authenticated user', async () => {
    const email = `transactions-${Date.now()}@example.com`;

    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email,
        password: 'SecurePass123',
        full_name: 'Transaction User'
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

    const transactionResponse = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        category_id: categoryResponse.body.id,
        amount: 450.5,
        type: 'expense',
        description: 'Продукти в АТБ',
        transaction_date: '2026-09-12'
      });

    expect(transactionResponse.status).toBe(201);
    expect(transactionResponse.body.amount).toBe('450.50');
    expect(transactionResponse.body.type).toBe('expense');

    const updateResponse = await request(app)
      .put(`/api/transactions/${transactionResponse.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 500, description: 'Оновлені продукти' });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.amount).toBe('500.00');
    expect(updateResponse.body.description).toBe('Оновлені продукти');

    const secondTransactionResponse = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        category_id: categoryResponse.body.id,
        amount: 100,
        type: 'expense',
        transaction_date: '2026-09-01'
      });

    expect(secondTransactionResponse.status).toBe(201);

    const listResponse = await request(app)
      .get('/api/transactions?from=2026-09-01&to=2026-09-30&category_id=' + categoryResponse.body.id + '&type=expense&page=1&limit=1')
      .set('Authorization', `Bearer ${token}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.items).toHaveLength(1);
    expect(listResponse.body.pagination).toEqual({
      page: 1,
      limit: 1,
      total: 2,
      total_pages: 2
    });

    const deleteResponse = await request(app)
      .delete(`/api/transactions/${transactionResponse.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteResponse.status).toBe(204);
  });
});

const request = require('supertest');
const app = require('../src/server');
const sequelize = require('../src/config/database');
const User = require('../src/models/User');
const RefreshToken = require('../src/models/RefreshToken');
const Category = require('../src/models/Category');

beforeAll(async () => {
  await sequelize.sync({ force: false });
});

beforeEach(async () => {
  await RefreshToken.destroy({ where: {}, force: true });
  await Category.destroy({ where: {}, force: true });
  await User.destroy({ where: {}, force: true });
});

afterAll(async () => {
  await RefreshToken.destroy({ where: {}, force: true });
  await Category.destroy({ where: {}, force: true });
  await User.destroy({ where: {}, force: true });
  await sequelize.close();
});

async function createCategoryFixture() {
  const email = `categories-${Date.now()}@example.com`;

  await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'SecurePass123', full_name: 'User Categories' });

  const loginResponse = await request(app)
    .post('/api/auth/login')
    .send({ email, password: 'SecurePass123' });
  const token = loginResponse.body.access_token;

  const createResponse = await request(app)
    .post('/api/categories')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Продукти', type: 'expense' });

  expect(createResponse.status).toBe(201);

  return { token, categoryId: createResponse.body.id };
}

describe('Categories API', () => {
  test('creates and lists categories for an authenticated user', async () => {
    const { token } = await createCategoryFixture();

    const listResponse = await request(app)
      .get('/api/categories')
      .set('Authorization', `Bearer ${token}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.some((category) => category.name === 'Продукти')).toBe(true);
  });

  test('updates an owned category', async () => {
    const { token, categoryId } = await createCategoryFixture();

    const updateResponse = await request(app)
      .put(`/api/categories/${categoryId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Харчування', type: 'expense' });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.name).toBe('Харчування');
  });

  test('deletes an unused owned category', async () => {
    const { token, categoryId } = await createCategoryFixture();

    const deleteResponse = await request(app)
      .delete(`/api/categories/${categoryId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteResponse.status).toBe(204);
  });

  test('allows CORS requests from the frontend origin', async () => {
    const { token } = await createCategoryFixture();

    const response = await request(app)
      .get('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:5173');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});

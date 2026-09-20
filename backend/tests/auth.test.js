const request = require('supertest');
const app = require('../src/server');
const sequelize = require('../src/config/database');
const User = require('../src/models/User');
const RefreshToken = require('../src/models/RefreshToken');

beforeEach(async () => {
  await RefreshToken.destroy({ where: {}, force: true });
  await User.destroy({ where: {}, force: true });
});

afterAll(async () => {
  await RefreshToken.destroy({ where: {}, force: true });
  await User.destroy({ where: {}, force: true });
  await sequelize.close();
});

describe('Auth API', () => {
  test('registers a user and returns created data', async () => {
    const email = `register-${Date.now()}@example.com`;

    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email,
        password: 'SecurePass123',
        full_name: 'Test User'
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.email).toBe(email);
    expect(response.body.full_name).toBe('Test User');
  });

  test('logs in a user and returns tokens', async () => {
    const email = `login-${Date.now()}@example.com`;

    await request(app)
      .post('/api/auth/register')
      .send({
        email,
        password: 'SecurePass123',
        full_name: 'Test User'
      });

    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email,
        password: 'SecurePass123'
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('access_token');
    expect(response.body).toHaveProperty('refresh_token');
    expect(response.body.user.email).toBe(email);
  });

  test('rejects a refresh token when used as an access token', async () => {
    const email = `refresh-access-${Date.now()}@example.com`;

    await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'SecurePass123', full_name: 'Test User' });

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'SecurePass123' });

    const response = await request(app)
      .get('/api/categories')
      .set('Authorization', `Bearer ${loginResponse.body.refresh_token}`);

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Access token required');
  });
});

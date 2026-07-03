process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret';

const request = require('supertest');
const bcrypt = require('bcryptjs');

// In-memory fake "table" so the mock behaves like a real model across calls.
let mockUsersTable = [];
let mockNextId = 1;

jest.mock('../models/User', () => ({
  create: jest.fn(async ({ full_name, email, password_hash, role }) => {
    const id = mockNextId++;
    mockUsersTable.push({ id, full_name, email, password_hash, role, created_at: new Date() });
    return id;
  }),
  findByEmail: jest.fn(async (email) => mockUsersTable.find((u) => u.email === email) || null),
  findById: jest.fn(async (id) => {
    const user = mockUsersTable.find((u) => u.id === id);
    if (!user) return null;
    const { password_hash, ...rest } = user;
    return { ...rest };
  }),
  updateProfile: jest.fn(async (id, { full_name, email }) => {
    const user = mockUsersTable.find((u) => u.id === id);
    if (user) {
      user.full_name = full_name;
      user.email = email;
    }
  })
}));

const app = require('../app');

beforeEach(() => {
  mockUsersTable = [];
  mockNextId = 1;
});

describe('POST /api/auth/register', () => {
  test('registers a new user and returns a token', async () => {
    const res = await request(app).post('/api/auth/register').send({
      full_name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'password123'
    });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe('jane@example.com');
    expect(res.body.user).not.toHaveProperty('password_hash');
  });

  test('rejects missing fields', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'a@b.com' });
    expect(res.statusCode).toBe(400);
  });

  test('rejects short passwords', async () => {
    const res = await request(app).post('/api/auth/register').send({
      full_name: 'Jane Doe',
      email: 'jane2@example.com',
      password: '123'
    });
    expect(res.statusCode).toBe(400);
  });

  test('rejects duplicate email', async () => {
    await request(app).post('/api/auth/register').send({
      full_name: 'Jane Doe',
      email: 'dupe@example.com',
      password: 'password123'
    });
    const res = await request(app).post('/api/auth/register').send({
      full_name: 'Someone Else',
      email: 'dupe@example.com',
      password: 'password456'
    });
    expect(res.statusCode).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    const password_hash = await bcrypt.hash('correctpassword', 10);
    mockUsersTable.push({
      id: mockNextId++,
      full_name: 'Existing User',
      email: 'existing@example.com',
      password_hash,
      role: 'user',
      created_at: new Date()
    });
  });

  test('logs in with correct credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'existing@example.com',
      password: 'correctpassword'
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  test('rejects incorrect password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'existing@example.com',
      password: 'wrongpassword'
    });
    expect(res.statusCode).toBe(401);
  });

  test('rejects unknown email', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@example.com',
      password: 'whatever'
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/auth/profile', () => {
  test('rejects requests without a token', async () => {
    const res = await request(app).get('/api/auth/profile');
    expect(res.statusCode).toBe(401);
  });

  test('returns profile for an authenticated user', async () => {
    const registerRes = await request(app).post('/api/auth/register').send({
      full_name: 'Token User',
      email: 'token@example.com',
      password: 'password123'
    });
    const token = registerRes.body.token;

    const res = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.user.email).toBe('token@example.com');
  });
});

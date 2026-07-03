process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret';

const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../config/db', () => ({
  query: jest.fn(async () => [[]])
}));

jest.mock('../models/User', () => ({
  findAll: jest.fn(async ({ search }) => {
    const all = [
      { id: 1, full_name: 'Alice Admin', email: 'alice@example.com', role: 'admin', created_at: new Date() },
      { id: 2, full_name: 'Bob User', email: 'bob@example.com', role: 'user', created_at: new Date() },
      { id: 3, full_name: 'Carol User', email: 'carol@example.com', role: 'user', created_at: new Date() }
    ];
    if (!search) return all;
    return all.filter(
      (u) =>
        u.full_name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
    );
  }),
  count: jest.fn(async () => 3)
}));

jest.mock('../models/Resume', () => ({
  findAll: jest.fn(async () => [
    {
      id: 1,
      user_id: 2,
      file_name: 'bob_resume.pdf',
      file_path: 'resume-123.pdf',
      upload_date: new Date(),
      full_name: 'Bob User',
      email: 'bob@example.com'
    }
  ]),
  count: jest.fn(async () => 1)
}));

jest.mock('../models/AnalysisResult', () => ({
  averageScore: jest.fn(async () => 67.5),
  allMissingSections: jest.fn(async () => [
    { missing_sections: JSON.stringify(['projects']) },
    { missing_sections: JSON.stringify(['projects', 'experience']) }
  ])
}));

const app = require('../app');

function tokenFor(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

const adminUser = { id: 1, email: 'alice@example.com', role: 'admin' };
const regularUser = { id: 2, email: 'bob@example.com', role: 'user' };

describe('Admin route access control', () => {
  test('rejects requests without a token', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.statusCode).toBe(401);
  });

  test('rejects non-admin users', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${tokenFor(regularUser)}`);
    expect(res.statusCode).toBe(403);
  });

  test('allows admin users', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${tokenFor(adminUser)}`);
    expect(res.statusCode).toBe(200);
  });
});

describe('GET /api/admin/users', () => {
  test('returns all users', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${tokenFor(adminUser)}`);
    expect(res.body.users.length).toBe(3);
  });

  test('filters users by search term', async () => {
    const res = await request(app)
      .get('/api/admin/users?search=bob')
      .set('Authorization', `Bearer ${tokenFor(adminUser)}`);
    expect(res.body.users.length).toBe(1);
    expect(res.body.users[0].email).toBe('bob@example.com');
  });
});

describe('GET /api/admin/resumes', () => {
  test('returns all resumes across users', async () => {
    const res = await request(app)
      .get('/api/admin/resumes')
      .set('Authorization', `Bearer ${tokenFor(adminUser)}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.resumes.length).toBe(1);
    expect(res.body.resumes[0].email).toBe('bob@example.com');
  });
});

describe('GET /api/admin/reports', () => {
  test('returns aggregate statistics', async () => {
    const res = await request(app)
      .get('/api/admin/reports')
      .set('Authorization', `Bearer ${tokenFor(adminUser)}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.totalUsers).toBe(3);
    expect(res.body.totalResumes).toBe(1);
    expect(res.body.averageScore).toBe(67.5);
    expect(res.body.mostMissingSections[0]).toEqual({ section: 'projects', count: 2 });
  });
});

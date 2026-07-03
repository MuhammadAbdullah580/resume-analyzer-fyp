process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret';

const path = require('path');
const request = require('supertest');
const jwt = require('jsonwebtoken');

let mockResumesTable = [];
let mockResultsTable = [];
let mockNextResumeId = 1;
let mockNextResultId = 1;

jest.mock('../models/Resume', () => ({
  create: jest.fn(async ({ user_id, file_name, file_path, file_type }) => {
    const id = mockNextResumeId++;
    mockResumesTable.push({ id, user_id, file_name, file_path, file_type, upload_date: new Date() });
    return id;
  }),
  findById: jest.fn(async (id) => mockResumesTable.find((r) => r.id === Number(id)) || null),
  findByUser: jest.fn(async (user_id) => mockResumesTable.filter((r) => r.user_id === user_id)),
  findAll: jest.fn(async () => mockResumesTable),
  count: jest.fn(async () => mockResumesTable.length)
}));

jest.mock('../models/AnalysisResult', () => ({
  create: jest.fn(async (data) => {
    const id = mockNextResultId++;
    mockResultsTable.push({
      id,
      resume_id: data.resume_id,
      overall_score: data.overall_score,
      skills_score: data.skills_score,
      education_score: data.education_score,
      experience_score: data.experience_score,
      projects_score: data.projects_score,
      has_email: data.has_email,
      has_phone: data.has_phone,
      missing_sections: JSON.stringify(data.missing_sections || []),
      recommendations: JSON.stringify(data.recommendations || []),
      created_at: new Date()
    });
    return id;
  }),
  findByResumeId: jest.fn(
    async (resume_id) => mockResultsTable.find((r) => r.resume_id === Number(resume_id)) || null
  ),
  averageScore: jest.fn(async () => 75),
  allMissingSections: jest.fn(async () => [])
}));

// Mock the analysis engine itself so tests don't depend on real PDF/DOCX parsing.
jest.mock('../services/resumeAnalyzer', () => ({
  analyzeResume: jest.fn(async () => ({
    overall_score: 82,
    skills_score: 28,
    education_score: 18,
    experience_score: 24,
    projects_score: 12,
    has_email: true,
    has_phone: true,
    missing_sections: [],
    recommendations: ['Strong skills section.'],
    details: { matchedSkills: ['javascript'], experienceYears: 2, projectCount: 2 }
  }))
}));

const app = require('../app');
const { analyzeResume } = require('../services/resumeAnalyzer');

function tokenFor(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role || 'user' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

beforeEach(() => {
  mockResumesTable = [];
  mockResultsTable = [];
  mockNextResumeId = 1;
  mockNextResultId = 1;
  analyzeResume.mockClear();
});

const testUser = { id: 1, email: 'user@example.com', role: 'user' };
const otherUser = { id: 2, email: 'other@example.com', role: 'user' };

describe('POST /api/resumes/upload', () => {
  test('rejects requests without auth', async () => {
    const res = await request(app)
      .post('/api/resumes/upload')
      .attach('resume', path.join(__dirname, 'fixtures/sample.pdf'));
    expect(res.statusCode).toBe(401);
  });

  test('rejects unsupported file types', async () => {
    const res = await request(app)
      .post('/api/resumes/upload')
      .set('Authorization', `Bearer ${tokenFor(testUser)}`)
      .attach('resume', path.join(__dirname, 'fixtures/sample.txt'));
    expect(res.statusCode).toBe(400);
  });

  test('rejects requests with no file attached', async () => {
    const res = await request(app)
      .post('/api/resumes/upload')
      .set('Authorization', `Bearer ${tokenFor(testUser)}`);
    expect(res.statusCode).toBe(400);
  });

  test('accepts a valid PDF, analyzes it, and stores the result', async () => {
    const res = await request(app)
      .post('/api/resumes/upload')
      .set('Authorization', `Bearer ${tokenFor(testUser)}`)
      .attach('resume', path.join(__dirname, 'fixtures/sample.pdf'));

    expect(res.statusCode).toBe(201);
    expect(res.body.analysis.overall_score).toBe(82);
    expect(analyzeResume).toHaveBeenCalledTimes(1);
    expect(mockResumesTable.length).toBe(1);
    expect(mockResultsTable.length).toBe(1);
  });

  test('returns 422 when the analyzer fails to parse the file', async () => {
    analyzeResume.mockRejectedValueOnce(new Error('parse failure'));
    const res = await request(app)
      .post('/api/resumes/upload')
      .set('Authorization', `Bearer ${tokenFor(testUser)}`)
      .attach('resume', path.join(__dirname, 'fixtures/sample.pdf'));
    expect(res.statusCode).toBe(422);
  });
});

describe('GET /api/resumes/history', () => {
  test('returns only the authenticated user\'s resumes', async () => {
    await request(app)
      .post('/api/resumes/upload')
      .set('Authorization', `Bearer ${tokenFor(testUser)}`)
      .attach('resume', path.join(__dirname, 'fixtures/sample.pdf'));

    await request(app)
      .post('/api/resumes/upload')
      .set('Authorization', `Bearer ${tokenFor(otherUser)}`)
      .attach('resume', path.join(__dirname, 'fixtures/sample.pdf'));

    const res = await request(app)
      .get('/api/resumes/history')
      .set('Authorization', `Bearer ${tokenFor(testUser)}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.resumes.length).toBe(1);
    expect(res.body.resumes[0].user_id).toBe(testUser.id);
  });
});

describe('GET /api/resumes/:id/result', () => {
  test('owner can view their own result', async () => {
    const uploadRes = await request(app)
      .post('/api/resumes/upload')
      .set('Authorization', `Bearer ${tokenFor(testUser)}`)
      .attach('resume', path.join(__dirname, 'fixtures/sample.pdf'));

    const resumeId = uploadRes.body.resumeId;
    const res = await request(app)
      .get(`/api/resumes/${resumeId}/result`)
      .set('Authorization', `Bearer ${tokenFor(testUser)}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.result.overall_score).toBe(82);
  });

  test('a different user cannot view someone else\'s result', async () => {
    const uploadRes = await request(app)
      .post('/api/resumes/upload')
      .set('Authorization', `Bearer ${tokenFor(testUser)}`)
      .attach('resume', path.join(__dirname, 'fixtures/sample.pdf'));

    const resumeId = uploadRes.body.resumeId;
    const res = await request(app)
      .get(`/api/resumes/${resumeId}/result`)
      .set('Authorization', `Bearer ${tokenFor(otherUser)}`);

    expect(res.statusCode).toBe(403);
  });

  test('returns 404 for a nonexistent resume', async () => {
    const res = await request(app)
      .get('/api/resumes/9999/result')
      .set('Authorization', `Bearer ${tokenFor(testUser)}`);
    expect(res.statusCode).toBe(404);
  });
});

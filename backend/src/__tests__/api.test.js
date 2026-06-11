/**
 * @file api.test.js
 * @description Automated tests for the backend API endpoints.
 */
const request = require('supertest');
const app = require('../app');

describe('API Health', () => {
  it('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe('Spots API', () => {
  it('GET /api/spots returns spots and divisions', async () => {
    const res = await request(app).get('/api/spots');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('spots');
    expect(res.body).toHaveProperty('divisions');
    expect(Array.isArray(res.body.spots)).toBe(true);
    expect(res.body.spots.length).toBeGreaterThan(0);
  });

  it('GET /api/spots/lookup finds a spot by name', async () => {
    const res = await request(app).get('/api/spots/lookup?name=Cox');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('name');
    expect(res.body.name.toLowerCase()).toContain('cox');
  });

  it('GET /api/spots/lookup returns 404 for unknown spot', async () => {
    const res = await request(app).get('/api/spots/lookup?name=NonExistentSpot12345');
    expect(res.statusCode).toBe(404);
  });
});

describe('Auth API', () => {
  it('GET /api/auth/me without token returns 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/auth/login with invalid credentials returns 401', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nonexistent@test.com', password: 'wrong' });
    expect(res.statusCode).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('POST /api/auth/signup/start with missing fields returns 400', async () => {
    const res = await request(app).post('/api/auth/signup/start').send({});
    expect(res.statusCode).toBe(400);
  });
});

describe('Reviews API', () => {
  it('GET /api/reviews returns array', async () => {
    const res = await request(app).get('/api/reviews');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/reviews without auth returns 401', async () => {
    const res = await request(app).post('/api/reviews').send({ destinationName: 'test', rating: 5, text: 'Great!' });
    expect(res.statusCode).toBe(401);
  });
});

describe('Admin API', () => {
  it('GET /api/admin/stats without auth returns 401', async () => {
    const res = await request(app).get('/api/admin/stats');
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/admin/spots without auth returns 401', async () => {
    const res = await request(app).get('/api/admin/spots');
    expect(res.statusCode).toBe(401);
  });
});

describe('Site Content', () => {
  it('GET /api/site-content returns content', async () => {
    const res = await request(app).get('/api/site-content');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('title');
    expect(res.body).toHaveProperty('stats');
  });
});

describe('Frontend Pages', () => {
  it('GET / serves index.html', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain('Bangladesh Tourism');
  });

  it('GET /login serves index.html', async () => {
    const res = await request(app).get('/login');
    expect(res.statusCode).toBe(200);
  });
});

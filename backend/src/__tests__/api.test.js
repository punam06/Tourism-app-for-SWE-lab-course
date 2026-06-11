/**
 * @file api.test.js
 * @description Automated tests for the backend API endpoints.
 */
// Import supertest to make HTTP requests to the Express app
const request = require('supertest');
// Import the Express app for testing without starting a server
const app = require('../app');

// Test suite for Health Check API
describe('API Health', () => {
  // Test case for GET /api/health
  it('GET /api/health returns ok', async () => {
    // Send a GET request to the health endpoint
    const res = await request(app).get('/api/health');
    // Verify the response status code is 200 OK
    expect(res.statusCode).toBe(200);
    // Verify the response body matches expected output
    expect(res.body).toEqual({ ok: true });
  });
});

// Test suite for Spots API endpoints
describe('Spots API', () => {
  // Test fetching all spots and divisions
  it('GET /api/spots returns spots and divisions', async () => {
    const res = await request(app).get('/api/spots');
    // Expecting successful response
    expect(res.statusCode).toBe(200);
    // Response should contain spots and divisions properties
    expect(res.body).toHaveProperty('spots');
    expect(res.body).toHaveProperty('divisions');
    // Ensure spots is an array
    expect(Array.isArray(res.body.spots)).toBe(true);
    // Ensure at least one spot is returned
    expect(res.body.spots.length).toBeGreaterThan(0);
  });

  // Test looking up a spot by its name
  it('GET /api/spots/lookup finds a spot by name', async () => {
    const res = await request(app).get('/api/spots/lookup?name=Cox');
    // Verify response status
    expect(res.statusCode).toBe(200);
    // Response should have a name property
    expect(res.body).toHaveProperty('name');
    // Name should match the lookup string
    expect(res.body.name.toLowerCase()).toContain('cox');
  });

  // Test looking up an unknown spot
  it('GET /api/spots/lookup returns 404 for unknown spot', async () => {
    const res = await request(app).get('/api/spots/lookup?name=NonExistentSpot12345');
    // Verify it correctly returns 404 Not Found
    expect(res.statusCode).toBe(404);
  });
});

// Test suite for Authentication API
describe('Auth API', () => {
  // Test fetching user profile without token
  it('GET /api/auth/me without token returns 401', async () => {
    const res = await request(app).get('/api/auth/me');
    // Unauthenticated access should be denied
    expect(res.statusCode).toBe(401);
  });

  // Test logging in with invalid credentials
  it('POST /api/auth/login with invalid credentials returns 401', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nonexistent@test.com', password: 'wrong' });
    // Invalid login should be unauthorized
    expect(res.statusCode).toBe(401);
    // The response should include an error message
    expect(res.body).toHaveProperty('error');
  });

  // Test signup with missing required fields
  it('POST /api/auth/signup/start with missing fields returns 400', async () => {
    const res = await request(app).post('/api/auth/signup/start').send({});
    // Missing fields should result in Bad Request
    expect(res.statusCode).toBe(400);
  });
});

// Test suite for Reviews API
describe('Reviews API', () => {
  // Test fetching the list of reviews
  it('GET /api/reviews returns array', async () => {
    const res = await request(app).get('/api/reviews');
    // Expect successful response
    expect(res.statusCode).toBe(200);
    // The reviews response should be an array format
    expect(Array.isArray(res.body)).toBe(true);
  });

  // Test posting a review without authentication
  it('POST /api/reviews without auth returns 401', async () => {
    const res = await request(app).post('/api/reviews').send({ destinationName: 'test', rating: 5, text: 'Great!' });
    // Unauthenticated POST should fail
    expect(res.statusCode).toBe(401);
  });
});

// Test suite for Admin API functionality
describe('Admin API', () => {
  // Test fetching stats without admin access
  it('GET /api/admin/stats without auth returns 401', async () => {
    const res = await request(app).get('/api/admin/stats');
    // Should block access to admin endpoint
    expect(res.statusCode).toBe(401);
  });

  // Test fetching spots in admin panel without auth
  it('GET /api/admin/spots without auth returns 401', async () => {
    const res = await request(app).get('/api/admin/spots');
    // Should block access to admin spots
    expect(res.statusCode).toBe(401);
  });
});

// Test suite for Site Content
describe('Site Content', () => {
  // Test fetching global site content data
  it('GET /api/site-content returns content', async () => {
    const res = await request(app).get('/api/site-content');
    // Expect successful response
    expect(res.statusCode).toBe(200);
    // Should include a title for the site
    expect(res.body).toHaveProperty('title');
    // Should include statistics object
    expect(res.body).toHaveProperty('stats');
  });
});

// Test suite for Frontend page rendering routes
describe('Frontend Pages', () => {
  // Test fetching the home page
  it('GET / serves index.html', async () => {
    const res = await request(app).get('/');
    // Should return successfully
    expect(res.statusCode).toBe(200);
    // HTML should contain the project title
    expect(res.text).toContain('Bangladesh Tourism');
  });

  // Test fetching the login page
  it('GET /login serves index.html', async () => {
    const res = await request(app).get('/login');
    // Should return successfully
    expect(res.statusCode).toBe(200);
  });
});

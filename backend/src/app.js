/**
 * @file app.js
 * @description Main application file for the FarReach Tourism App backend.
 * Configures Express, middleware, routing, authentication, and API endpoints.
 */
// Import core Node.js modules
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
// Import external dependencies
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const express = require('express');
const nodemailer = require('nodemailer');
const multer = require('multer');
// Import database pool
const db = require('./config/db');

// Set up project root directory
const projectRoot = path.join(__dirname, '../..');
// Define potential paths for the .env configuration file
const envPaths = [path.join(__dirname, '.env'), path.join(projectRoot, '.env')];
// Loop through and load variables from the first .env file found
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

// Initialize the Express application
const app = express();
// Define the server listening port
const PORT = process.env.PORT || 3000;
// Define the client-side root path
const clientRoot = path.join(__dirname, '../../frontend/src');

// Use JSON body parsing middleware with a 1MB limit
app.use(express.json({ limit: '1mb' }));
// Set up CORS and basic headers for all incoming requests
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-Token');
  // Handle preflight OPTIONS requests by returning 204 No Content
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next(); // Pass control to the next middleware
});

// Serve static files from the frontend directory
app.use(express.static(clientRoot));

// Serve a dynamic client configuration script containing API URL details
app.get('/client-config.js', (req, res) => {
  const clientConfig = {
    APP_API_BASE_URL: process.env.APP_API_BASE_URL || `http://127.0.0.1:${PORT}`,
  };
  // Return the base URL as an injected window variable
  res.type('application/javascript').send(`window.APP_API_BASE_URL = ${JSON.stringify(clientConfig.APP_API_BASE_URL)};`);
});

/**
 * Extracts the user object based on the Authorization header Bearer token
 * @param {object} req - Express request object
 * @returns {object|null} - User object or null if invalid
 */
async function currentUserFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null; // No token provided
  // Strip the 'Bearer ' prefix
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return null;
  try {
    // Decode the token payload from Base64
    const payload = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
    // Check if the token has expired
    if (payload.exp && Date.now() > payload.exp) return null;
    // Query the database for the corresponding user by payload.id
    const [users] = await db.query('SELECT id, name, email, role, phone, address, profile_pic FROM users WHERE id = ?', [payload.id]);
    // Return the user object if found, otherwise null
    return users.length > 0 ? users[0] : null;
  } catch { 
    return null; // Return null if any parsing or DB error occurs
  }
}

/**
 * Express middleware to enforce admin-level access
 */
async function requireAdmin(req, res, next) {
  const user = await currentUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Sign in required' });
  // Ensure the retrieved user has the 'admin' role
  if (user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  // Proceed if valid admin
  next();
}

/**
 * Express middleware to enforce standard authenticated access
 */
async function requireAuth(req, res, next) {
  const user = await currentUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Sign in required' });
  // Attach user to the request object for downstream handlers
  req.user = user;
  next();
}

// Configure multer storage engine to save files locally
const storage = multer.diskStorage({
  // Save uploaded spot pictures to a specific directory inside the client folder
  destination: path.join(clientRoot, 'assets', 'spot-pictures'),
  filename: (req, file, cb) => {
    // Generate a unique filename using timestamp and a random number
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // Append the original file extension
    cb(null, unique + path.extname(file.originalname));
  }
});
// Create a multer upload middleware with a strict 5MB file size limit
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Serve the main single page application at root
app.get('/', (req, res) => {
  res.sendFile(path.join(clientRoot, 'index.html'));
});

// Explicitly serve index.html for the /login route to support SPA navigation
app.get('/login', (req, res) => {
  res.sendFile(path.join(clientRoot, 'index.html'));
});

// Serve the admin dashboard HTML page
app.get('/admin-dashboard', (req, res) => {
  res.sendFile(path.join(clientRoot, 'admin-dashboard.html'));
});

// Serve the user dashboard HTML page
app.get('/user-dashboard', (req, res) => {
  res.sendFile(path.join(clientRoot, 'user-dashboard.html'));
});

// Simple health check API endpoint
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

/**
 * Helper to get and validate the OpenWeather API Key from env
 * @returns {string|null} - API key string or null if not set
 */
function getApiKey() {
  const key = (process.env.OPENWEATHER_API_KEY ?? '').trim();
  // Filter out placeholder values to ensure API call legitimacy
  if (!key || key === 'PUT_YOUR_KEY_HERE' || key === 'YOUR_API_KEY_HERE') return null;
  return key;
}

// ============= WEATHER =============

// API route to get current weather data for a specific district
app.get('/api/weather', async (req, res) => {
  try {
    const { district } = req.query;
    if (!district) return res.status(400).json({ error: 'District is required' });
    
    const apiKey = getApiKey();
    // Encode district name and strip parentheses for accurate geocoding lookup
    const encoded = encodeURIComponent(district.replace(/\s*\(.*?\)\s*/g, '').trim());
    
    // Convert location name to coordinates via OpenWeather Geocode API
    const geo = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encoded},BD&limit=1&appid=${apiKey}`);
    if (!geo.ok) throw new Error('Geocode failed');
    
    const geoData = await geo.json();
    if (!geoData.length) return res.status(404).json({ error: 'Location not found' });
    
    const { lat, lon } = geoData[0]; // Extract latitude and longitude
    
    // Fetch current weather conditions using coordinates
    const weather = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`);
    if (!weather.ok) throw new Error('Weather fetch failed');
    
    const data = await weather.json();
    // Return sanitized weather payload
    res.json({
      temp: Math.round(data.main.temp),
      feels_like: Math.round(data.main.feels_like),
      humidity: data.main.humidity,
      description: data.weather[0].description,
      icon: data.weather[0].icon,
      wind_speed: data.wind.speed,
    });
  } catch (err) {
    res.status(500).json({ error: 'Weather unavailable', detail: err.message });
  }
});

// API route to get a weather forecast for a specific district and date
app.get('/api/forecast', async (req, res) => {
  try {
    const { district, date } = req.query;
    if (!district) return res.status(400).json({ error: 'District is required' });
    
    const apiKey = getApiKey();
    
    // Fallback to open-meteo API if no OpenWeather API key is present
    if (!apiKey) {
      const fallback = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=23.7&longitude=90.4&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`);
      const fallbackData = await fallback.json();
      return res.json(parseFallbackForecast(fallbackData, date));
    }
    
    // Encode the district name
    const encoded = encodeURIComponent(district.replace(/\s*\(.*?\)\s*/g, '').trim());
    
    // Geocode to get coordinates
    const geo = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encoded},BD&limit=1&appid=${apiKey}`);
    if (!geo.ok) throw new Error('Geocode failed');
    
    const geoData = await geo.json();
    if (!geoData.length) return res.status(404).json({ error: 'Location not found' });
    
    const { lat, lon } = geoData[0];
    
    // Fetch 5-day / 3-hour forecast data
    const forecast = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`);
    if (!forecast.ok) throw new Error('Forecast fetch failed');
    
    const data = await forecast.json();
    const daily = {};
    
    // Group forecast records by date to find min and max temps per day
    for (const item of data.list) {
      const d = item.dt_txt.split(' ')[0]; // Extract just the date string
      if (!daily[d]) daily[d] = [];
      daily[d].push(item.main.temp);
    }
    
    // Process aggregated data into an array format
    const result = Object.entries(daily).map(([day, temps]) => ({
      date: day,
      temp_max: Math.round(Math.max(...temps)),
      temp_min: Math.round(Math.min(...temps)),
    }));
    
    // Filter by specific date if provided
    if (date) {
      const matched = result.find(r => r.date === date);
      return res.json(matched || result);
    }
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Forecast unavailable', detail: err.message });
  }
});

/**
 * Parses forecast payload from the fallback Open-Meteo API
 */
function parseFallbackForecast(data, date) {
  if (!data.daily) return [];
  // Map internal array to structured day objects
  const days = data.daily.time.map((t, i) => ({
    date: t,
    temp_max: Math.round(data.daily.temperature_2m_max[i]),
    temp_min: Math.round(data.daily.temperature_2m_min[i]),
  }));
  // Filter by date if requested
  if (date) {
    const matched = days.find(d => d.date === date);
    return matched || days;
  }
  return days;
}

// ============= GEOCODE =============

// Reverse geocoding API route using Nominatim OpenStreetMap API
app.get('/api/geocode', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });
    // Fetch data corresponding to lat/lon coordinates
    const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
    const data = await resp.json();
    // Return formatted address details
    res.json({ display_name: data.display_name || 'Unknown', address: data.address || {} });
  } catch (err) {
    res.status(500).json({ error: 'Geocode failed' });
  }
});

// Routing/Directions API endpoint using OSRM mapping service
app.get('/api/directions', async (req, res) => {
  try {
    const { origin, destination } = req.query;
    if (!origin || !destination) return res.status(400).json({ error: 'origin and destination required' });
    // Request driving directions between origin and destination coordinates
    const resp = await fetch(`https://router.project-osrm.org/route/v1/driving/${origin};${destination}?overview=full&geometries=geojson`);
    const data = await resp.json();
    if (!data.routes || !data.routes.length) return res.status(404).json({ error: 'No route found' });
    // Extract first route option
    const route = data.routes[0];
    // Return key travel metrics and route geometry for map plotting
    res.json({ distance_km: (route.distance / 1000).toFixed(1), duration_min: Math.round(route.duration / 60), geometry: route.geometry });
  } catch (err) {
    res.status(500).json({ error: 'Directions unavailable' });
  }
});

// ============= AUTH =============

// Route to get currently authenticated user info
app.get('/api/auth/me', async (req, res) => {
  const user = await currentUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ user });
});

// Configure Nodemailer transporter using SMTP details from env
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

// In-memory store to temporarily hold signup OTP data
const otpStore = new Map();

// Endpoint to initiate user registration and send an OTP
app.post('/api/auth/signup/start', async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Name and email required' });
    // Verify if email is already in the database
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) return res.status(409).json({ error: 'Email already registered' });
    
    // Generate a 6 digit code and determine expiry time (10 minutes)
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + 10 * 60 * 1000;
    
    // Save to memory store
    otpStore.set(email, { name, code, expiresAt });
    
    // Dispatch the email containing the OTP
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'Bangladesh Tourism <noreply@bdtourism.com>',
      to: email, subject: 'Your OTP Code',
      text: `Your verification code is: ${code}\nValid for 10 minutes.`,
    });
    console.log(`[OTP] ${email}: ${code}`); // Log to console for debugging purposes
    
    res.json({ ok: true, message: 'Code sent' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send code' });
  }
});

// Route to resend the signup OTP to the email
app.post('/api/auth/signup/resend', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    
    // Check if there is an active signup session
    const entry = otpStore.get(email);
    if (!entry) return res.status(400).json({ error: 'No pending verification' });
    
    // Generate a new code and extend expiry
    const code = String(Math.floor(100000 + Math.random() * 900000));
    entry.code = code;
    entry.expiresAt = Date.now() + 10 * 60 * 1000;
    
    // Resend the email
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'Bangladesh Tourism <noreply@bdtourism.com>',
      to: email, subject: 'Your OTP Code',
      text: `Your verification code is: ${code}\nValid for 10 minutes.`,
    });
    console.log(`[OTP] ${email}: ${code}`);
    res.json({ ok: true, message: 'Code resent' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resend' });
  }
});

// Endpoint to verify the 6-digit OTP code input by user
app.post('/api/auth/signup/verify-code', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'Email and code required' });
    
    // Retrieve the signup session data
    const entry = otpStore.get(email);
    if (!entry) return res.status(400).json({ error: 'No pending verification' });
    // Deny if the OTP session has timed out
    if (Date.now() > entry.expiresAt) return res.status(400).json({ error: 'Code expired' });
    // Check if the input code matches
    if (entry.code !== code) return res.status(400).json({ error: 'Invalid code' });
    
    // Mark session as verified
    entry.verified = true;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Endpoint to finalize signup by setting a password for the verified session
app.post('/api/auth/signup/set-password', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    
    const entry = otpStore.get(email);
    // Ensure the OTP was previously validated
    if (!entry || !entry.verified) return res.status(400).json({ error: 'Verify code first' });
    
    // Securely hash the password string
    const hashed = await bcrypt.hash(password, 10);
    // Save the new user record into the DB
    const [result] = await db.query('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', [entry.name, email, hashed]);
    
    // Cleanup OTP session
    otpStore.delete(email);
    
    // Create base64 access token containing the user id and expiry date
    const token = Buffer.from(JSON.stringify({ id: result.insertId, exp: Date.now() + 3600000 })).toString('base64');
    // Return token and user schema
    res.json({ ok: true, token, user: { id: result.insertId, name: entry.name, email, role: 'user' } });
  } catch (err) {
    res.status(500).json({ error: 'Account creation failed' });
  }
});

// User login endpoint handling credential validation
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    
    // Locate the user in the database
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (!users.length) return res.status(401).json({ error: 'Invalid email or password' });
    const user = users[0];
    
    // Compare provided password with securely hashed variant
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid email or password' });
    
    // Create token payload including id and 1 hour expiration
    const token = Buffer.from(JSON.stringify({ id: user.id, exp: Date.now() + 3600000 })).toString('base64');
    res.json({ ok: true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Simple logout endpoint (mostly handled client side by dropping tokens)
app.post('/api/auth/logout', (req, res) => {
  res.json({ ok: true });
});

// ============= HOTELS =============

// Fake/Mock hotel search endpoint for a specific city location
app.post('/api/hotels/search', async (req, res) => {
  try {
    const { city } = req.body;
    if (!city) return res.status(400).json({ error: 'City required' });
    // Return mock static array containing hotel objects matching the city
    const mockHotels = [
      { name: 'Hotel Grand Paradise', rating: 4.5, price: 3500, image: '', location: city },
      { name: 'Sea View Resort', rating: 4.2, price: 2500, image: '', location: city },
      { name: 'Budget Inn', rating: 3.8, price: 1200, image: '', location: city },
    ];
    res.json(mockHotels);
  } catch (err) {
    res.status(500).json({ error: 'Hotel search failed' });
  }
});

// ============= REVIEWS =============

// Route to fetch reviews for the application, optionally filtered by destinationName
app.get('/api/reviews', async (req, res) => {
  try {
    const { destinationName } = req.query;
    // Base SQL query joining reviews to user data
    let query = `SELECT r.*, u.name as user_name, u.profile_pic FROM reviews r JOIN users u ON r.user_id = u.id`;
    const params = [];
    
    // Add destination specific filter logic if passed
    if (destinationName) {
      query += ` WHERE r.destination_name = ?`;
      params.push(destinationName);
    }
    
    // Finalize query ordering by newest and limiting records
    query += ` ORDER BY r.created_at DESC LIMIT 50`;
    const [reviews] = await db.query(query, params);
    
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Private endpoint for submitting a review, requires authentication
app.post('/api/reviews', requireAuth, async (req, res) => {
  try {
    const { destinationName, rating, text } = req.body;
    if (!destinationName || !rating || !text) return res.status(400).json({ error: 'All fields required' });
    
    // Insert new review tied to the authenticated user ID
    const [result] = await db.query('INSERT INTO reviews (user_id, destination_name, rating, text) VALUES (?, ?, ?, ?)', [req.user.id, destinationName, rating, text]);
    res.json({ ok: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// ============= SITE CONTENT =============

// Generic site config/stats endpoint for populating about us and UI texts
app.get('/api/site-content', (req, res) => {
  res.json({
    title: 'Bangladesh Tourism Explorer',
    description: 'Discover 100+ tourist destinations across Bangladesh',
    stats: { spots: 100, districts: 64, divisions: 8 },
  });
});

// ============= SPOTS =============

// Find a single specific tourist spot based on a fuzzy text match name
app.get('/api/spots/lookup', async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) return res.status(400).json({ error: 'Name required' });
    // Join logic to fetch district and division metadata alongside spot
    const [spots] = await db.query('SELECT s.*, d.name as district_name, dv.name as division_name FROM spots s JOIN districts d ON s.district_id = d.id JOIN divisions dv ON d.division_id = dv.id WHERE s.name LIKE ? LIMIT 1', [`%${name}%`]);
    if (!spots.length) return res.status(404).json({ error: 'Spot not found' });
    
    res.json(spots[0]);
  } catch (err) {
    res.status(500).json({ error: 'Lookup failed' });
  }
});

// Retrieve all spots grouped and divisions
app.get('/api/spots', async (req, res) => {
  try {
    // List all spots with names joined properly
    const [spots] = await db.query('SELECT s.*, d.name as district_name, dv.name as division_name FROM spots s JOIN districts d ON s.district_id = d.id JOIN divisions dv ON d.division_id = dv.id ORDER BY s.name');
    // List all divisions and calculate how many spots each division contains using subqueries
    const [divisions] = await db.query('SELECT dv.*, (SELECT COUNT(*) FROM spots s JOIN districts d ON s.district_id = d.id WHERE d.division_id = dv.id) as spot_count FROM divisions dv ORDER BY dv.name');
    
    res.json({ spots, divisions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch spots' });
  }
});

// ============= ADMIN =============

// Dashboard stats endpoint, restricted to 'admin' users
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    // Count aggregates using multi-queries for dashboard widget rendering
    const [[{ total_users }]] = await db.query('SELECT COUNT(*) as total_users FROM users');
    const [[{ total_spots }]] = await db.query('SELECT COUNT(*) as total_spots FROM spots');
    const [[{ total_reviews }]] = await db.query('SELECT COUNT(*) as total_reviews FROM reviews');
    const [[{ pending_bookings }]] = await db.query("SELECT COUNT(*) as pending_bookings FROM bookings WHERE status='pending'");
    res.json({ total_users, total_spots, total_reviews, pending_bookings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Retrieve comprehensive relational spot lists to populate admin management table
app.get('/api/admin/spots', requireAdmin, async (req, res) => {
  try {
    const [spots] = await db.query('SELECT s.*, d.name as district_name, dv.name as division_name, dv.id as division_id FROM spots s JOIN districts d ON s.district_id = d.id JOIN divisions dv ON d.division_id = dv.id ORDER BY s.id');
    const [divisions] = await db.query('SELECT * FROM divisions ORDER BY name');
    const [districts] = await db.query('SELECT d.*, dv.name as division_name FROM districts d JOIN divisions dv ON d.division_id = dv.id ORDER BY d.name');
    res.json({ spots, divisions, districts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch spots' });
  }
});

// Create new spot using multer to parse single 'image' file uploads
app.post('/api/admin/spots', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { name, category, description, history, district_id, best_time, tips, highlights, latitude, longitude, budget_category } = req.body;
    if (!name || !category || !district_id) return res.status(400).json({ error: 'Name, category, district required' });
    // Determine image path from the multer file metadata if available
    const image = req.file ? req.file.filename : '';
    // Commit new spot row
    const [result] = await db.query('INSERT INTO spots (name, category, description, history, district_id, best_time, tips, highlights, latitude, longitude, image, budget_category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, category, description || '', history || '', district_id, best_time || '', tips || '', highlights || '', latitude || null, longitude || null, image, budget_category || 'Mid']);
    res.json({ ok: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add spot' });
  }
});

// Edit existing spot attributes dynamically constructing SQL using multer to handle optional image updates
app.put('/api/admin/spots/:id', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { name, category, description, history, district_id, best_time, tips, highlights, latitude, longitude, budget_category } = req.body;
    let sql = 'UPDATE spots SET name=?, category=?, description=?, history=?, district_id=?, best_time=?, tips=?, highlights=?, latitude=?, longitude=?, budget_category=?';
    const params = [name, category, description, history, district_id, best_time, tips, highlights, latitude, longitude, budget_category];
    // If an image was included, add it to the update sequence
    if (req.file) { sql += ', image=?'; params.push(req.file.filename); }
    sql += ' WHERE id=?'; params.push(req.params.id);
    
    // Execute dynamic SQL
    await db.query(sql, params);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update spot' });
  }
});

// Deletes a spot entry from database
app.delete('/api/admin/spots/:id', requireAdmin, async (req, res) => {
  try { 
    await db.query('DELETE FROM spots WHERE id=?', [req.params.id]); 
    res.json({ ok: true }); 
  } catch (err) { 
    res.status(500).json({ error: 'Delete failed' }); 
  }
});

// Lists all users to the admin
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try { 
    const [users] = await db.query('SELECT id, name, email, role, created_at FROM users ORDER BY id'); 
    res.json(users); 
  } catch (err) { 
    res.status(500).json({ error: 'Failed to fetch users' }); 
  }
});

// Allows assigning admin rights and managing roles
app.put('/api/admin/users/:id/role', requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    const [[user]] = await db.query('SELECT role FROM users WHERE id=?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Prevent removing the very last admin from the system to prevent total lockout
    if (user.role === 'admin' && role === 'user') {
      const [[adminCount]] = await db.query("SELECT COUNT(*) as cnt FROM users WHERE role='admin'");
      if (adminCount.cnt <= 1) return res.status(400).json({ error: 'Cannot demote the last admin' });
    }
    await db.query('UPDATE users SET role=? WHERE id=?', [role, req.params.id]);
    res.json({ ok: true });
  } catch (err) { 
    res.status(500).json({ error: 'Role update failed' }); 
  }
});

// Administratively removes a user and flushes their associated content constraints
app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    const [[user]] = await db.query('SELECT role FROM users WHERE id=?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Similar to role removal, prevent last admin from self deleting
    if (user.role === 'admin') {
      const [[adminCount]] = await db.query("SELECT COUNT(*) as cnt FROM users WHERE role='admin'");
      if (adminCount.cnt <= 1) return res.status(400).json({ error: 'Cannot delete the last admin' });
    }
    
    // Cascade-delete records attached to the user prior to deleting the user
    await db.query('DELETE FROM reviews WHERE user_id=?', [req.params.id]);
    await db.query('DELETE FROM saved_spots WHERE user_id=?', [req.params.id]);
    await db.query('DELETE FROM bookings WHERE user_id=?', [req.params.id]);
    await db.query('DELETE FROM users WHERE id=?', [req.params.id]);
    
    res.json({ ok: true });
  } catch (err) { 
    res.status(500).json({ error: 'Delete failed' }); 
  }
});

// Admin Division operations
app.post('/api/admin/divisions', requireAdmin, async (req, res) => {
  try { 
    const { name } = req.body; 
    if (!name) return res.status(400).json({ error: 'Name required' }); 
    const [r] = await db.query('INSERT INTO divisions (name) VALUES (?)', [name]); 
    res.json({ ok: true, id: r.insertId }); 
  } catch (err) { res.status(500).json({ error: 'Create failed' }); }
});

app.put('/api/admin/divisions/:id', requireAdmin, async (req, res) => {
  try { 
    await db.query('UPDATE divisions SET name=? WHERE id=?', [req.body.name, req.params.id]); 
    res.json({ ok: true }); 
  } catch (err) { res.status(500).json({ error: 'Update failed' }); }
});

app.delete('/api/admin/divisions/:id', requireAdmin, async (req, res) => {
  try { 
    await db.query('DELETE FROM divisions WHERE id=?', [req.params.id]); 
    res.json({ ok: true }); 
  } catch (err) { res.status(500).json({ error: 'Delete failed' }); }
});

// Admin District operations
app.post('/api/admin/districts', requireAdmin, async (req, res) => {
  try { 
    const { name, division_id } = req.body; 
    if (!name || !division_id) return res.status(400).json({ error: 'Name and division required' }); 
    const [r] = await db.query('INSERT INTO districts (name, division_id) VALUES (?, ?)', [name, division_id]); 
    res.json({ ok: true, id: r.insertId }); 
  } catch (err) { res.status(500).json({ error: 'Create failed' }); }
});

app.put('/api/admin/districts/:id', requireAdmin, async (req, res) => {
  try { 
    await db.query('UPDATE districts SET name=?, division_id=? WHERE id=?', [req.body.name, req.body.division_id, req.params.id]); 
    res.json({ ok: true }); 
  } catch (err) { res.status(500).json({ error: 'Update failed' }); }
});

app.delete('/api/admin/districts/:id', requireAdmin, async (req, res) => {
  try { 
    await db.query('DELETE FROM districts WHERE id=?', [req.params.id]); 
    res.json({ ok: true }); 
  } catch (err) { res.status(500).json({ error: 'Delete failed' }); }
});

// Admin Guide operations
app.post('/api/admin/guides', requireAdmin, async (req, res) => {
  try {
    const { name, phone, spot_id, specialties, rating } = req.body;
    if (!name || !phone || !spot_id) return res.status(400).json({ error: 'Name, phone, spot required' });
    const [r] = await db.query('INSERT INTO guides (name, phone, spot_id, specialties, rating) VALUES (?, ?, ?, ?, ?)', [name, phone, spot_id, specialties || '', rating || 5]);
    res.json({ ok: true, id: r.insertId });
  } catch (err) { res.status(500).json({ error: 'Create failed' }); }
});

app.put('/api/admin/guides/:id', requireAdmin, async (req, res) => {
  try {
    const { name, phone, spot_id, specialties, rating } = req.body;
    await db.query('UPDATE guides SET name=?, phone=?, spot_id=?, specialties=?, rating=? WHERE id=?', [name, phone, spot_id, specialties, rating, req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Update failed' }); }
});

app.delete('/api/admin/guides/:id', requireAdmin, async (req, res) => {
  try { 
    await db.query('DELETE FROM guides WHERE id=?', [req.params.id]); 
    res.json({ ok: true }); 
  } catch (err) { res.status(500).json({ error: 'Delete failed' }); }
});

// Fetches reviews with full details so administrators can moderate
app.get('/api/admin/reviews', requireAdmin, async (req, res) => {
  try {
    const [reviews] = await db.query('SELECT r.*, u.name as user_name, u.email as user_email FROM reviews r JOIN users u ON r.user_id = u.id ORDER BY r.created_at DESC');
    res.json(reviews);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch reviews' }); }
});

// Stores a response string directly against the review
app.put('/api/admin/reviews/:id/reply', requireAdmin, async (req, res) => {
  try { 
    await db.query('UPDATE reviews SET admin_reply=? WHERE id=?', [req.body.reply, req.params.id]); 
    res.json({ ok: true }); 
  } catch (err) { res.status(500).json({ error: 'Reply failed' }); }
});

// Erase reviews globally
app.delete('/api/admin/reviews/:id', requireAdmin, async (req, res) => {
  try { 
    await db.query('DELETE FROM reviews WHERE id=?', [req.params.id]); 
    res.json({ ok: true }); 
  } catch (err) { res.status(500).json({ error: 'Delete failed' }); }
});

// Admin endpoint to view list of all placed bookings across the platform
app.get('/api/admin/bookings', requireAdmin, async (req, res) => {
  try {
    const [bookings] = await db.query('SELECT b.*, u.name as user_name, u.email as user_email FROM bookings b JOIN users u ON b.user_id = u.id ORDER BY b.created_at DESC');
    res.json(bookings);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch bookings' }); }
});

// Accept or Deny a user booking
app.put('/api/admin/bookings/:id/status', requireAdmin, async (req, res) => {
  try { 
    await db.query('UPDATE bookings SET status=? WHERE id=?', [req.body.status, req.params.id]); 
    res.json({ ok: true }); 
  } catch (err) { res.status(500).json({ error: 'Update failed' }); }
});

// ============= USER DASHBOARD =============

// Aggregates booking, review, and saving metrics specific to an authenticated user's view
app.get('/api/user/dashboard', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    // Perform isolated queries
    const [[{ active_bookings }]] = await db.query("SELECT COUNT(*) as active_bookings FROM bookings WHERE user_id=? AND status IN ('pending','confirmed')", [userId]);
    const [[{ total_reviews }]] = await db.query('SELECT COUNT(*) as total_reviews FROM reviews WHERE user_id=?', [userId]);
    const [[{ saved_count }]] = await db.query('SELECT COUNT(*) as saved_count FROM saved_spots WHERE user_id=?', [userId]);
    // Send metric payload
    res.json({ active_bookings, total_reviews, saved_count });
  } catch (err) { 
    res.status(500).json({ error: 'Dashboard failed' }); 
  }
});

// Grabs all individual booking records matching user session id
app.get('/api/user/bookings', requireAuth, async (req, res) => {
  try {
    const [bookings] = await db.query('SELECT * FROM bookings WHERE user_id=? ORDER BY created_at DESC', [req.user.id]);
    res.json(bookings);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch bookings' }); }
});

// Handle new booking submission
app.post('/api/bookings', requireAuth, async (req, res) => {
  try {
    const { type, target_name, price, booking_date } = req.body;
    if (!type || !target_name) return res.status(400).json({ error: 'Type and target required' });
    
    // Create new booking row
    const [result] = await db.query('INSERT INTO bookings (user_id, type, target_name, price, booking_date) VALUES (?, ?, ?, ?, ?)', [req.user.id, type, target_name, price || 0, booking_date || null]);
    res.json({ ok: true, id: result.insertId });
  } catch (err) { res.status(500).json({ error: 'Booking failed' }); }
});

// Process booking cancellation by the user
app.delete('/api/user/bookings/:id', requireAuth, async (req, res) => {
  try {
    // Only fetch bookings owned by this user
    const [bookings] = await db.query('SELECT * FROM bookings WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    if (!bookings.length) return res.status(404).json({ error: 'Booking not found' });
    
    const booking = bookings[0];
    // Evaluate if booking is within tight cancellation window (24hrs)
    if (booking.booking_date) {
      const diff = new Date(booking.booking_date) - new Date();
      if (diff < 86400000 && diff > 0) return res.status(400).json({ error: 'Cannot cancel within 24 hours' });
    }
    
    // Soft delete / Status flag modification
    await db.query("UPDATE bookings SET status='cancelled' WHERE id=?", [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Cancel failed' }); }
});

// Fetch reviews placed exclusively by the requesting user
app.get('/api/user/reviews', requireAuth, async (req, res) => {
  try {
    const [reviews] = await db.query('SELECT * FROM reviews WHERE user_id=? ORDER BY created_at DESC', [req.user.id]);
    res.json(reviews);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch reviews' }); }
});

// Enable users to rewrite or re-rate a past review they made
app.put('/api/user/reviews/:id', requireAuth, async (req, res) => {
  try {
    // Verify ownership
    const [reviews] = await db.query('SELECT * FROM reviews WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    if (!reviews.length) return res.status(404).json({ error: 'Review not found' });
    
    const { rating, text } = req.body;
    // Update data payload
    await db.query('UPDATE reviews SET rating=?, text=? WHERE id=?', [rating, text, req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Update failed' }); }
});

// Deletes a review tied to the requesting user session
app.delete('/api/user/reviews/:id', requireAuth, async (req, res) => {
  try {
    const [reviews] = await db.query('SELECT * FROM reviews WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    if (!reviews.length) return res.status(404).json({ error: 'Review not found' });
    await db.query('DELETE FROM reviews WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Delete failed' }); }
});

// Fetch all "bookmarked" or "saved" spots for the user
app.get('/api/user/saved-spots', requireAuth, async (req, res) => {
  try {
    // Left Join spot info into saved_spots matching user ID
    const [saved] = await db.query('SELECT ss.*, s.name as spot_name, s.image, s.category, d.name as district_name FROM saved_spots ss JOIN spots s ON ss.spot_id = s.id JOIN districts d ON s.district_id = d.id WHERE ss.user_id=? ORDER BY ss.created_at DESC', [req.user.id]);
    res.json(saved);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch saved spots' }); }
});

// Bookmark a spot
app.post('/api/user/saved-spots', requireAuth, async (req, res) => {
  try {
    const { spot_id } = req.body;
    if (!spot_id) return res.status(400).json({ error: 'Spot ID required' });
    
    // Check constraints to avoid unique key duplicates on bookmarks
    const [existing] = await db.query('SELECT id FROM saved_spots WHERE user_id=? AND spot_id=?', [req.user.id, spot_id]);
    if (existing.length) return res.status(409).json({ error: 'Already saved' });
    
    await db.query('INSERT INTO saved_spots (user_id, spot_id) VALUES (?, ?)', [req.user.id, spot_id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Save failed' }); }
});

// Un-bookmark a spot
app.delete('/api/user/saved-spots/:id', requireAuth, async (req, res) => {
  try {
    await db.query('DELETE FROM saved_spots WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Delete failed' }); }
});

// Gets relevant guides dynamically matched with the user's bookmarked spots
app.get('/api/user/guides', requireAuth, async (req, res) => {
  try {
    // Get array of saved spots
    const [saved] = await db.query('SELECT ss.spot_id FROM saved_spots ss WHERE ss.user_id=?', [req.user.id]);
    if (!saved.length) return res.json([]);
    
    // Use SQL 'IN' structure
    const spotIds = saved.map(s => s.spot_id);
    const placeholders = spotIds.map(() => '?').join(',');
    
    // Look up guides operating in any saved spot areas
    const [guides] = await db.query(`SELECT g.* FROM guides g JOIN spots s ON g.spot_id = s.id WHERE s.id IN (${placeholders})`, spotIds);
    res.json(guides);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch guides' }); }
});

// Profile update route, dynamically replacing submitted values or using fallback user context
app.put('/api/auth/profile', requireAuth, async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    await db.query('UPDATE users SET name=?, phone=?, address=? WHERE id=?', [name || req.user.name, phone || '', address || '', req.user.id]);
    // Respond back with combined object tracking state modification
    res.json({ ok: true, user: { ...req.user, name: name || req.user.name, phone, address } });
  } catch (err) { res.status(500).json({ error: 'Profile update failed' }); }
});

// ============= SEED ON STARTUP =============
// Setup local seeder to trigger conditionally on app boot
const seedDatabase = require('./database/seed');

// Export app component enabling tests wrapping logic without ports binding
module.exports = app;

// Listen mode if explicitly run via node directly rather than required within a test harness
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`API server listening on http://localhost:${PORT}`);
    // Run DB schema populate script on successful binding
    seedDatabase().catch(err => {
      console.error('[startup] Failed to seed database:', err);
    });
  });
}

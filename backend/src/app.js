/**
 * @file app.js
 * @description Main application file for the FarReach Tourism App backend.
 * Configures Express, middleware, routing, authentication, and API endpoints.
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const express = require('express');
const nodemailer = require('nodemailer');
const multer = require('multer');
const db = require('./config/db');

const projectRoot = path.join(__dirname, '../..');
const envPaths = [path.join(__dirname, '.env'), path.join(projectRoot, '.env')];
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

const app = express();
const PORT = process.env.PORT || 3000;
const clientRoot = path.join(__dirname, '../../frontend/src');

app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-Token');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});
app.use(express.static(clientRoot));

app.get('/client-config.js', (req, res) => {
  const clientConfig = {
    APP_API_BASE_URL: process.env.APP_API_BASE_URL || `http://127.0.0.1:${PORT}`,
  };
  res.type('application/javascript').send(`window.APP_API_BASE_URL = ${JSON.stringify(clientConfig.APP_API_BASE_URL)};`);
});

async function currentUserFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return null;
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    const [users] = await db.query('SELECT id, name, email, role, phone, address, profile_pic FROM users WHERE id = ?', [payload.id]);
    return users.length > 0 ? users[0] : null;
  } catch { return null; }
}

async function requireAdmin(req, res, next) {
  const user = await currentUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Sign in required' });
  if (user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

async function requireAuth(req, res, next) {
  const user = await currentUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Sign in required' });
  req.user = user;
  next();
}

const storage = multer.diskStorage({
  destination: path.join(clientRoot, 'assets', 'spot-pictures'),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

app.get('/', (req, res) => {
  res.sendFile(path.join(clientRoot, 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(clientRoot, 'index.html'));
});

app.get('/admin-dashboard', (req, res) => {
  res.sendFile(path.join(clientRoot, 'admin-dashboard.html'));
});

app.get('/user-dashboard', (req, res) => {
  res.sendFile(path.join(clientRoot, 'user-dashboard.html'));
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

function getApiKey() {
  const key = (process.env.OPENWEATHER_API_KEY ?? '').trim();
  if (!key || key === 'PUT_YOUR_KEY_HERE' || key === 'YOUR_API_KEY_HERE') return null;
  return key;
}

// ============= WEATHER =============
app.get('/api/weather', async (req, res) => {
  try {
    const { district } = req.query;
    if (!district) return res.status(400).json({ error: 'District is required' });
    const apiKey = getApiKey();
    const encoded = encodeURIComponent(district.replace(/\s*\(.*?\)\s*/g, '').trim());
    const geo = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encoded},BD&limit=1&appid=${apiKey}`);
    if (!geo.ok) throw new Error('Geocode failed');
    const geoData = await geo.json();
    if (!geoData.length) return res.status(404).json({ error: 'Location not found' });
    const { lat, lon } = geoData[0];
    const weather = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`);
    if (!weather.ok) throw new Error('Weather fetch failed');
    const data = await weather.json();
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

app.get('/api/forecast', async (req, res) => {
  try {
    const { district, date } = req.query;
    if (!district) return res.status(400).json({ error: 'District is required' });
    const apiKey = getApiKey();
    if (!apiKey) {
      const fallback = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=23.7&longitude=90.4&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`);
      const fallbackData = await fallback.json();
      return res.json(parseFallbackForecast(fallbackData, date));
    }
    const encoded = encodeURIComponent(district.replace(/\s*\(.*?\)\s*/g, '').trim());
    const geo = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encoded},BD&limit=1&appid=${apiKey}`);
    if (!geo.ok) throw new Error('Geocode failed');
    const geoData = await geo.json();
    if (!geoData.length) return res.status(404).json({ error: 'Location not found' });
    const { lat, lon } = geoData[0];
    const forecast = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`);
    if (!forecast.ok) throw new Error('Forecast fetch failed');
    const data = await forecast.json();
    const daily = {};
    for (const item of data.list) {
      const d = item.dt_txt.split(' ')[0];
      if (!daily[d]) daily[d] = [];
      daily[d].push(item.main.temp);
    }
    const result = Object.entries(daily).map(([day, temps]) => ({
      date: day,
      temp_max: Math.round(Math.max(...temps)),
      temp_min: Math.round(Math.min(...temps)),
    }));
    if (date) {
      const matched = result.find(r => r.date === date);
      return res.json(matched || result);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Forecast unavailable', detail: err.message });
  }
});

function parseFallbackForecast(data, date) {
  if (!data.daily) return [];
  const days = data.daily.time.map((t, i) => ({
    date: t,
    temp_max: Math.round(data.daily.temperature_2m_max[i]),
    temp_min: Math.round(data.daily.temperature_2m_min[i]),
  }));
  if (date) {
    const matched = days.find(d => d.date === date);
    return matched || days;
  }
  return days;
}

// ============= GEOCODE =============
app.get('/api/geocode', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });
    const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
    const data = await resp.json();
    res.json({ display_name: data.display_name || 'Unknown', address: data.address || {} });
  } catch (err) {
    res.status(500).json({ error: 'Geocode failed' });
  }
});

app.get('/api/directions', async (req, res) => {
  try {
    const { origin, destination } = req.query;
    if (!origin || !destination) return res.status(400).json({ error: 'origin and destination required' });
    const resp = await fetch(`https://router.project-osrm.org/route/v1/driving/${origin};${destination}?overview=full&geometries=geojson`);
    const data = await resp.json();
    if (!data.routes || !data.routes.length) return res.status(404).json({ error: 'No route found' });
    const route = data.routes[0];
    res.json({ distance_km: (route.distance / 1000).toFixed(1), duration_min: Math.round(route.duration / 60), geometry: route.geometry });
  } catch (err) {
    res.status(500).json({ error: 'Directions unavailable' });
  }
});

// ============= AUTH =============
app.get('/api/auth/me', async (req, res) => {
  const user = await currentUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ user });
});

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const otpStore = new Map();

app.post('/api/auth/signup/start', async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Name and email required' });
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) return res.status(409).json({ error: 'Email already registered' });
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + 10 * 60 * 1000;
    otpStore.set(email, { name, code, expiresAt });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'Bangladesh Tourism <noreply@bdtourism.com>',
      to: email, subject: 'Your OTP Code',
      text: `Your verification code is: ${code}\nValid for 10 minutes.`,
    });
    console.log(`[OTP] ${email}: ${code}`);
    res.json({ ok: true, message: 'Code sent' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send code' });
  }
});

app.post('/api/auth/signup/resend', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const entry = otpStore.get(email);
    if (!entry) return res.status(400).json({ error: 'No pending verification' });
    const code = String(Math.floor(100000 + Math.random() * 900000));
    entry.code = code;
    entry.expiresAt = Date.now() + 10 * 60 * 1000;
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

app.post('/api/auth/signup/verify-code', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'Email and code required' });
    const entry = otpStore.get(email);
    if (!entry) return res.status(400).json({ error: 'No pending verification' });
    if (Date.now() > entry.expiresAt) return res.status(400).json({ error: 'Code expired' });
    if (entry.code !== code) return res.status(400).json({ error: 'Invalid code' });
    entry.verified = true;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.post('/api/auth/signup/set-password', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const entry = otpStore.get(email);
    if (!entry || !entry.verified) return res.status(400).json({ error: 'Verify code first' });
    const hashed = await bcrypt.hash(password, 10);
    const [result] = await db.query('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', [entry.name, email, hashed]);
    otpStore.delete(email);
    const token = Buffer.from(JSON.stringify({ id: result.insertId, exp: Date.now() + 3600000 })).toString('base64');
    res.json({ ok: true, token, user: { id: result.insertId, name: entry.name, email, role: 'user' } });
  } catch (err) {
    res.status(500).json({ error: 'Account creation failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (!users.length) return res.status(401).json({ error: 'Invalid email or password' });
    const user = users[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid email or password' });
    const token = Buffer.from(JSON.stringify({ id: user.id, exp: Date.now() + 3600000 })).toString('base64');
    res.json({ ok: true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ ok: true });
});

// ============= HOTELS =============
app.post('/api/hotels/search', async (req, res) => {
  try {
    const { city } = req.body;
    if (!city) return res.status(400).json({ error: 'City required' });
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
app.get('/api/reviews', async (req, res) => {
  try {
    const { destinationName } = req.query;
    let query = `SELECT r.*, u.name as user_name, u.profile_pic FROM reviews r JOIN users u ON r.user_id = u.id`;
    const params = [];
    if (destinationName) {
      query += ` WHERE r.destination_name = ?`;
      params.push(destinationName);
    }
    query += ` ORDER BY r.created_at DESC LIMIT 50`;
    const [reviews] = await db.query(query, params);
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

app.post('/api/reviews', requireAuth, async (req, res) => {
  try {
    const { destinationName, rating, text } = req.body;
    if (!destinationName || !rating || !text) return res.status(400).json({ error: 'All fields required' });
    const [result] = await db.query('INSERT INTO reviews (user_id, destination_name, rating, text) VALUES (?, ?, ?, ?)', [req.user.id, destinationName, rating, text]);
    res.json({ ok: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// ============= SITE CONTENT =============
app.get('/api/site-content', (req, res) => {
  res.json({
    title: 'Bangladesh Tourism Explorer',
    description: 'Discover 100+ tourist destinations across Bangladesh',
    stats: { spots: 100, districts: 64, divisions: 8 },
  });
});

// ============= SPOTS =============
app.get('/api/spots/lookup', async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const [spots] = await db.query('SELECT s.*, d.name as district_name, dv.name as division_name FROM spots s JOIN districts d ON s.district_id = d.id JOIN divisions dv ON d.division_id = dv.id WHERE s.name LIKE ? LIMIT 1', [`%${name}%`]);
    if (!spots.length) return res.status(404).json({ error: 'Spot not found' });
    res.json(spots[0]);
  } catch (err) {
    res.status(500).json({ error: 'Lookup failed' });
  }
});

app.get('/api/spots', async (req, res) => {
  try {
    const [spots] = await db.query('SELECT s.*, d.name as district_name, dv.name as division_name FROM spots s JOIN districts d ON s.district_id = d.id JOIN divisions dv ON d.division_id = dv.id ORDER BY s.name');
    const [divisions] = await db.query('SELECT dv.*, (SELECT COUNT(*) FROM spots s JOIN districts d ON s.district_id = d.id WHERE d.division_id = dv.id) as spot_count FROM divisions dv ORDER BY dv.name');
    res.json({ spots, divisions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch spots' });
  }
});

// ============= ADMIN =============
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const [[{ total_users }]] = await db.query('SELECT COUNT(*) as total_users FROM users');
    const [[{ total_spots }]] = await db.query('SELECT COUNT(*) as total_spots FROM spots');
    const [[{ total_reviews }]] = await db.query('SELECT COUNT(*) as total_reviews FROM reviews');
    const [[{ pending_bookings }]] = await db.query("SELECT COUNT(*) as pending_bookings FROM bookings WHERE status='pending'");
    res.json({ total_users, total_spots, total_reviews, pending_bookings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

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

app.post('/api/admin/spots', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { name, category, description, history, district_id, best_time, tips, highlights, latitude, longitude, budget_category } = req.body;
    if (!name || !category || !district_id) return res.status(400).json({ error: 'Name, category, district required' });
    const image = req.file ? req.file.filename : '';
    const [result] = await db.query('INSERT INTO spots (name, category, description, history, district_id, best_time, tips, highlights, latitude, longitude, image, budget_category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, category, description || '', history || '', district_id, best_time || '', tips || '', highlights || '', latitude || null, longitude || null, image, budget_category || 'Mid']);
    res.json({ ok: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add spot' });
  }
});

app.put('/api/admin/spots/:id', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { name, category, description, history, district_id, best_time, tips, highlights, latitude, longitude, budget_category } = req.body;
    let sql = 'UPDATE spots SET name=?, category=?, description=?, history=?, district_id=?, best_time=?, tips=?, highlights=?, latitude=?, longitude=?, budget_category=?';
    const params = [name, category, description, history, district_id, best_time, tips, highlights, latitude, longitude, budget_category];
    if (req.file) { sql += ', image=?'; params.push(req.file.filename); }
    sql += ' WHERE id=?'; params.push(req.params.id);
    await db.query(sql, params);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update spot' });
  }
});

app.delete('/api/admin/spots/:id', requireAdmin, async (req, res) => {
  try { await db.query('DELETE FROM spots WHERE id=?', [req.params.id]); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: 'Delete failed' }); }
});

app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try { const [users] = await db.query('SELECT id, name, email, role, created_at FROM users ORDER BY id'); res.json(users); }
  catch (err) { res.status(500).json({ error: 'Failed to fetch users' }); }
});

app.put('/api/admin/users/:id/role', requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    const [[user]] = await db.query('SELECT role FROM users WHERE id=?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'admin' && role === 'user') {
      const [[adminCount]] = await db.query("SELECT COUNT(*) as cnt FROM users WHERE role='admin'");
      if (adminCount.cnt <= 1) return res.status(400).json({ error: 'Cannot demote the last admin' });
    }
    await db.query('UPDATE users SET role=? WHERE id=?', [role, req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Role update failed' }); }
});

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    const [[user]] = await db.query('SELECT role FROM users WHERE id=?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'admin') {
      const [[adminCount]] = await db.query("SELECT COUNT(*) as cnt FROM users WHERE role='admin'");
      if (adminCount.cnt <= 1) return res.status(400).json({ error: 'Cannot delete the last admin' });
    }
    await db.query('DELETE FROM reviews WHERE user_id=?', [req.params.id]);
    await db.query('DELETE FROM saved_spots WHERE user_id=?', [req.params.id]);
    await db.query('DELETE FROM bookings WHERE user_id=?', [req.params.id]);
    await db.query('DELETE FROM users WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Delete failed' }); }
});

app.post('/api/admin/divisions', requireAdmin, async (req, res) => {
  try { const { name } = req.body; if (!name) return res.status(400).json({ error: 'Name required' }); const [r] = await db.query('INSERT INTO divisions (name) VALUES (?)', [name]); res.json({ ok: true, id: r.insertId }); }
  catch (err) { res.status(500).json({ error: 'Create failed' }); }
});

app.put('/api/admin/divisions/:id', requireAdmin, async (req, res) => {
  try { await db.query('UPDATE divisions SET name=? WHERE id=?', [req.body.name, req.params.id]); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: 'Update failed' }); }
});

app.delete('/api/admin/divisions/:id', requireAdmin, async (req, res) => {
  try { await db.query('DELETE FROM divisions WHERE id=?', [req.params.id]); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: 'Delete failed' }); }
});

app.post('/api/admin/districts', requireAdmin, async (req, res) => {
  try { const { name, division_id } = req.body; if (!name || !division_id) return res.status(400).json({ error: 'Name and division required' }); const [r] = await db.query('INSERT INTO districts (name, division_id) VALUES (?, ?)', [name, division_id]); res.json({ ok: true, id: r.insertId }); }
  catch (err) { res.status(500).json({ error: 'Create failed' }); }
});

app.put('/api/admin/districts/:id', requireAdmin, async (req, res) => {
  try { await db.query('UPDATE districts SET name=?, division_id=? WHERE id=?', [req.body.name, req.body.division_id, req.params.id]); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: 'Update failed' }); }
});

app.delete('/api/admin/districts/:id', requireAdmin, async (req, res) => {
  try { await db.query('DELETE FROM districts WHERE id=?', [req.params.id]); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: 'Delete failed' }); }
});

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
  try { await db.query('DELETE FROM guides WHERE id=?', [req.params.id]); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: 'Delete failed' }); }
});

app.get('/api/admin/reviews', requireAdmin, async (req, res) => {
  try {
    const [reviews] = await db.query('SELECT r.*, u.name as user_name, u.email as user_email FROM reviews r JOIN users u ON r.user_id = u.id ORDER BY r.created_at DESC');
    res.json(reviews);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch reviews' }); }
});

app.put('/api/admin/reviews/:id/reply', requireAdmin, async (req, res) => {
  try { await db.query('UPDATE reviews SET admin_reply=? WHERE id=?', [req.body.reply, req.params.id]); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: 'Reply failed' }); }
});

app.delete('/api/admin/reviews/:id', requireAdmin, async (req, res) => {
  try { await db.query('DELETE FROM reviews WHERE id=?', [req.params.id]); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: 'Delete failed' }); }
});

app.get('/api/admin/bookings', requireAdmin, async (req, res) => {
  try {
    const [bookings] = await db.query('SELECT b.*, u.name as user_name, u.email as user_email FROM bookings b JOIN users u ON b.user_id = u.id ORDER BY b.created_at DESC');
    res.json(bookings);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch bookings' }); }
});

app.put('/api/admin/bookings/:id/status', requireAdmin, async (req, res) => {
  try { await db.query('UPDATE bookings SET status=? WHERE id=?', [req.body.status, req.params.id]); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: 'Update failed' }); }
});

// ============= USER DASHBOARD =============
app.get('/api/user/dashboard', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const [[{ active_bookings }]] = await db.query("SELECT COUNT(*) as active_bookings FROM bookings WHERE user_id=? AND status IN ('pending','confirmed')", [userId]);
    const [[{ total_reviews }]] = await db.query('SELECT COUNT(*) as total_reviews FROM reviews WHERE user_id=?', [userId]);
    const [[{ saved_count }]] = await db.query('SELECT COUNT(*) as saved_count FROM saved_spots WHERE user_id=?', [userId]);
    res.json({ active_bookings, total_reviews, saved_count });
  } catch (err) { res.status(500).json({ error: 'Dashboard failed' }); }
});

app.get('/api/user/bookings', requireAuth, async (req, res) => {
  try {
    const [bookings] = await db.query('SELECT * FROM bookings WHERE user_id=? ORDER BY created_at DESC', [req.user.id]);
    res.json(bookings);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch bookings' }); }
});

app.post('/api/bookings', requireAuth, async (req, res) => {
  try {
    const { type, target_name, price, booking_date } = req.body;
    if (!type || !target_name) return res.status(400).json({ error: 'Type and target required' });
    const [result] = await db.query('INSERT INTO bookings (user_id, type, target_name, price, booking_date) VALUES (?, ?, ?, ?, ?)', [req.user.id, type, target_name, price || 0, booking_date || null]);
    res.json({ ok: true, id: result.insertId });
  } catch (err) { res.status(500).json({ error: 'Booking failed' }); }
});

app.delete('/api/user/bookings/:id', requireAuth, async (req, res) => {
  try {
    const [bookings] = await db.query('SELECT * FROM bookings WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    if (!bookings.length) return res.status(404).json({ error: 'Booking not found' });
    const booking = bookings[0];
    if (booking.booking_date) {
      const diff = new Date(booking.booking_date) - new Date();
      if (diff < 86400000 && diff > 0) return res.status(400).json({ error: 'Cannot cancel within 24 hours' });
    }
    await db.query("UPDATE bookings SET status='cancelled' WHERE id=?", [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Cancel failed' }); }
});

app.get('/api/user/reviews', requireAuth, async (req, res) => {
  try {
    const [reviews] = await db.query('SELECT * FROM reviews WHERE user_id=? ORDER BY created_at DESC', [req.user.id]);
    res.json(reviews);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch reviews' }); }
});

app.put('/api/user/reviews/:id', requireAuth, async (req, res) => {
  try {
    const [reviews] = await db.query('SELECT * FROM reviews WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    if (!reviews.length) return res.status(404).json({ error: 'Review not found' });
    const { rating, text } = req.body;
    await db.query('UPDATE reviews SET rating=?, text=? WHERE id=?', [rating, text, req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Update failed' }); }
});

app.delete('/api/user/reviews/:id', requireAuth, async (req, res) => {
  try {
    const [reviews] = await db.query('SELECT * FROM reviews WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    if (!reviews.length) return res.status(404).json({ error: 'Review not found' });
    await db.query('DELETE FROM reviews WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Delete failed' }); }
});

app.get('/api/user/saved-spots', requireAuth, async (req, res) => {
  try {
    const [saved] = await db.query('SELECT ss.*, s.name as spot_name, s.image, s.category, d.name as district_name FROM saved_spots ss JOIN spots s ON ss.spot_id = s.id JOIN districts d ON s.district_id = d.id WHERE ss.user_id=? ORDER BY ss.created_at DESC', [req.user.id]);
    res.json(saved);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch saved spots' }); }
});

app.post('/api/user/saved-spots', requireAuth, async (req, res) => {
  try {
    const { spot_id } = req.body;
    if (!spot_id) return res.status(400).json({ error: 'Spot ID required' });
    const [existing] = await db.query('SELECT id FROM saved_spots WHERE user_id=? AND spot_id=?', [req.user.id, spot_id]);
    if (existing.length) return res.status(409).json({ error: 'Already saved' });
    await db.query('INSERT INTO saved_spots (user_id, spot_id) VALUES (?, ?)', [req.user.id, spot_id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Save failed' }); }
});

app.delete('/api/user/saved-spots/:id', requireAuth, async (req, res) => {
  try {
    await db.query('DELETE FROM saved_spots WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Delete failed' }); }
});

app.get('/api/user/guides', requireAuth, async (req, res) => {
  try {
    const [saved] = await db.query('SELECT ss.spot_id FROM saved_spots ss WHERE ss.user_id=?', [req.user.id]);
    if (!saved.length) return res.json([]);
    const spotIds = saved.map(s => s.spot_id);
    const placeholders = spotIds.map(() => '?').join(',');
    const [guides] = await db.query(`SELECT g.* FROM guides g JOIN spots s ON g.spot_id = s.id WHERE s.id IN (${placeholders})`, spotIds);
    res.json(guides);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch guides' }); }
});

app.put('/api/auth/profile', requireAuth, async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    await db.query('UPDATE users SET name=?, phone=?, address=? WHERE id=?', [name || req.user.name, phone || '', address || '', req.user.id]);
    res.json({ ok: true, user: { ...req.user, name: name || req.user.name, phone, address } });
  } catch (err) { res.status(500).json({ error: 'Profile update failed' }); }
});

// ============= SEED ON STARTUP =============
const seedDatabase = require('./database/seed');

// Export app for testing
module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`API server listening on http://localhost:${PORT}`);
    seedDatabase().catch(err => {
      console.error('[startup] Failed to seed database:', err);
    });
  });
}

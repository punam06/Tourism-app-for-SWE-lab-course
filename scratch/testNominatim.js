const https = require('https');
const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent('Sajek Valley Rangamati Bangladesh')}`;
https.get(url, { headers: { 'User-Agent': 'Test' } }, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(data));
});

/**
 * @file index.js
 * @description Entry point for the FarReach application. Starts the Express server.
 */
const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
  const seedDatabase = require('./database/seed');
  seedDatabase().catch(err => {
    console.error('[startup] Failed to seed database:', err);
  });
});

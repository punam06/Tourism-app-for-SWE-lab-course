const seed = require('./seed');
const db = require('../config/db');

(async () => {
  try {
    await seed();
    console.log('Standalone seeding complete!');
    await db.end();
    process.exit(0);
  } catch (err) {
    console.error('Standalone seeding failed:', err);
    process.exit(1);
  }
})();

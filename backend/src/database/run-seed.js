/**
 * @file run-seed.js
 * @description Standalone script to execute the database seeding process.
 */
// Import the seeding module containing the logic to populate the DB
const seed = require('./seed');
// Import the database connection pool to handle connections
const db = require('../config/db');

// Execute an Immediately Invoked Function Expression (IIFE) for async await
(async () => {
  try {
    // Run the seeding logic
    await seed();
    // Log a success message once the seeding completes
    console.log('Standalone seeding complete!');
    // Close the database connection pool cleanly to exit
    await db.end();
    // Exit the process successfully
    process.exit(0);
  } catch (err) {
    // Catch and log any errors that happen during the seeding process
    console.error('Standalone seeding failed:', err);
    // Exit the process with an error code
    process.exit(1);
  }
})();

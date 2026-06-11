/**
 * @file index.js
 * @description Entry point for the FarReach application. Starts the Express server.
 */
// Import the configured Express app
const app = require('./app');

// Define the port from environment variables or default to 3000
const PORT = process.env.PORT || 3000;

// Start the server listening on the defined port
app.listen(PORT, () => {
  // Log a message indicating the server has started successfully
  console.log(`API server listening on http://localhost:${PORT}`);
  
  // Import the database seed function
  const seedDatabase = require('./database/seed');
  
  // Execute the seed function to populate the database with initial data
  seedDatabase().catch(err => {
    // Log any errors that occur during the seeding process
    console.error('[startup] Failed to seed database:', err);
  });
});

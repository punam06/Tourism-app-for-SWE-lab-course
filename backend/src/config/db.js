/**
 * @file db.js
 * @description Database configuration and connection pool setup using MySQL.
 */
// Import the promise-based mysql2 module for database interaction
const mysql = require('mysql2/promise');
// Import path module to resolve file paths
const path = require('path');
// Load environment variables from the .env file in the parent directory
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Create a connection pool to manage multiple database connections efficiently
const pool = mysql.createPool({
  // Use the host from environment variables or default to localhost
  host: process.env.DB_HOST || 'localhost',
  // Use the username from environment variables or default to root
  user: process.env.DB_USER || 'root',
  // Use the password from environment variables or default to empty string
  password: process.env.DB_PASSWORD || '',
  // Use the database name from environment variables or default to torisom_db
  database: process.env.DB_NAME || 'torisom_db',
  // Wait for connections if the pool is full
  waitForConnections: true,
  // Limit the maximum number of concurrent connections
  connectionLimit: 10,
  // Queue limit set to 0 means unlimited waiting requests
  queueLimit: 0
});

// Export the connection pool for use in other modules
module.exports = pool;

# FarReach Backend Explanation

This document provides a detailed breakdown of the backend architecture and modules for the FarReach Tourism Application.

## Overview
The backend is built using **Node.js** and **Express.js**, providing a robust RESTful API. It connects to a **MySQL 8.0** database to manage user authentication, destination data, guides, bookings, and user reviews.

## Core Modules

### 1. `app.js`
This is the core application file. It encapsulates the main logic of the server:
- **Express Configuration:** Initializes the Express application, configures CORS, sets JSON body size limits, and serves static frontend files.
- **Middleware:** Implements custom authentication (`requireAuth`) and authorization (`requireAdmin`) middleware. Parses JWT-like base64 tokens to validate sessions.
- **Routing:** Contains all the API endpoints, including:
  - **Auth (`/api/auth/*`):** Handles signup, OTP-based email verification, login, and profile updates.
  - **Weather & Geocode (`/api/weather`, `/api/forecast`, `/api/geocode`):** Integrates with OpenWeather, Open-Meteo, and Nominatim OpenStreetMap for location-based services.
  - **Spots (`/api/spots/*`):** Serves tourist destination data, including searching and filtering.
  - **Bookings & Reviews:** Manages user bookings and reviews.
  - **Admin Panel (`/api/admin/*`):** Secure endpoints for administrators to manage users, spots, divisions, and guides.

### 2. `index.js`
The entry point of the backend application.
- It imports the configured Express app from `app.js`.
- Binds the server to the configured port (`3000` by default).
- Automatically triggers the `seedDatabase()` function on successful startup to ensure the database has the required initial data.

### 3. `config/db.js`
Handles the database connection.
- Uses `mysql2/promise` to establish an asynchronous connection pool.
- Reads configuration from the `.env` file (host, user, password, database).
- Provides a reusable `pool` object that automatically manages connections and queuing to prevent database overloads.

### 4. `database/seed.js`
The database population module.
- Contains the raw initial data arrays for all 82 tourist spots, divisions, districts, and sample guide names/specialties.
- Upon execution, it performs a series of `INSERT` and `UPDATE` queries.
- Ensures the data structure is robust by automatically creating missing divisions or districts before associating spots to them.
- Prevents duplication by checking if records already exist.

### 5. `database/run-seed.js`
A standalone execution script for the seeder.
- Allows developers or deployment pipelines to run the database seeding process manually without needing to spin up the entire Express web server.
- Handles clean exit codes (`0` for success, `1` for error) for automation scripts.

### 6. `__tests__/api.test.js`
The automated test suite.
- Built using `supertest` and `jest`.
- Sends HTTP requests directly to the Express app instances to validate routes.
- Checks core functionalities like health endpoints, unauthenticated rejections (401 errors), and structural formatting of API JSON responses.

## Security & Utilities
- **Bcrypt:** Used extensively in the auth routes to hash and verify passwords securely.
- **Nodemailer:** Configured to send OTP (One-Time Passwords) during the signup phase, ensuring emails are verified before account creation.
- **Multer:** Handles multipart/form-data for image uploads when admins add or update spot pictures. It enforces strict file size limits and generates unique filenames to prevent overwrites.

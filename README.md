# FarReach — Bangladesh Tourism Explorer

A unified tourism management platform built with Node.js, Express, and MySQL. Users can explore destinations, check weather forecasts, calculate travel budgets, and book trips online.

## Tech Stack

- **Backend:** Node.js, Express
- **Database:** MySQL 8.0
- **Containerization:** Docker & Docker Compose
- **APIs:** OpenWeather, Google Maps

## Getting Started

### Prerequisites

- Docker & Docker Compose (recommended)
- Node.js 18+ (for local development)

### Run with Docker

```bash
docker compose up --build
```

The app will be available at `http://localhost:3000`.

### Run locally

```bash
cd backend/src
npm install
# Set up MySQL and configure .env
npm start
```

## Project Structure

```
├── backend/src/          # Node.js backend application
│   ├── app.js            # Express app setup
│   ├── index.js          # Entry point
│   ├── database/         # SQL schema and seed files
│   └── .env              # Environment configuration
├── docker-compose.yml    # Docker services (app + MySQL)
├── Dockerfile            # Backend container image
└── LICENSE               # MIT License
```

## Backend Architecture & Modules Explanation

The backend of the FarReach application is built modularly using Node.js and Express. Here is a breakdown of the key components:

- **`index.js`**: The main entry point that starts the Express server. It handles port binding and triggers the initial database seeding script upon startup.
- **`app.js`**: Contains the core application logic. It configures the Express server, sets up middleware (like CORS and body parsers), and defines all the API routes (authentication, weather, geocoding, hotels, reviews, admin management, and user dashboard).
- **`config/db.js`**: Manages the database connection pool using `mysql2/promise`. It establishes a robust, reusable connection to the MySQL database.
- **`database/seed.js`**: Contains the database population logic. It dynamically inserts initial data such as geographical divisions, districts, specific tourist spots, and guides to ensure the application works out-of-the-box.
- **`database/run-seed.js`**: A standalone script that can be executed directly from the terminal to manually trigger the database seeding process without starting the full Express server.
- **`__tests__/api.test.js`**: Houses the automated integration tests using `supertest`. It validates the functionality and responses of critical API endpoints to ensure system stability.

## License

MIT License — see [LICENSE](LICENSE).

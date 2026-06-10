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

## License

MIT License — see [LICENSE](LICENSE).

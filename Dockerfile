# Use the official Node.js 18 Alpine image for a lightweight base environment
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy the backend package files first to leverage Docker layer caching for npm install
COPY backend/src/package*.json ./backend/src/

# Install only production dependencies within the backend directory
RUN cd backend/src && npm install --omit=dev

# Copy the rest of the application files into the container
COPY . .

# Expose port 3000 to allow incoming traffic to the Node.js server
EXPOSE 3000

# Start the Node.js application using the main entry script
CMD ["node", "backend/src/index.js"]

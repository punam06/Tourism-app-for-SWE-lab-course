FROM node:18-alpine

WORKDIR /app

COPY backend/src/package*.json ./backend/src/
RUN cd backend/src && npm install --omit=dev

COPY . .

EXPOSE 3000

CMD ["node", "backend/src/index.js"]

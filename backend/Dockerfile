FROM node:20-alpine

WORKDIR /app

COPY backend/package*.json ./
COPY backend/prisma ./prisma

RUN npm ci
RUN npx prisma generate

COPY backend/src ./src
COPY backend/uploads ./uploads
COPY frontend ../frontend

ENV NODE_ENV=production
EXPOSE 5000

CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]

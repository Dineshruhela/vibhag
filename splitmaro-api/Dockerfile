FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci
RUN npx prisma generate

# Copy source code and build
COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]

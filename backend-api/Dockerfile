FROM node:24-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src

EXPOSE 4000
CMD ["npx", "ts-node", "src/index.ts"]

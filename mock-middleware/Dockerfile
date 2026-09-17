FROM node:24-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src

EXPOSE 5001
HEALTHCHECK --interval=3s --timeout=3s --start-period=10s --retries=20 \
  CMD node -e "require('http').get('http://localhost:5001/admin/nonce-status', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"
CMD ["npx", "ts-node", "src/index.ts"]

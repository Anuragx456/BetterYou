# Production Dockerfile for BetterYou Hono Proxy Server
FROM oven/bun:1.2-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Copy source code
COPY src ./src

# Expose server port
EXPOSE 8787

ENV PORT=8787
ENV NODE_ENV=production

# Run as non-root bun user
USER bun

CMD ["bun", "run", "src/index.ts"]

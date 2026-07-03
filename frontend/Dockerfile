FROM node:20-alpine AS builder
WORKDIR /app
# Copy lockfile + package.json first for layer caching
COPY package.json package-lock.json* ./
# --legacy-peer-deps: Capacitor 6 + Next 14 have a peer-range overlap that
# requires this flag (documented compatibility mode for Capacitor 6).
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps
COPY . .
# Build the standalone web output (NOT the Capacitor mobile export)
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
# node server.js — Next.js standalone server (no npm needed at runtime)
CMD ["node", "server.js"]

FROM node:22-bookworm

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN corepack enable && corepack pnpm install --frozen-lockfile

COPY . .
RUN corepack pnpm build

ENV NODE_ENV=production
EXPOSE 3000

# Apply migrations, seed the AMC registry / first account / AMFI snapshot, then serve.
CMD ["sh", "-c", "corepack pnpm drizzle-kit migrate && corepack pnpm exec tsx scripts/localBootstrap.mjs && node dist/index.js"]

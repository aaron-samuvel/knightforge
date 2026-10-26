FROM oven/bun:1-slim

WORKDIR /app

COPY mini-services/chess-game/package.json ./package.json
RUN bun install --production

COPY mini-services/chess-game/index.ts ./index.ts

ENV NODE_ENV=production
EXPOSE 10000

CMD ["bun", "index.ts"]


# KnightForge — convenience targets (see scripts/README.md)
.PHONY: setup dev lint db-push db-generate seed db-reset build start docker-up docker-down help

help:
	@echo "make setup     - install deps, create .env, push schema, seed demo data"
	@echo "make dev       - run the dev server (web :3000 + realtime :3003)"
	@echo "make lint      - ESLint"
	@echo "make db-push   - sync schema to the local SQLite db"
	@echo "make seed      - seed demo players & games (idempotent)"
	@echo "make db-reset  - DESTROY local db, recreate + reseed"
	@echo "make build     - production build (standalone)"
	@echo "make start     - run the production build on :3000"
	@echo "make docker-up / docker-down - run via Docker Compose"

setup:
	bash scripts/setup.sh

dev:
	bash scripts/dev.sh

lint:
	bun run lint

db-push:
	bun run db:push

db-generate:
	bun run db:generate

seed:
	bun prisma/seed.ts

db-reset:
	bun run db:reset
	bun prisma/seed.ts

build:
	bun run build

start:
	bun run start

docker-up:
	docker compose up -d --build

docker-down:
	docker compose down

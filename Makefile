.PHONY: help publish-major publish-minor publish-patch test build typecheck lint

# Default target
help:
	@echo "Available commands:"
	@echo "  make publish-major  - Increment major version and publish to npm"
	@echo "  make publish-minor  - Increment minor version and publish to npm"
	@echo "  make publish-patch  - Increment patch version and publish to npm"
	@echo "  make test          - Run tests"
	@echo "  make build         - Build the package"
	@echo "  make typecheck     - Run TypeScript type checking"
	@echo "  make lint          - Run ESLint"

# Publish commands
publish-major:
	@npm run typecheck
	@npm test
	@npm run build
	@npx tsx scripts/publish.ts major

publish-minor:
	@npm run typecheck
	@npm test
	@npm run build
	@npx tsx scripts/publish.ts minor

publish-patch:
	@npm run typecheck
	@npm test
	@npm run build
	@npx tsx scripts/publish.ts patch

# Development commands
test:
	@npm test

build:
	@npm run build

typecheck:
	@npm run typecheck

lint:
	@npm run lint

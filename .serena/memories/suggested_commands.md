# Suggested Commands

## Development Commands

### Building
```bash
npm run build          # Build with tsup (CJS + ESM + types)
npm run dev            # Build in watch mode
make build             # Makefile shortcut for build
```

### Type Checking
```bash
npm run typecheck      # Run TypeScript type checking
make typecheck         # Makefile shortcut
```

### Linting
```bash
npm run lint           # Run ESLint
make lint              # Makefile shortcut
```

### Testing
```bash
npm test               # Run Vitest tests once
npm run test:watch     # Run Vitest in watch mode
npm run test:coverage  # Run tests with coverage
make test              # Makefile shortcut
```

### Publishing
```bash
make publish-patch     # 0.1.0 → 0.1.1 (bug fixes)
make publish-minor     # 0.1.0 → 0.2.0 (new features)
make publish-major     # 0.1.0 → 1.0.0 (breaking changes)
npx tsx scripts/publish.ts patch --dry-run  # Dry run
```

## System Information
- Platform: Darwin (macOS)
- Standard Unix commands available: git, ls, cd, grep, find, etc.

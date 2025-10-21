# Task Completion Checklist

When completing a task, always run the following in order:

## 1. Type Check
```bash
npm run typecheck
```
or
```bash
make typecheck
```

## 2. Run Tests
```bash
npm test
```
or
```bash
make test
```

## 3. Lint
```bash
npm run lint
```
or
```bash
make lint
```

## 4. Build
```bash
npm run build
```
or
```bash
make build
```

## For Publishing
Each publish command automatically runs typecheck, tests, and build:
```bash
make publish-patch  # Bug fixes
make publish-minor  # New features
make publish-major  # Breaking changes
```

## Test-Driven Development
For new hooks, follow this TDD workflow:
1. Write spec in `specs/useXXX.md`
2. Write test cases in `src/useXXX.test.ts`
3. Implement hook in `src/useXXX.ts`
4. Export from `src/index.ts`
5. Run all checks above

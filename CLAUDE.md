# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`effectts-react` is a React hooks library that bridges Effect-TS with React, providing type-safe, composable state management and side effect handling. The library wraps Effect-TS primitives (Effect, Ref, SynchronizedRef, SubscriptionRef) in React hooks.

## Commands

### Development
```bash
npm run build          # Build with tsup (CJS + ESM + types)
npm run dev            # Build in watch mode
npm run typecheck      # Run TypeScript type checking
npm run lint           # Run ESLint
npm test               # Run Vitest tests once
npm run test:watch     # Run Vitest in watch mode
npm run test:coverage  # Run tests with coverage
```

### Makefile Shortcuts
```bash
make build      # Build the package
make typecheck  # Type check
make lint       # Lint
make test       # Run tests
```

### Publishing
This project uses an Effect-TS pipeline for automated publishing (see `scripts/publish.ts`):

```bash
make publish-patch  # 0.1.0 → 0.1.1 (bug fixes)
make publish-minor  # 0.1.0 → 0.2.0 (new features)
make publish-major  # 0.1.0 → 1.0.0 (breaking changes)
```

Each publish command runs typecheck, tests, and build before publishing.

Dry-run mode for testing:
```bash
npx tsx scripts/publish.ts patch --dry-run
```

## Architecture

### Core Hook Pattern

All hooks follow a consistent pattern:

1. **Initialization**: Create Effect-TS primitive (Ref, SynchronizedRef, etc.) in `useEffect`
2. **State Management**: Use React `useState` to expose current value and loading state
3. **Cancellation**: Implement cleanup with cancellation flags to prevent state updates after unmount
4. **API Methods**: Return `useCallback`-wrapped methods that interact with the Effect primitive and sync to React state

Example structure from `useEffectRef`:
```typescript
export function useEffectRef<A>(initialValue: A) {
  const [value, setValue] = useState<A | null>(null);
  const [loading, setLoading] = useState(true);
  const [ref, setRef] = useState<Ref.Ref<A> | null>(null);

  useReactEffect(() => {
    let cancelled = false;

    Effect.runPromise(Ref.make(initialValue)).then((r) => {
      if (cancelled) return;
      setRef(r);
      // ... sync initial value
    });

    return () => { cancelled = true; };
  }, []);

  // ... callback methods (get, set, update, modify)
}
```

### Hook Categories

**1. Query Hooks** (`useEffectQuery`, `usePoll`)
- Run Effects and return results
- Return `{ data, error, loading }` state
- `usePoll` adds interval-based execution

**2. Ref Hooks** (`useEffectRef`, `useSynchronizedRef`, `useSubscriptionRef`)
- Wrap Effect-TS state primitives
- Return `{ value, loading, get, set, update, modify }`
- `useSynchronizedRef` adds `updateEffect` for atomic effectful updates
- `useSubscriptionRef` provides reactive change notifications

**3. Runtime Hooks** (`useRuntime`)
- Provides Effect runtime for manual Effect execution
- Uses `useMemo` for stable runtime reference

### Testing

Tests use Vitest with `@testing-library/react` and `happy-dom`:
- Test files: `*.test.ts` alongside source files
- Setup: `src/test/setup.ts` imports `@testing-library/jest-dom`
- Pattern: Test loading states, success cases, error cases, and cleanup

### Build & Export

- Build tool: `tsup` (generates CJS, ESM, and TypeScript declarations)
- Entry point: `src/index.ts` (re-exports all hooks)
- Output: `dist/` (included in npm package)

### Dependencies

- Peer dependencies: `effect ^3.0.0`, `react ^18.0.0`
- Dev dependencies include `@effect/platform` for publish script
- Testing uses Vitest, React Testing Library, and happy-dom

## Specs Directory

The `specs/` directory contains design specifications for all hooks (implemented and proposed).

### Strict Naming Convention

**✅ CORRECT:** Each hook must have its own file named `useXXX.md`
- `useEffectQuery.md`
- `useRuntime.md`
- `useFiber.md`

**❌ INCORRECT:** Files that group multiple hooks together are **prohibited**
- `runtime-hooks.md` (violates convention)
- `concurrency-hooks.md` (violates convention)
- `stream-hooks.md` (violates convention)

**Exceptions:** Only `index.md`, `summary.md`, `README.md`, and proposal documents are allowed.

### Spec File Structure

Each `useXXX.md` file must include:
1. **Status** - ✅ Implemented or 📋 Proposed
2. **Overview** - Purpose and functionality
3. **Use Cases** - Specific usage scenarios
4. **API Design** - Complete TypeScript type definitions
5. **Usage Examples** - At least 2 working code examples
6. **Implementation Details** - Full implementation code
7. **Test Cases** - List of test scenarios
8. **Related Hooks** - Links to related hooks

Specs must be written at **implementation-ready granularity** with working code examples, not abstract descriptions.

See `specs/README.md` for complete documentation guidelines.

## Key Conventions

- Use `Effect.runPromise` or `Effect.runPromiseExit` to bridge Effect → Promise for React
- Always implement cancellation in `useEffect` cleanup to prevent memory leaks
- Maintain React state (`useState`) alongside Effect primitives for rendering
- Use `useCallback` for stable API method references
- Follow the naming pattern: hooks return objects with `value`, `loading`, and action methods

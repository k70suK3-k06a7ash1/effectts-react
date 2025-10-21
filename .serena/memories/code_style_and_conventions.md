# Code Style and Conventions

## TypeScript Configuration
- **Target**: ES2020
- **Module**: ESNext with bundler resolution
- **JSX**: react
- **Strict Mode**: Enabled (all strict flags on)
- **Additional Strictness**:
  - noUnusedLocals: true
  - noUnusedParameters: true
  - noImplicitReturns: true
  - noFallthroughCasesInSwitch: true

## Naming Conventions
- All hooks must follow `useXXX` naming pattern
- Hook files: `useXXX.ts` with corresponding `useXXX.test.ts`
- Spec files: `specs/useXXX.md` (one hook per file, strictly enforced)

## Hook Implementation Pattern
All hooks follow a consistent pattern:

1. **Initialization**: Create Effect-TS primitive (Ref, SynchronizedRef, etc.) in `useEffect`
2. **State Management**: Use React `useState` to expose current value and loading state
3. **Cancellation**: Implement cleanup with cancellation flags to prevent state updates after unmount
4. **API Methods**: Return `useCallback`-wrapped methods that interact with the Effect primitive

## Code Structure Template
```typescript
export function useXXX<A>(initialValue: A) {
  const [value, setValue] = useState<A | null>(null);
  const [loading, setLoading] = useState(true);
  const [ref, setRef] = useState<Ref.Ref<A> | null>(null);

  useReactEffect(() => {
    let cancelled = false;

    Effect.runPromise(/* ... */).then((r) => {
      if (cancelled) return;
      // ... set state
    });

    return () => { cancelled = true; };
  }, []);

  // ... useCallback methods
  
  return { value, loading, get, set, /* ... */ };
}
```

## Key Conventions
- Use `Effect.runPromise` or `Effect.runPromiseExit` to bridge Effect → Promise for React
- Always implement cancellation in `useEffect` cleanup to prevent memory leaks
- Maintain React state (`useState`) alongside Effect primitives for rendering
- Use `useCallback` for stable API method references
- Hooks return objects with `value`, `loading`, and action methods

## File Organization
- Entry point: `src/index.ts` (re-exports all hooks)
- Tests alongside source: `src/*.test.ts`
- Test setup: `src/test/setup.ts`
- Output: `dist/` (CJS, ESM, types)

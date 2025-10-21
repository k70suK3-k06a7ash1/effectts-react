# effectts-react

[![CI](https://github.com/k70suK3-k06a7ash1/effectts-react/actions/workflows/ci.yml/badge.svg)](https://github.com/k70suK3-k06a7ash1/effectts-react/actions/workflows/ci.yml)

React hooks for Effect-TS

## Installation

```bash
npm install effectts-react
# or
yarn add effectts-react
# or
pnpm add effectts-react
```

## Requirements

- React 18+
- Effect-TS 3+

## Usage

### useEffect

Run an Effect and get its result in your React component:

```typescript
import { useEffect } from 'effectts-react';
import * as Effect from 'effect/Effect';

function MyComponent() {
  const { data, error, loading } = useEffect(
    Effect.succeed('Hello, Effect!'),
    []
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  return <div>{data}</div>;
}
```

### useRuntime

Create a runtime for running Effects:

```typescript
import { useRuntime } from 'effectts-react';
import * as Effect from 'effect/Effect';

function MyComponent() {
  const runtime = useRuntime();

  const handleClick = () => {
    const effect = Effect.sync(() => console.log('Clicked!'));
    Effect.runPromise(effect);
  };

  return <button onClick={handleClick}>Click me</button>;
}
```

### usePoll

Run an Effect repeatedly at a specified interval:

```typescript
import { usePoll } from 'effectts-react';
import * as Effect from 'effect/Effect';

function MyComponent() {
  const { data, error, loading } = usePoll(
    Effect.sync(() => new Date().toISOString()),
    1000, // Run every 1 second
    []
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  return <div>Current time: {data}</div>;
}
```

## API

### `useEffect<A, E>(effect: Effect.Effect<A, E>, deps?: DependencyList)`

Runs an Effect and returns its result.

**Parameters:**
- `effect`: The Effect to run
- `deps`: Dependency array (like React's useEffect)

**Returns:**
```typescript
{
  data: A | null;
  error: E | null;
  loading: boolean;
}
```

### `useRuntime<R>(context?: Context.Context<R>)`

Creates a runtime for running Effects.

**Parameters:**
- `context`: Optional context to provide to the runtime

**Returns:** Runtime instance

### `usePoll<A, E>(effect: Effect.Effect<A, E>, intervalMs: number, deps?: DependencyList)`

Runs an Effect repeatedly at a specified interval.

**Parameters:**
- `effect`: The Effect to run
- `intervalMs`: Interval in milliseconds
- `deps`: Dependency array

**Returns:**
```typescript
{
  data: A | null;
  error: E | null;
  loading: boolean;
}
```

## License

MIT

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

### useEffectQuery

Run an Effect and get its result in your React component:

```typescript
import { useEffectQuery } from 'effectts-react';
import * as Effect from 'effect/Effect';

function MyComponent() {
  const { data, error, loading } = useEffectQuery(
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

### useRef

Manage mutable state with Effect Ref for safe concurrent access:

```typescript
import { useRef } from 'effectts-react';

function Counter() {
  const { value, loading, set, update } = useRef(0);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <p>Count: {value}</p>
      <button onClick={() => update(n => n + 1)}>Increment</button>
      <button onClick={() => update(n => n - 1)}>Decrement</button>
      <button onClick={() => set(0)}>Reset</button>
    </div>
  );
}
```

### useSynchronizedRef

Perform atomic, effectful state updates with SynchronizedRef:

```typescript
import { useSynchronizedRef } from 'effectts-react';
import * as Effect from 'effect/Effect';

function UserList() {
  const { value, loading, updateEffect } = useSynchronizedRef<string[]>([]);

  const fetchAndAddUser = async () => {
    await updateEffect(users =>
      Effect.gen(function* () {
        // Simulate fetching user data
        const response = yield* Effect.promise(() =>
          fetch('/api/user').then(r => r.json())
        );
        return [...users, response.name];
      })
    );
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <button onClick={fetchAndAddUser}>Add User</button>
      <ul>
        {value?.map((user, i) => <li key={i}>{user}</li>)}
      </ul>
    </div>
  );
}
```

### useSubscriptionRef

Reactive state management with automatic change notifications:

```typescript
import { useSubscriptionRef } from 'effectts-react';

function ReactiveCounter() {
  const { value, loading, update } = useSubscriptionRef(0);

  // Value automatically updates when the ref changes
  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <p>Count: {value}</p>
      <button onClick={() => update(n => n + 1)}>Increment</button>
    </div>
  );
}
```

## API

### `useEffectQuery<A, E>(effect: Effect.Effect<A, E>, deps?: DependencyList)`

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

### `useRef<A>(initialValue: A)`

Creates a mutable reference with Effect Ref for safe concurrent state management.

**Parameters:**
- `initialValue`: The initial value for the Ref

**Returns:**
```typescript
{
  value: A | null;
  loading: boolean;
  get: () => Promise<A>;
  set: (value: A) => Promise<void>;
  update: (f: (a: A) => A) => Promise<void>;
  modify: <B>(f: (a: A) => readonly [B, A]) => Promise<B>;
}
```

### `useSynchronizedRef<A>(initialValue: A)`

Creates a SynchronizedRef for atomic, effectful state updates.

**Parameters:**
- `initialValue`: The initial value for the SynchronizedRef

**Returns:**
```typescript
{
  value: A | null;
  loading: boolean;
  get: () => Promise<A>;
  set: (value: A) => Promise<void>;
  update: (f: (a: A) => A) => Promise<void>;
  updateEffect: <R, E>(f: (a: A) => Effect.Effect<A, E, R>) => Promise<void>;
  modify: <B>(f: (a: A) => readonly [B, A]) => Promise<B>;
}
```

### `useSubscriptionRef<A>(initialValue: A)`

Creates a SubscriptionRef with automatic change notifications via reactive streams.

**Parameters:**
- `initialValue`: The initial value for the SubscriptionRef

**Returns:**
```typescript
{
  value: A | null;
  loading: boolean;
  get: () => Promise<A>;
  set: (value: A) => Promise<void>;
  update: (f: (a: A) => A) => Promise<void>;
  updateEffect: <R, E>(f: (a: A) => Effect.Effect<A, E, R>) => Promise<void>;
  modify: <B>(f: (a: A) => readonly [B, A]) => Promise<B>;
}
```

## License

MIT

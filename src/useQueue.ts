import { useEffect, useState, useCallback } from 'react';
import * as Effect from 'effect/Effect';
import * as Queue from 'effect/Queue';

export function useQueue<A>(
  capacity: number = 100
): {
  queue: Queue.Queue<A> | null;
  offer: (_value: A) => Promise<boolean>;
  take: () => Promise<A>;
  size: number;
  isEmpty: boolean;
  isFull: boolean;
} {
  const [queue, setQueue] = useState<Queue.Queue<A> | null>(null);
  const [size, setSize] = useState(0);

  useEffect(() => {
    const effect = Queue.bounded<A>(capacity);

    Effect.runPromise(effect).then((q) => {
      setQueue(q);
    });
  }, [capacity]);

  const offer = useCallback(
    async (_value: A): Promise<boolean> => {
      if (!queue) return false;
      const result = await Effect.runPromise(Queue.offer(queue, _value));
      if (result) {
        setSize((prev) => prev + 1);
      }
      return result;
    },
    [queue]
  );

  const take = useCallback(async (): Promise<A> => {
    if (!queue) throw new Error('Queue not initialized');
    const value = await Effect.runPromise(Queue.take(queue));
    setSize((prev) => Math.max(0, prev - 1));
    return value;
  }, [queue]);

  return {
    queue,
    offer,
    take,
    size,
    isEmpty: size === 0,
    isFull: size >= capacity,
  };
}

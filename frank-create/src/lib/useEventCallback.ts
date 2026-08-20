import { useEffect, useRef } from "react";

/**
 * A callback whose identity never changes but whose body is always the latest one.
 *
 * The studio timeline is memoised, and `React.memo` is defeated by a prop that is
 * a fresh arrow function on every render. Threading every piece of studio state
 * through `useCallback` dependency arrays would work too, but it puts the burden
 * on each call site to stay correct; this keeps it in one place.
 *
 * Only for event handlers. Never call the returned function during render — the
 * body it points at is updated after commit.
 */
export function useEventCallback<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const latest = useRef(fn);
  useEffect(() => {
    latest.current = fn;
  });
  const stable = useRef<((...args: A) => R) | null>(null);
  if (stable.current === null) {
    stable.current = (...args: A) => latest.current(...args);
  }
  return stable.current;
}

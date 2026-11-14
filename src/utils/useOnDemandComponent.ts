import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Loads a component graph on the first call to `load`, so a screen can paint
 * before voice, manual entry, or the scoring engine is evaluated.
 *
 * `load` stays referentially stable. The latest loader is stored in an effect
 * so screens can pass an inline import without retriggering their own effects.
 */
export function useOnDemandComponent<T>(loader: () => Promise<T>): [T | null, () => void] {
  const [Component, setComponent] = useState<T | null>(null);
  const loaderRef = useRef(loader);
  const startedRef = useRef(false);

  useEffect(() => {
    loaderRef.current = loader;
  }, [loader]);

  const load = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    loaderRef.current()
      .then((loaded) => {
        setComponent(() => loaded);
      })
      .catch(() => {
        startedRef.current = false;
      });
  }, []);

  return [Component, load];
}

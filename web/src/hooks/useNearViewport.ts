import { type RefObject, useEffect, useState } from 'react';

const AHEAD = '1200px';

export function useNearViewport(of: RefObject<Element | null>): boolean {
  const [near, setNear] = useState(false);

  useEffect(() => {
    const element = of.current;

    if (near || !element || typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }

    const watching = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          watching.disconnect();
        }
      },
      { rootMargin: AHEAD },
    );

    watching.observe(element);

    return () => watching.disconnect();
  }, [of, near]);

  return near;
}

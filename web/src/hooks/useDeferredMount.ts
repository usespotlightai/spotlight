import { startTransition, useEffect, useState } from 'react';

export function useDeferredMount(defer: boolean): boolean {
  const [shown, setShown] = useState(!defer);

  useEffect(() => {
    if (!shown) {
      startTransition(() => setShown(true));
    }
  }, [shown]);

  return shown;
}

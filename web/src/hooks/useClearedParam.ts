import { useEffect } from 'react';
import { useSearchParams } from 'react-router';

import { nonEmpty } from '@/lib/non-empty';

export function useClearedParam(name: string): void {
  const [params, setParams] = useSearchParams();
  const value = params.get(name);

  useEffect(() => {
    if (!nonEmpty(value)) {
      return;
    }

    setParams(
      (current) => {
        current.delete(name);
        return current;
      },
      { replace: true },
    );
  }, [value, name, setParams]);
}

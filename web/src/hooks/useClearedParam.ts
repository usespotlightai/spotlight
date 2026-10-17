import { useEffect } from 'react';
import { useSearchParams } from 'react-router';

export function useClearedParam(name: string) {
  const [params, setParams] = useSearchParams();
  const value = params.get(name);

  useEffect(() => {
    if (!value) {
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

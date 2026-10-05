import { useEffect } from 'react';
import { useSearchParams } from 'react-router';

export function useClearedParam(name: string) {
  const [params, setParams] = useSearchParams();
  const held = params.get(name);

  useEffect(() => {
    if (!held) {
      return;
    }

    setParams(
      (kept) => {
        kept.delete(name);
        return kept;
      },
      { replace: true },
    );
  }, [held, name, setParams]);
}

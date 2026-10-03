import { useState } from 'react';
import { useLocation } from 'react-router';

export function useLastPlace(tracking: boolean): string | null {
  const location = useLocation();
  const here = `${location.pathname}${location.search}`;
  const [last, setLast] = useState<string | null>(null);

  if (tracking && last !== here) {
    setLast(here);
  }

  return last;
}

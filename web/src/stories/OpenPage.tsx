import { useQueryClient } from '@tanstack/react-query';
import { useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { scenario, setOpenPage } from '@/mocks/scenario';
import { ownedByPage } from '@/mocks/shell';
import { movedTo } from '@/stories/visit';

export function OpenPage() {
  const { pathname, search, hash } = useLocation();
  const client = useQueryClient();
  const here = `${pathname}${search}${hash}`;
  const was = useRef({ pathname, here });

  setOpenPage(pathname);

  useLayoutEffect(() => {
    if (was.current.here === here) {
      return;
    }
    const anotherPage = was.current.pathname !== pathname;
    was.current = { pathname, here };
    movedTo(here);

    const { state } = scenario();
    if (anotherPage && (state === 'loading' || state === 'error')) {
      void client.resetQueries({
        predicate: (query) => ownedByPage(query.queryKey, pathname),
      });
    }
  }, [here, pathname, client]);

  return null;
}

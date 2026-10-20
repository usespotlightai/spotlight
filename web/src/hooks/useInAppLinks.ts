import { type RefObject, useEffect } from 'react';
import { useNavigate } from 'react-router';

export function useInAppLinks(within: RefObject<HTMLElement | null>) {
  const navigate = useNavigate();

  useEffect(() => {
    const element = within.current;

    if (!element) {
      return;
    }

    const following = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement).closest('a');
      const href = anchor?.getAttribute('href');

      if (!href?.startsWith('/') || event.metaKey || event.ctrlKey) {
        return;
      }

      event.preventDefault();
      void navigate(href);
    };

    element.addEventListener('click', following);

    return () => element.removeEventListener('click', following);
  }, [navigate, within]);
}

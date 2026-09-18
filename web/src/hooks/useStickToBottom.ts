import { useEffect, useRef } from 'react';

const NEAR = 80;

export function useStickToBottom<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    const content = el?.firstElementChild;
    if (!el || !content) {
      return;
    }

    let following = true;

    const near = () => el.scrollHeight - el.scrollTop - el.clientHeight < NEAR;

    const onScroll = () => {
      following = near();
    };

    const grew = new ResizeObserver(() => {
      if (following) {
        el.scrollTop = el.scrollHeight;
      }
    });
    grew.observe(content);

    el.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      grew.disconnect();
      el.removeEventListener('scroll', onScroll);
    };
  }, []);

  return ref;
}

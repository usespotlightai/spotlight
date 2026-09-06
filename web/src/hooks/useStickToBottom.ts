import { useEffect, useRef } from 'react';

/** Within this far of the foot, the reader is taken to be following the tail. */
const NEAR = 80;

/**
 * Keeps a scroll container pinned to its foot as its content grows — so a run
 * streaming steps keeps the newest in view — unless the reader has scrolled up,
 * in which case it leaves them where they are until they return to the bottom.
 *
 * Returns a ref for the scroll container; its first child is watched for
 * growth, so the container itself may keep a fixed height.
 */
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

    // Only the reader's own scroll gives up the tail, and only returning to the
    // foot takes it back.
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

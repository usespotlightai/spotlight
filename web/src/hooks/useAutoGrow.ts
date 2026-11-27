import { type RefObject, useEffect, useLayoutEffect } from 'react';

const fitToContent = (textarea: HTMLTextAreaElement) => {
  textarea.style.height = 'auto';

  const full = textarea.scrollHeight;

  if (full === 0) {
    textarea.style.height = '';
    return;
  }

  textarea.style.height = `${full}px`;
  textarea.style.overflowY =
    full - textarea.clientHeight > 1 ? 'auto' : 'hidden';
};

export function useAutoGrow(
  textarea: RefObject<HTMLTextAreaElement | null>,
  value: string,
): void {
  useLayoutEffect(() => {
    if (textarea.current) {
      fitToContent(textarea.current);
    }
  }, [textarea, value]);

  useEffect(() => {
    const element = textarea.current;
    if (!element) {
      return;
    }

    let width = element.clientWidth;

    const resized = new ResizeObserver(() => {
      if (
        element.clientWidth !== width ||
        element.scrollHeight > element.clientHeight
      ) {
        width = element.clientWidth;
        fitToContent(element);
      }
    });
    resized.observe(element);

    return () => resized.disconnect();
  }, [textarea]);
}

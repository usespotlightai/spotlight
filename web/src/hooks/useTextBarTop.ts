import { type RefObject, useLayoutEffect, useState } from 'react';

export function useTextBarTop(
  footer: RefObject<HTMLDivElement | null>,
  floating: boolean,
): number {
  const [textBarTop, setTextBarTop] = useState(0);

  useLayoutEffect(() => {
    const element = footer.current;

    if (!floating || !element) {
      return;
    }

    const measure = () => {
      const form = element.querySelector('[data-slot=chat-input-form]');
      setTextBarTop(
        form
          ? form.getBoundingClientRect().top -
              element.getBoundingClientRect().top
          : 0,
      );
    };
    const resized = new ResizeObserver(measure);
    resized.observe(element);
    measure();

    return () => resized.disconnect();
  }, [footer, floating]);

  return textBarTop;
}

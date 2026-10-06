import { type MouseEvent, useState } from 'react';

const DOT = '.recharts-scatter-symbol';

export function useDotHover() {
  const [onDot, setOnDot] = useState(false);

  return {
    area: {
      onMouseMove: (event: MouseEvent<HTMLElement>) =>
        setOnDot(
          event.target instanceof Element && event.target.closest(DOT) !== null,
        ),
      onMouseLeave: () => setOnDot(false),
    },
    tooltip: { active: onDot ? undefined : (false as const) },
  };
}

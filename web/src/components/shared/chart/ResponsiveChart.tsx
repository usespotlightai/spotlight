import { type ReactElement, useRef } from 'react';
import { ResponsiveContainer } from 'recharts';

import { useElementWidth } from '@/hooks/useElementWidth';

type ResponsiveChartProps = {
  height: number;
  children: ReactElement;
};

export function ResponsiveChart({ height, children }: ResponsiveChartProps) {
  const frame = useRef<HTMLDivElement>(null);
  const width = useElementWidth(frame);

  return (
    <div
      ref={frame}
      data-slot="responsive-chart"
      className="w-full overflow-x-clip contain-inline-size"
      style={{ height }}
    >
      {width > 0 && (
        <ResponsiveContainer width={width} height={height}>
          {children}
        </ResponsiveContainer>
      )}
    </div>
  );
}

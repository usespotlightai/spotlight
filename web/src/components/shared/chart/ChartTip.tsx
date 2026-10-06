import type { CSSProperties, ReactNode } from 'react';
import type { TipPlacement } from '@/hooks/useCursorTooltip';
import { cn } from '@/lib/utils';

type ChartTipProps = {
  placement?: TipPlacement;
  style?: CSSProperties;
  children: ReactNode;
};

export function ChartTip({ placement, style, children }: ChartTipProps) {
  return (
    <div
      style={style}
      className={cn(
        'whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-overlay',
        placement?.left && '-translate-x-full',
        placement?.above && '-translate-y-full',
      )}
    >
      {children}
    </div>
  );
}

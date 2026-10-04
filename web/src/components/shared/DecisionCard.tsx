import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type DecisionCardProps = HTMLAttributes<HTMLElement> & {
  as?: 'section' | 'li';
};

export function DecisionCard({
  as: Card = 'section',
  className,
  ...props
}: DecisionCardProps) {
  return (
    <Card
      className={cn(
        'flex flex-col gap-3 rounded-xl border-[0.5px] border-border bg-card px-3 pt-2 pb-3 shadow-pane',
        className,
      )}
      {...props}
    />
  );
}

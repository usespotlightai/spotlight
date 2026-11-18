import type { HTMLAttributes, Ref } from 'react';

import { cn } from '@/lib/utils';

type DecisionCardProps = HTMLAttributes<HTMLElement> & {
  as?: 'section' | 'li';
  ref?: Ref<HTMLElement>;
};

export function DecisionCard({
  as: Card = 'section',
  className,
  ref,
  ...props
}: DecisionCardProps) {
  return (
    <Card
      ref={ref as Ref<HTMLLIElement & HTMLElement>}
      data-decision
      tabIndex={-1}
      className={cn(
        'flex flex-col gap-3 outline-none rounded-xl border-[0.5px] border-border bg-card px-3 pt-2 pb-3 shadow-pane',
        className,
      )}
      {...props}
    />
  );
}

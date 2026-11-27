import { type HTMLAttributes, type Ref, use } from 'react';

import { DockedContext } from '@/lib/decision-tray';
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
  const docked = use(DockedContext) !== null;

  return (
    <Card
      ref={(node: HTMLElement | null) => {
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      }}
      data-decision
      tabIndex={-1}
      className={cn(
        'flex flex-col gap-3 outline-none',
        !docked &&
          'rounded-xl border-[0.5px] border-border bg-card px-3 pt-2 pb-3 shadow-pane',
        className,
        docked && 'm-0 p-0',
      )}
      {...props}
    />
  );
}

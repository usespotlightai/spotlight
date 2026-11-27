import type { ReactNode, ReactElement } from 'react';

import { cn } from '@/lib/utils';

type DecisionHeaderProps = {
  title: ReactNode;
  trailing?: ReactNode;
  className?: string;
};

export function DecisionHeader({
  title,
  trailing,
  className,
}: DecisionHeaderProps): ReactElement {
  return (
    <div
      className={cn(
        'mb-1.5 flex min-h-6 items-center justify-between gap-2',
        className,
      )}
    >
      {title}
      {trailing}
    </div>
  );
}

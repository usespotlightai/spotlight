import type { ReactNode, ReactElement } from 'react';

import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { nonEmpty } from '@/lib/non-empty';
import { cn } from '@/lib/utils';

type SkeletonBlockProps = {
  label?: string;
  className?: string;
  children: ReactNode;
};

export function SkeletonBlock({
  label,
  className,
  children,
}: SkeletonBlockProps): ReactElement {
  const classes = cn('relative flex min-w-0 flex-col', className);
  const block = (
    <>
      <Skeleton className="absolute inset-0 rounded-lg" />
      <div aria-hidden className="invisible flex flex-1 flex-col">
        {children}
      </div>
    </>
  );

  return nonEmpty(label) ? (
    <div role="status" aria-label={label} className={classes}>
      {block}
    </div>
  ) : (
    <div className={classes}>{block}</div>
  );
}

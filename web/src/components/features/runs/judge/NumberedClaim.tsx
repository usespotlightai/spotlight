import type { ReactElement, ReactNode } from 'react';

import { formatClaim } from '@/lib/judge';
import { cn } from '@/lib/utils';

type NumberedClaimProps = {
  index: number;
  id?: string;
  className?: string;
  children?: ReactNode;
};

export function NumberedClaim({
  index,
  id,
  className,
  children,
}: NumberedClaimProps): ReactElement {
  return (
    <span
      id={id}
      data-slot="numbered-claim"
      className={cn('min-w-0 break-words', className)}
    >
      {children === null || children === undefined ? (
        formatClaim(index)
      ) : (
        <>
          <span aria-hidden className="text-muted-foreground tabular-nums">
            {index + 1}.{' '}
          </span>
          {children}
        </>
      )}
    </span>
  );
}

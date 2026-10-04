import type { ComponentProps } from 'react';
import { PillButton } from '@/components/shared/PillButton';
import { cn } from '@/lib/utils';

export function DecisionPill({
  className,
  ...props
}: ComponentProps<typeof PillButton>) {
  return (
    <PillButton className={cn('min-w-18 shadow-xs', className)} {...props} />
  );
}

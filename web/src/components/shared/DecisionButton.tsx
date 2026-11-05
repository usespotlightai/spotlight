import type { ComponentProps } from 'react';
import { PillButton } from '@/components/shared/PillButton';
import { cn } from '@/lib/utils';

export function DecisionButton({
  className,
  ...props
}: ComponentProps<typeof PillButton>) {
  return (
    <PillButton
      className={cn(
        'h-7 min-w-18 rounded-md px-3 text-sm shadow-xs',
        className,
      )}
      {...props}
    />
  );
}

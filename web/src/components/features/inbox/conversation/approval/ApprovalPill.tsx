import type { ComponentProps } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ApprovalPill({
  className,
  variant = 'outline',
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      size="xs"
      variant={variant}
      className={cn('min-w-18 rounded-full px-2.5 shadow-xs', className)}
      {...props}
    />
  );
}

import type { ComponentProps } from 'react';
import { AutoGrowTextarea } from '@/components/shared/form/AutoGrowTextarea';
import { cn } from '@/lib/utils';

export function InPlaceTextarea({
  className,
  ...props
}: ComponentProps<typeof AutoGrowTextarea>) {
  return (
    <AutoGrowTextarea
      className={cn(
        '-mx-1.5 -my-0.5 rounded-md px-1.5 py-0.5 text-foreground text-sm leading-6 transition-colors hover:bg-accent focus-visible:bg-accent',
        className,
      )}
      {...props}
    />
  );
}

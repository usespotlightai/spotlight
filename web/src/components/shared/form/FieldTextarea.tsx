import type { ComponentProps, ReactElement } from 'react';

import { AutoGrowTextarea } from '@/components/shared/form/AutoGrowTextarea';
import { cn } from '@/lib/utils';

export function FieldTextarea({
  className,
  ...props
}: ComponentProps<typeof AutoGrowTextarea>): ReactElement {
  return (
    <AutoGrowTextarea
      className={cn(
        'max-h-48 min-h-16 rounded-md border-[0.5px] border-border bg-background px-2.5 py-1.5 text-foreground text-sm leading-5 focus-visible:border-input',
        className,
      )}
      {...props}
    />
  );
}

import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function FieldInput({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      {...props}
      className={cn(
        'h-8 w-full rounded-md border-[0.5px] border-border bg-background px-2.5 text-foreground text-sm outline-none placeholder:text-muted-foreground focus-visible:border-input',
        className,
      )}
    />
  );
}

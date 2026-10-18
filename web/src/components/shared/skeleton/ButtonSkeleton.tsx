import type { ReactNode } from 'react';
import { buttonVariants } from '@/components/ui/button-variants';
import { cn } from '@/lib/utils';

export function ButtonSkeleton({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      className={cn(
        buttonVariants({ size: 'sm', variant: 'outline' }),
        'pointer-events-none rounded-full bg-card shadow-none',
      )}
    >
      {children}
    </span>
  );
}

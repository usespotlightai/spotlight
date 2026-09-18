import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

type SkeletonProps = {
  className?: string;
  style?: CSSProperties;
};

export function Skeleton({ className, style }: SkeletonProps) {
  return (
    <span
      aria-hidden
      data-slot="skeleton"
      style={style}
      className={cn(
        'block shrink-0 animate-pulse rounded-sm bg-muted-foreground/10 motion-reduce:animate-none',
        className,
      )}
    />
  );
}

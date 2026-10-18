import { buttonVariants } from '@/components/ui/button-variants';
import { cn } from '@/lib/utils';

export type PillVariant = 'default' | 'outline' | 'ghost';

export type PillSize = 'small' | 'regular';

export const pillClass = (
  variant: PillVariant,
  className?: string,
  size: PillSize = 'small',
): string =>
  cn(
    buttonVariants({ size: 'sm', variant }),
    'rounded-full shadow-none',
    size === 'small' && 'h-6 px-2.5 text-xs',
    variant === 'outline' && 'bg-card text-foreground',
    className,
  );

export const COMPACT_PILL = 'gap-1 py-0 pr-1.5 pl-1.5 text-[0.7rem]';

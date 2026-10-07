import { buttonVariants } from '@/components/ui/button-variants';
import { cn } from '@/lib/utils';

export type PillVariant = 'default' | 'outline';

export const pillClass = (variant: PillVariant, className?: string): string =>
  cn(
    buttonVariants({ size: 'sm', variant }),
    'h-6 rounded-full px-2.5 text-xs shadow-none',
    variant === 'outline' && 'bg-card text-foreground',
    className,
  );

export const COMPACT_PILL = 'gap-1 py-0 pr-1.5 pl-1.5 text-[0.7rem]';

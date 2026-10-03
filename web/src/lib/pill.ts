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

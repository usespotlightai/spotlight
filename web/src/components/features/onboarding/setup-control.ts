import { buttonVariants } from '@/components/ui/button-variants';
import { cn } from '@/lib/utils';

export const SETUP_CONTROL = 'rounded-full px-3.5 shadow-none';

export const setupLinkClass = cn(
  buttonVariants({ variant: 'outline', size: 'sm' }),
  SETUP_CONTROL,
  'bg-card',
);

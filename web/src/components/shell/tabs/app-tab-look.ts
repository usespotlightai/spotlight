import { cn } from '@/lib/utils';

export const TAB_SLIDE = {
  duration: 200,
  easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
};

export const tabFrame = (active: boolean) =>
  cn(
    'group/tab relative flex h-7 w-56 min-w-0 shrink items-center rounded-md text-sm transition-colors',
    active
      ? 'bg-card text-foreground shadow-control'
      : 'bg-card/50 text-muted-foreground hover:bg-card/80 hover:text-foreground',
  );

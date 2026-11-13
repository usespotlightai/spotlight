import { SPRING, SPRING_EASE } from '@/lib/motion';
import { cn } from '@/lib/utils';

export function SidebarWindowChrome({ floating }: { floating: boolean }) {
  return (
    <>
      <div
        aria-hidden
        data-slot="sidebar-surface"
        className={cn(
          'pointer-events-none absolute inset-0 -z-10 bg-background',
          floating
            ? 'opacity-100'
            : cn(
                'opacity-0 transition-opacity delay-[calc(var(--spring-duration)*0.3)] duration-[calc(var(--spring-duration)*0.7)]',
                SPRING_EASE,
              ),
        )}
      />
      <div
        data-slot="window-buttons"
        className={cn(
          'shrink-0',
          floating ? 'h-0' : cn('h-7 transition-[height]', SPRING),
        )}
      />
    </>
  );
}

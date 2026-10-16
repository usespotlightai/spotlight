import type { ReactNode } from 'react';
import type { SlideFrom } from '@/hooks/useSlideFrom';
import { cn } from '@/lib/utils';

type SidebarSlideProps = {
  from: SlideFrom | null;
  children: ReactNode;
};

export function SidebarSlide({ from, children }: SidebarSlideProps) {
  return (
    <div className="-mx-3 flex min-h-0 flex-1 flex-col overflow-hidden px-3">
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col',
          from &&
            'fade-in-0 animate-in duration-200 ease-out motion-reduce:animate-none',
          from === 'left' && 'slide-in-from-left',
          from === 'right' && 'slide-in-from-right',
        )}
      >
        {children}
      </div>
    </div>
  );
}

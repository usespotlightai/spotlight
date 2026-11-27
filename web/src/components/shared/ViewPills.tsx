import { useRef } from 'react';

import { Button } from '@/components/ui/button';
import { useTabStrip } from '@/hooks/useTabStrip';
import { cn } from '@/lib/utils';

type View<T extends string> = {
  readonly id: T;
  readonly label: string;
};

type ViewPillsProps<T extends string> = {
  views: readonly View<T>[];
  current: T;
  onChange: (view: T) => void;
  className?: string;
};

export function ViewPills<T extends string>({
  views,
  current,
  onChange,
  className,
}: ViewPillsProps<T>) {
  const strip = useRef<HTMLDivElement>(null);
  const fade = useTabStrip(strip, current);

  return (
    <div
      ref={strip}
      style={fade}
      className={cn(
        'flex h-10 min-w-0 shrink-0 scroll-px-6 items-center gap-1 overflow-x-auto overflow-y-hidden px-3 [scrollbar-width:none]',
        className,
      )}
    >
      {views.map((view) => (
        <Button
          key={view.id}
          variant="outline"
          size="sm"
          onClick={() => onChange(view.id)}
          aria-current={view.id === current ? 'page' : undefined}
          className={cn(
            'shrink-0 rounded-full bg-card shadow-xs',
            view.id === current && 'bg-muted',
          )}
        >
          {view.label}
        </Button>
      ))}
    </div>
  );
}

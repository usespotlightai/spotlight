import type { LucideIcon } from 'lucide-react';
import { useRef } from 'react';

import { useTabIndicator } from '@/hooks/useTabIndicator';
import { cn } from '@/lib/utils';

type Segment<T extends string> = {
  readonly id: T;
  readonly label: string;
  readonly icon?: LucideIcon;
};

type SegmentedProps<T extends string> = {
  label: string;
  segments: readonly Segment<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function Segmented<T extends string>({
  label,
  segments,
  value,
  onChange,
}: SegmentedProps<T>) {
  const group = useRef<HTMLFieldSetElement>(null);
  const indicator = useTabIndicator(group, value);

  return (
    <fieldset
      ref={group}
      aria-label={label}
      className="relative m-0 flex h-7 min-w-0 items-center rounded-lg border-0 bg-muted p-0.5 dark:bg-background"
    >
      {indicator && (
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-y-0.5 left-0 rounded-md bg-card shadow-xs ring-1 ring-foreground/[0.06] dark:bg-accent dark:ring-foreground/10',
            indicator.ready &&
              'transition-[transform,width] duration-200 ease-out motion-reduce:transition-none',
          )}
          style={{
            width: indicator.width,
            transform: `translateX(${indicator.left}px)`,
          }}
        />
      )}

      {segments.map((segment) => {
        const Icon = segment.icon;

        return (
          <button
            key={segment.id}
            type="button"
            data-tab={segment.id}
            aria-pressed={segment.id === value}
            onClick={() => onChange(segment.id)}
            className={cn(
              'relative flex h-full items-center gap-1.5 rounded-md px-2.5 text-muted-foreground text-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50',
              segment.id === value && 'text-foreground',
            )}
          >
            {Icon && <Icon aria-hidden className="size-3.5" />}
            {segment.label}
          </button>
        );
      })}
    </fieldset>
  );
}

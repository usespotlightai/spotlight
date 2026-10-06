import { useRef } from 'react';
import { useTabIndicator } from '@/hooks/useTabIndicator';
import { cn } from '@/lib/utils';

const PILL_REACH = 2;

type Segment<T extends string> = {
  readonly id: T;
  readonly label: string;
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
      className="relative m-0 flex h-6 min-w-0 items-center rounded-md border border-border bg-background p-0.5"
    >
      {indicator && (
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-y-0 left-0 rounded-[5px] border border-border bg-card shadow-control',
            indicator.settled &&
              'transition-[transform,width] duration-200 ease-out motion-reduce:transition-none',
          )}
          style={{
            width: indicator.width + PILL_REACH * 2,
            transform: `translateX(${indicator.left - PILL_REACH}px)`,
          }}
        />
      )}

      {segments.map((segment) => (
        <button
          key={segment.id}
          type="button"
          data-tab={segment.id}
          aria-pressed={segment.id === value}
          onClick={() => onChange(segment.id)}
          className={cn(
            'relative h-full rounded-sm px-1.5 text-[0.7rem] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50',
            segment.id === value && 'text-foreground',
          )}
        >
          {segment.label}
        </button>
      ))}
    </fieldset>
  );
}

import type { LucideIcon } from 'lucide-react';
import { useRef } from 'react';
import { Noted } from '@/components/shared/Noted';
import { useTabIndicator } from '@/hooks/useTabIndicator';
import { cn } from '@/lib/utils';

const PILL_REACH = 2;

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
  const iconic = segments.every((segment) => segment.icon);

  return (
    <fieldset
      ref={group}
      aria-label={label}
      className={cn(
        'relative m-0 flex min-w-0 items-center rounded-md border border-border bg-background p-0.5',
        iconic ? 'h-5' : 'h-6',
      )}
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

      {segments.map((segment) => {
        const Icon = segment.icon;
        const button = (
          <button
            key={segment.id}
            type="button"
            data-tab={segment.id}
            aria-label={Icon ? segment.label : undefined}
            aria-pressed={segment.id === value}
            onClick={() => onChange(segment.id)}
            className={cn(
              'relative flex h-full items-center rounded-sm text-[0.7rem] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50',
              Icon ? 'px-0.5' : 'px-1.5',
              segment.id === value && 'text-foreground',
            )}
          >
            {Icon ? <Icon aria-hidden className="size-3" /> : segment.label}
          </button>
        );

        return Icon ? (
          <Noted key={segment.id} note={segment.label}>
            {button}
          </Noted>
        ) : (
          button
        );
      })}
    </fieldset>
  );
}

import { TriangleAlert } from 'lucide-react';
import type { ComponentProps } from 'react';
import { WithTooltip } from '@/components/shared/WithTooltip';
import type { TooltipText } from '@/lib/tooltip-note';
import { cn } from '@/lib/utils';

const TONES = {
  destructive: 'text-destructive',
  warning: 'text-amber-600 dark:text-amber-400',
  muted: 'text-muted-foreground',
} as const;

type WarningTooltipProps = Omit<
  ComponentProps<'span'>,
  'role' | 'aria-label' | 'children'
> & {
  tooltip: TooltipText;
  label: string;
  tone: keyof typeof TONES;
};

export function WarningTooltip({
  tooltip,
  label,
  tone,
  className,
  ...marks
}: WarningTooltipProps) {
  return (
    <WithTooltip tooltip={tooltip} named={label}>
      <span
        {...marks}
        role="img"
        aria-label={label}
        className={cn('inline-flex shrink-0', className)}
      >
        <TriangleAlert aria-hidden className={cn('size-3.5', TONES[tone])} />
      </span>
    </WithTooltip>
  );
}

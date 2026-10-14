import { TriangleAlert } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Noted } from '@/components/shared/Noted';
import { cn } from '@/lib/utils';

const TONES = {
  destructive: 'text-destructive',
  warning: 'text-amber-600 dark:text-amber-400',
  muted: 'text-muted-foreground',
} as const;

type NotedWarningProps = Omit<
  ComponentProps<'span'>,
  'role' | 'aria-label' | 'children'
> & {
  note: string;
  label: string;
  tone: keyof typeof TONES;
};

export function NotedWarning({
  note,
  label,
  tone,
  className,
  ...marks
}: NotedWarningProps) {
  return (
    <Noted note={note}>
      <span
        {...marks}
        role="img"
        aria-label={label}
        className={cn('inline-flex shrink-0', className)}
      >
        <TriangleAlert aria-hidden className={cn('size-3.5', TONES[tone])} />
      </span>
    </Noted>
  );
}

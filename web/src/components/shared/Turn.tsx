import type { ReactNode, Ref } from 'react';
import { DisclosureToggle } from '@/components/shared/DisclosureToggle';
import { SKIPPED_OFF_SCREEN } from '@/lib/turns';
import { cn } from '@/lib/utils';

export type TurnSummary = {
  readonly icon?: ReactNode;
  readonly lead?: string;
  readonly text: string;
  readonly count?: string;
};

type TurnProps = {
  head: ReactNode;
  summary: TurnSummary | null;
  open: boolean;
  onToggle: () => void;
  className?: string;
  ref?: Ref<HTMLElement>;
  children: ReactNode;
};

export function Turn({
  head,
  summary,
  open,
  onToggle,
  className,
  ref,
  children,
}: TurnProps) {
  return (
    <section
      ref={ref}
      className={cn(SKIPPED_OFF_SCREEN, 'flex flex-col', className)}
    >
      {head}

      {summary && (
        <DisclosureToggle
          open={open}
          onToggle={onToggle}
          className={cn('max-w-full', head ? 'mt-4' : 'mt-1')}
        >
          {summary.icon}
          {summary.lead && (
            <span className="shrink-0 text-foreground">{summary.lead}</span>
          )}
          <span className="min-w-0 truncate">{summary.text}</span>
          {summary.count && (
            <span className="shrink-0 tabular-nums">{summary.count}</span>
          )}
        </DisclosureToggle>
      )}

      {(open || !summary) && children}
    </section>
  );
}

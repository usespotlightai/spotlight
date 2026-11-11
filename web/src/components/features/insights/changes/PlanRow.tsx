import type { ReactNode } from 'react';

import type { PlanMark } from '@/lib/config-plan';
import { cn } from '@/lib/utils';

const SIGNS: Record<PlanMark, string> = {
  added: '+',
  removed: '-',
  changed: '~',
};

const TONES: Record<PlanMark, string> = {
  added: 'text-outcome-done',
  removed: 'text-outcome-failed',
  changed: 'text-muted-foreground',
};

const BACKGROUNDS: Record<PlanMark, string | null> = {
  added: 'bg-outcome-done/8',
  removed: 'bg-outcome-failed/8',
  changed: null,
};

type PlanRowProps = {
  mark?: PlanMark | null;
  depth?: number;
  toned?: boolean;
  children: ReactNode;
};

export function PlanRow({
  mark = null,
  depth = 0,
  toned = false,
  children,
}: PlanRowProps) {
  return (
    <li
      data-slot="plan-row"
      data-mark={mark ?? undefined}
      className={cn(
        'grid grid-cols-[2ch_minmax(0,1fr)]',
        mark && BACKGROUNDS[mark],
      )}
      style={{ paddingLeft: `${depth * 4}ch` }}
    >
      <span className={cn('select-none', mark && TONES[mark])}>
        {mark && (
          <>
            <span aria-hidden>{SIGNS[mark]}</span>
            <span className="sr-only">{mark}</span>
          </>
        )}
      </span>
      <span
        className={cn(
          'wrap-anywhere whitespace-pre-wrap',
          toned && mark && TONES[mark],
        )}
      >
        {children}
      </span>
    </li>
  );
}

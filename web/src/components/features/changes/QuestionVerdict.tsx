import { Check, CircleDashed, X } from 'lucide-react';
import type { ReactNode } from 'react';

import { Pill } from '@/components/shared/Pill';
import { type AnswerVerdict, VERDICT_LABELS } from '@/lib/change-stack';

const ICONS = {
  right: <Check aria-hidden className="size-3" />,
  'partly-right': (
    <CircleDashed aria-hidden className="size-3 text-amber-600" />
  ),
  missed: <X aria-hidden className="size-3 text-destructive" />,
} satisfies Record<AnswerVerdict, ReactNode>;

export function QuestionVerdict({ verdict }: { verdict: AnswerVerdict }) {
  return (
    <Pill lead={ICONS[verdict]} className="py-0 pr-1.5 pl-1">
      {VERDICT_LABELS[verdict]}
    </Pill>
  );
}

import { TriangleAlert } from 'lucide-react';
import type { SetComposition } from '@/lib/replay';
import { balanceWarningShown } from '@/lib/replay-words';

type BalanceWarningProps = {
  warning: NonNullable<SetComposition['balanceWarning']>;
};

export function BalanceWarning({ warning }: BalanceWarningProps) {
  return (
    <p
      role="note"
      data-slot="balance-warning"
      className="flex items-start gap-1.5 text-amber-700 text-xs leading-5 dark:text-amber-300"
    >
      <TriangleAlert aria-hidden className="mt-1 size-3 shrink-0" />
      {balanceWarningShown(warning)}
    </p>
  );
}

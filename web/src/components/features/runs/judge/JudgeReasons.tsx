import { JudgeReasonItem } from '@/components/features/runs/judge/JudgeReasonItem';
import type { JudgeReason } from '@/lib/judge';
import { cn } from '@/lib/utils';

type JudgeReasonsProps = {
  reasons: readonly JudgeReason[];
  label: string;
  className?: string;
};

export function JudgeReasons({ reasons, label, className }: JudgeReasonsProps) {
  return (
    <ol aria-label={label} className={cn('flex flex-col gap-1.5', className)}>
      {reasons.map((reason, at) => (
        <JudgeReasonItem
          // biome-ignore lint/suspicious/noArrayIndexKey: the position of a reason identifies it, because the reasons of a verdict do not change after they are recorded
          key={at}
          reason={reason}
        />
      ))}
    </ol>
  );
}

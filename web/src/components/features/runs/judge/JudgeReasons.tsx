import { JudgeReasonItem } from '@/components/features/runs/judge/JudgeReasonItem';
import type { FileChange } from '@/lib/changes';
import type { JudgeReason } from '@/lib/judge';
import { cn } from '@/lib/utils';

type JudgeReasonsProps = {
  reasons: readonly JudgeReason[];
  files: readonly FileChange[];
  label: string;
  className?: string;
};

export function JudgeReasons({
  reasons,
  files,
  label,
  className,
}: JudgeReasonsProps) {
  return (
    <ol aria-label={label} className={cn('flex flex-col gap-1.5', className)}>
      {reasons.map((reason, at) => (
        <JudgeReasonItem
          // biome-ignore lint/suspicious/noArrayIndexKey: a verdict's reasons never change once recorded, so where one sits is what names it
          key={at}
          reason={reason}
          files={files}
        />
      ))}
    </ol>
  );
}

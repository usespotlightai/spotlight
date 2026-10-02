import { DeltaShown } from '@/components/features/insights/DeltaShown';
import type { SuccessComparison } from '@/lib/replay';
import { cn } from '@/lib/utils';

type SuccessAgainstBaselineProps = {
  success: SuccessComparison;
  isBaseline?: boolean;
  className?: string;
};

export function SuccessAgainstBaseline({
  success,
  isBaseline = false,
  className,
}: SuccessAgainstBaselineProps) {
  return (
    <span
      data-slot="success-against-baseline"
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs',
        className,
      )}
    >
      <span className="text-foreground tabular-nums">{success.now}</span>
      {isBaseline ? (
        <span className="text-muted-foreground">· the baseline</span>
      ) : success.delta ? (
        <DeltaShown
          delta={success.delta}
          against={`baseline ${success.baseline}`}
        />
      ) : (
        success.baseline !== null && (
          <span className="text-muted-foreground tabular-nums">
            · baseline {success.baseline}
          </span>
        )
      )}
    </span>
  );
}

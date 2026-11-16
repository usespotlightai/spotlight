import { ClaimMark } from '@/components/features/runs/judge/ClaimMark';
import { JUDGE_LABEL } from '@/lib/judge';

type ClaimMarksProps = {
  marks: readonly (boolean | null)[];
  scorers: readonly string[];
};

export function ClaimMarks({ marks, scorers }: ClaimMarksProps) {
  return (
    <span data-slot="claim-marks" className="flex shrink-0 gap-4 pr-1">
      {marks.map((met, at) =>
        met === null ? (
          // oxlint-disable-next-line react/no-array-index-key -- the column of a mark identifies its scorer
          <span key={at} aria-hidden className="size-6" />
        ) : (
          <ClaimMark
            // oxlint-disable-next-line react/no-array-index-key -- the column of a mark identifies its scorer
            key={at}
            met={met}
            scorer={scorers[at] ?? JUDGE_LABEL}
          />
        ),
      )}
    </span>
  );
}

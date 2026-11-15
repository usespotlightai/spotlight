import { useState } from 'react';

import { ClaimMarks } from '@/components/features/runs/judge/ClaimMarks';
import { JudgeReasons } from '@/components/features/runs/judge/JudgeReasons';
import { NumberedClaim } from '@/components/features/runs/judge/NumberedClaim';
import { ExpandChevron } from '@/components/shared/ExpandChevron';
import { ChevronSpace } from '@/components/shared/nested-table/ExpandToggle';
import type { JudgeReason } from '@/lib/judge';

type ClaimVerdictRowProps = {
  index: number;
  text: string | null | undefined;
  marks: readonly (boolean | null)[];
  scorers: readonly string[];
  reasons: readonly JudgeReason[];
  defaultOpen: boolean;
};

export function ClaimVerdictRow({
  index,
  text,
  marks,
  scorers,
  reasons,
  defaultOpen,
}: ClaimVerdictRowProps) {
  const [open, setOpen] = useState(defaultOpen);
  const expandable = reasons.length > 0;
  const shown = expandable && open;

  return (
    <li
      data-slot="claim-verdict"
      data-open={shown || undefined}
      className="flex flex-col gap-1"
    >
      <div className="flex items-start gap-3">
        {expandable ? (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((was) => !was)}
            className="flex min-w-0 flex-1 items-start gap-1 rounded-sm text-left text-foreground text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <span className="flex h-6 shrink-0 items-center text-muted-foreground">
              <span className="flex size-4 items-center justify-center">
                <ExpandChevron open={open} />
              </span>
            </span>
            <NumberedClaim index={index}>{text}</NumberedClaim>
          </button>
        ) : (
          <span className="flex min-w-0 flex-1 items-start gap-1 text-foreground text-sm leading-6">
            <span className="flex h-6 shrink-0 items-center">
              <ChevronSpace />
            </span>
            <NumberedClaim index={index}>{text}</NumberedClaim>
          </span>
        )}
        <ClaimMarks marks={marks} scorers={scorers} />
      </div>
      {shown && (
        <JudgeReasons
          reasons={reasons}
          label={`The judge’s reasons on claim ${index + 1}`}
          className="pl-5"
        />
      )}
    </li>
  );
}

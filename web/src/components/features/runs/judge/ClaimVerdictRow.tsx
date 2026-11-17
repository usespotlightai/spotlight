import { useState } from 'react';

import { ClaimMark } from '@/components/features/runs/judge/ClaimMark';
import { JudgeReasons } from '@/components/features/runs/judge/JudgeReasons';
import { NumberedClaim } from '@/components/features/runs/judge/NumberedClaim';
import { ExpandChevron } from '@/components/shared/ExpandChevron';
import { ChevronSpace } from '@/components/shared/nested-table/ExpandToggle';
import type { JudgeReason } from '@/lib/judge';

type ClaimVerdictRowProps = {
  index: number;
  text: string | undefined;
  met: boolean;
  reasons: readonly JudgeReason[];
};

export function ClaimVerdictRow({
  index,
  text,
  met,
  reasons,
}: ClaimVerdictRowProps) {
  const [open, setOpen] = useState(!met);
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
        <span className="flex shrink-0 pr-1">
          <ClaimMark met={met} />
        </span>
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

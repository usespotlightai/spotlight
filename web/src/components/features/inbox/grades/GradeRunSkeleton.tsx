import { DecisionButton } from '@/components/shared/DecisionButton';
import { DecisionCard } from '@/components/shared/DecisionCard';
import { DecisionControls } from '@/components/shared/DecisionControls';
import { DecisionHeader } from '@/components/shared/DecisionHeader';
import { RadioRow } from '@/components/shared/form/RadioRow';
import { DecisionTitleSkeleton } from '@/components/shared/skeleton/DecisionTitleSkeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { CLAIM_ANSWERS, CLAIMS_QUESTION, SAVE_GRADE } from '@/lib/judge';

const CLAIM_WIDTHS = ['w-80', 'w-64', 'w-72'] as const;

export function GradeRunSkeleton() {
  return (
    <DecisionCard role="status" aria-label="Loading the run to grade">
      <DecisionHeader title={<DecisionTitleSkeleton className="w-40" />} />
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-sm leading-6">
          {CLAIMS_QUESTION}
        </p>
        <div className="flex flex-col gap-2">
          {CLAIM_WIDTHS.map((width) => (
            <div
              key={width}
              className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1"
            >
              <span className="flex min-w-0 flex-1 text-sm leading-6">
                <SkeletonLine className={`${width} max-w-full`} />
              </span>
              <span className="flex shrink-0 gap-1">
                {CLAIM_ANSWERS.map((option) => (
                  <RadioRow
                    compact
                    key={option.label}
                    name={`loading-${width}`}
                    value={option.met ? 'yes' : 'no'}
                    checked={false}
                    disabled
                    onChange={() => {}}
                  >
                    {option.label}
                  </RadioRow>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
      <DecisionControls>
        <DecisionButton type="button" variant="default" disabled>
          {SAVE_GRADE}
        </DecisionButton>
      </DecisionControls>
    </DecisionCard>
  );
}

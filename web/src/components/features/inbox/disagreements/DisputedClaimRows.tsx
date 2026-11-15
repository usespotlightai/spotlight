import type { ReactNode } from 'react';

import { ClaimMarkText } from '@/components/features/runs/judge/ClaimMarkText';
import { JudgeReasons } from '@/components/features/runs/judge/JudgeReasons';
import { NumberedClaim } from '@/components/features/runs/judge/NumberedClaim';
import { FACT_LABEL, FACT_VALUE, FactRow } from '@/components/shared/FactRow';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { type ClaimGrade, JUDGE_LABEL, type JudgeReason } from '@/lib/judge';
import { CLAIM_LABEL, type DisagreementClaim } from '@/lib/judge-disagreement';
import { cn } from '@/lib/utils';

type DisputedClaimRowsProps = {
  claim: DisagreementClaim;
  reasons: readonly JudgeReason[];
  grade: ClaimGrade | null;
  graded: boolean;
  loading: boolean;
  textId?: string;
  children?: ReactNode;
};

export function DisputedClaimRows({
  claim,
  reasons,
  grade,
  graded,
  loading,
  textId,
  children,
}: DisputedClaimRowsProps) {
  const mark = grade?.marks[claim.index];

  return (
    <dl>
      <FactRow wide>
        <dt className={FACT_LABEL}>{CLAIM_LABEL}</dt>
        <dd className={FACT_VALUE}>
          <NumberedClaim index={claim.index} id={textId}>
            {claim.text}
          </NumberedClaim>
        </dd>
      </FactRow>

      {loading && graded && (
        <FactRow wide>
          <dt aria-hidden className={FACT_LABEL}>
            <SkeletonLine className="w-10" />
          </dt>
          <dd aria-hidden className={FACT_VALUE}>
            <SkeletonLine className="w-14" />
          </dd>
        </FactRow>
      )}

      {grade && mark !== undefined && (
        <FactRow wide>
          <dt className={cn(FACT_LABEL, 'truncate')}>{grade.grader}</dt>
          <dd className={cn(FACT_VALUE, 'flex')}>
            <ClaimMarkText met={mark} />
          </dd>
        </FactRow>
      )}

      <FactRow wide>
        <dt className={FACT_LABEL}>{JUDGE_LABEL}</dt>
        <dd className="flex min-w-0 flex-col gap-1">
          <ClaimMarkText met={claim.judgeMet} />
          {loading ? (
            <div className="flex flex-col text-sm leading-5">
              <SkeletonLine className="w-80 max-w-full" />
              <SkeletonLine className="w-48" />
            </div>
          ) : (
            reasons.length > 0 && (
              <JudgeReasons
                reasons={reasons}
                label={`The judge’s reasons on claim ${claim.index + 1}`}
              />
            )
          )}
        </dd>
      </FactRow>

      {children}
    </dl>
  );
}

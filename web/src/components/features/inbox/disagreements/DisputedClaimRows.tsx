import type { ReactNode } from 'react';

import { ClaimMarkText } from '@/components/features/runs/judge/ClaimMarkText';
import { JudgeReasons } from '@/components/features/runs/judge/JudgeReasons';
import { NumberedClaim } from '@/components/features/runs/judge/NumberedClaim';
import { FACT_LABEL, FACT_VALUE, FactRow } from '@/components/shared/FactRow';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { JUDGE_LABEL, type JudgeReason } from '@/lib/judge';
import { CLAIM_LABEL, type DisagreementClaim } from '@/lib/judge-disagreement';

type DisputedClaimRowsProps = {
  claim: DisagreementClaim;
  reasons: readonly JudgeReason[];
  loading: boolean;
  textId?: string;
  children?: ReactNode;
};

export function DisputedClaimRows({
  claim,
  reasons,
  loading,
  textId,
  children,
}: DisputedClaimRowsProps) {
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

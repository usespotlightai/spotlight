import type { ReactElement } from 'react';

import { NumberedClaim } from '@/components/features/runs/judge/NumberedClaim';
import { FACT_LABEL, FACT_VALUE, FactRow } from '@/components/shared/FactRow';
import { CLAIMS_LABEL, type DisagreementClaim } from '@/lib/judge-disagreement';
import { cn } from '@/lib/utils';

export function DisagreementClaimsRow({
  claims,
}: {
  claims: readonly DisagreementClaim[];
}): ReactElement {
  return (
    <dl>
      <FactRow wide>
        <dt className={FACT_LABEL}>{CLAIMS_LABEL}</dt>
        <dd className={cn(FACT_VALUE, 'flex flex-col')}>
          {claims.map((claim) => (
            <NumberedClaim key={claim.index} index={claim.index}>
              {claim.text}
            </NumberedClaim>
          ))}
        </dd>
      </FactRow>
    </dl>
  );
}

import { type ReactElement, useId } from 'react';

import { NumberedClaim } from '@/components/features/runs/judge/NumberedClaim';
import { FACT_LABEL, FactRow } from '@/components/shared/FactRow';
import { RadioRow } from '@/components/shared/form/RadioRow';
import {
  CLAIM_NOT_MET,
  type DisagreementClaim,
  NO_CLAIM,
  NO_CLAIM_COVERS_IT,
  type NotMetPick,
} from '@/lib/judge-disagreement';

type NotMetClaimPickProps = {
  claims: readonly DisagreementClaim[];
  picked: NotMetPick;
  pending: boolean;
  onPick: (picked: NotMetPick) => void;
};

export function NotMetClaimPick({
  claims,
  picked,
  pending,
  onPick,
}: NotMetClaimPickProps): ReactElement {
  const id = useId();
  const labelId = `${id}-label`;
  const name = `${id}-not-met`;

  return (
    <FactRow wide>
      <dt id={labelId} className={FACT_LABEL}>
        {CLAIM_NOT_MET}
      </dt>
      <dd>
        <div
          role="radiogroup"
          aria-labelledby={labelId}
          data-slot="not-met-claim"
          className="-mx-2 flex flex-col"
        >
          {claims.map((claim) => (
            <RadioRow
              compact
              key={claim.index}
              name={name}
              value={String(claim.index)}
              checked={picked === claim.index}
              disabled={pending}
              onChange={() => onPick(claim.index)}
            >
              <NumberedClaim index={claim.index}>{claim.text}</NumberedClaim>
            </RadioRow>
          ))}
          <RadioRow
            compact
            name={name}
            value={NO_CLAIM}
            checked={picked === NO_CLAIM}
            disabled={pending}
            onChange={() => onPick(NO_CLAIM)}
          >
            {NO_CLAIM_COVERS_IT}
          </RadioRow>
        </div>
      </dd>
    </FactRow>
  );
}

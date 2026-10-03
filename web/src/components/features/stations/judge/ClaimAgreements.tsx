import { useId } from 'react';
import {
  AGREED_COLUMN,
  CLAIM_AGREEMENT_LABEL,
  CLAIM_COLUMN,
  type ClaimAgreement,
  claimShown,
  KAPPA_COLUMN,
  percentShown,
  RUNS_COLUMN,
  statShown,
} from '@/lib/judge';

type ClaimAgreementsProps = {
  agreements: readonly ClaimAgreement[];
  claims: readonly string[];
};

const CELL = 'px-2 py-1 text-right tabular-nums';

export function ClaimAgreements({ agreements, claims }: ClaimAgreementsProps) {
  const captionId = useId();

  return (
    <div className="flex flex-col gap-1 text-xs">
      <p id={captionId} className="text-muted-foreground">
        {CLAIM_AGREEMENT_LABEL}
      </p>
      <table
        data-slot="claim-agreements"
        aria-labelledby={captionId}
        className="w-full border-collapse"
      >
        <thead>
          <tr className="text-muted-foreground">
            <th scope="col" className="py-1 pr-2 text-left font-normal">
              {CLAIM_COLUMN}
            </th>
            <th scope="col" className={`${CELL} font-normal`}>
              {KAPPA_COLUMN}
            </th>
            <th scope="col" className={`${CELL} font-normal`}>
              {AGREED_COLUMN}
            </th>
            <th scope="col" className={`${CELL} font-normal`}>
              {RUNS_COLUMN}
            </th>
          </tr>
        </thead>
        <tbody>
          {agreements.map((each) => (
            <tr
              key={each.index}
              data-slot="claim-agreement"
              className="border-border border-t"
            >
              <th
                scope="row"
                className="py-1 pr-2 text-left font-normal text-foreground"
              >
                {claimShown(claims, each.index)}
              </th>
              <td className={`${CELL} text-foreground`}>
                {statShown(each.kappa)}
              </td>
              <td className={`${CELL} text-foreground`}>
                {percentShown(each.observed)}
              </td>
              <td className={`${CELL} text-muted-foreground`}>{each.pairs}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

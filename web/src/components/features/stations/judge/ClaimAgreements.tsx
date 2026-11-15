import { NumberedClaim } from '@/components/features/runs/judge/NumberedClaim';
import { KappaBar } from '@/components/features/stations/judge/KappaBar';
import {
  EDGE_INDENT,
  ROW_DIVIDER,
  TABLE_ROW,
} from '@/components/shared/nested-table/nested-rows';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import {
  CLAIM_HEADINGS,
  type ClaimAgreement,
  formatPercent,
  RUNS,
  SAME_VERDICT,
} from '@/lib/judge';
import { cn } from '@/lib/utils';

type ClaimAgreementsProps = {
  agreements: readonly ClaimAgreement[];
  claims: readonly string[];
  minAgreement: number | null;
};

export function ClaimAgreements({
  agreements,
  claims,
  minAgreement,
}: ClaimAgreementsProps) {
  return (
    <NestedTable label="Agreement by claim" headings={CLAIM_HEADINGS}>
      {agreements.map((each) => (
        <li
          key={each.index}
          data-slot="claim-agreement"
          className={cn(TABLE_ROW, ROW_DIVIDER)}
        >
          <span
            className={cn(
              'col-span-full min-w-0 text-foreground @4xl:col-span-1',
              EDGE_INDENT,
            )}
          >
            <NumberedClaim index={each.index}>
              {claims[each.index]}
            </NumberedClaim>
          </span>
          <span className="col-span-full min-w-0 @4xl:col-span-1">
            <KappaBar
              kappa={each.kappa}
              reading={each.reading}
              failing={each.belowMinimum}
              minAgreement={minAgreement}
            />
          </span>
          <NestedCell heading={SAME_VERDICT}>
            {formatPercent(each.observed)}
          </NestedCell>
          <NestedCell heading={RUNS}>{each.pairs}</NestedCell>
        </li>
      ))}
    </NestedTable>
  );
}

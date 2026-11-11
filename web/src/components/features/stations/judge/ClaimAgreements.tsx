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
  formatClaim,
  formatPercent,
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
            {formatClaim(claims, each.index)}
          </span>
          <span className="col-span-full min-w-0 @4xl:col-span-1">
            <KappaBar
              kappa={each.kappa}
              reading={each.reading}
              failing={each.belowMinimum}
              minAgreement={minAgreement}
            />
          </span>
          <NestedCell heading="Agreed">
            {formatPercent(each.observed)}
          </NestedCell>
          <NestedCell heading="Runs">{each.pairs}</NestedCell>
        </li>
      ))}
    </NestedTable>
  );
}

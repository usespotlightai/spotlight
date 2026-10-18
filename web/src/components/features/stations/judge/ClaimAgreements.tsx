import { KappaBar } from '@/components/features/stations/judge/KappaBar';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import {
  EDGE_INDENT,
  ROW_DIVIDER,
} from '@/components/shared/nested-table/nested-rows';
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
          className={cn(
            'col-span-full grid grid-cols-2 items-center gap-x-6 gap-y-2 py-2 pr-2 text-xs @4xl:grid-cols-subgrid',
            ROW_DIVIDER,
          )}
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

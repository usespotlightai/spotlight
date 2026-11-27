import { KappaBar } from '@/components/features/stations/judge/KappaBar';
import { VersionLabel } from '@/components/features/stations/judge/VersionLabel';
import {
  EDGE_INDENT,
  ROW_DIVIDER,
  TABLE_ROW,
} from '@/components/shared/nested-table/nested-rows';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import {
  formatPercent,
  type RubricVersion,
  RUNS,
  SAME_VERDICT,
  VERSION_HEADINGS,
  VERSIONS_TITLE,
} from '@/lib/judge';
import { cn } from '@/lib/utils';

type VersionAgreementsProps = {
  versions: readonly RubricVersion[];
  minAgreement: number | null;
};

const currentFirst = (versions: readonly RubricVersion[]): RubricVersion[] =>
  versions.toSorted(
    (one, other) => Number(other.current) - Number(one.current),
  );

export function VersionAgreements({
  versions,
  minAgreement,
}: VersionAgreementsProps) {
  return (
    <NestedTable label={VERSIONS_TITLE} headings={VERSION_HEADINGS}>
      {currentFirst(versions).map((version) => {
        const { agreement } = version;

        return (
          <li
            key={version.rubricVersion}
            data-slot="version-agreement"
            className={cn(TABLE_ROW, ROW_DIVIDER)}
          >
            <span
              className={cn(
                'col-span-full min-w-0 text-foreground @4xl:col-span-1',
                EDGE_INDENT,
              )}
            >
              <VersionLabel version={version} />
            </span>
            <span className="col-span-full min-w-0 @4xl:col-span-1">
              <KappaBar
                kappa={agreement.kappa}
                reading={agreement.reading}
                failing={agreement.belowMinimum}
                minAgreement={minAgreement}
              />
            </span>
            <NestedCell heading={SAME_VERDICT}>
              {formatPercent(agreement.observed)}
            </NestedCell>
            <NestedCell heading={RUNS}>{agreement.pairs}</NestedCell>
          </li>
        );
      })}
    </NestedTable>
  );
}

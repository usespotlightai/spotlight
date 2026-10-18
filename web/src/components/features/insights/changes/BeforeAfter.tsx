import { BeforeAfterSkeleton } from '@/components/features/insights/changes/BeforeAfterSkeleton';
import { ConfigPlan } from '@/components/features/insights/changes/ConfigPlan';
import { TallyComparison } from '@/components/features/insights/TallyComparison';
import { ImproveStationLink } from '@/components/features/stations/ImproveStationLink';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { PillLink } from '@/components/shared/PillLink';
import { useInsightsChanges } from '@/hooks/api/useInsightsChanges';
import {
  type InsightsPeriod,
  type StationNames,
  targetStationOf,
} from '@/lib/insights';
import { type ChangeAt, judgeRow, markerOf } from '@/lib/insights-changes';
import { failed, loading } from '@/lib/query';
import { judgeAgreementPath, stationPath } from '@/lib/station';

type BeforeAfterProps = {
  slug: string;
  teamId: string;
  period: InsightsPeriod;
  change: ChangeAt;
  names: StationNames;
};

export function BeforeAfter({
  slug,
  teamId,
  period,
  change,
  names,
}: BeforeAfterProps) {
  const changes = useInsightsChanges(teamId, period);
  const named = names.get(change.stationId);

  if (loading(changes)) {
    return <BeforeAfterSkeleton />;
  }

  if (failed(changes) || !changes.data) {
    return (
      <CouldNotLoad
        what="The change"
        retrying={changes.isFetching}
        onRetry={() => void changes.refetch()}
        className="items-start"
      />
    );
  }

  const marker = markerOf(changes.data, change);

  if (!marker) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-muted-foreground text-sm">
          This change is outside the period.
        </p>
        {named && (
          <PillLink
            to={stationPath(slug, teamId, named.lineId, named.stationId)}
          >
            Open the station
          </PillLink>
        )}
      </div>
    );
  }

  const qualified = changes.data.judges.some(
    (each) => each.stationId === marker.stationId && each.qualified,
  );

  return (
    <div data-slot="before-after" className="flex flex-col gap-5">
      <section className="flex flex-col gap-1">
        <h3 className="font-medium text-foreground text-sm">What changed</h3>
        {marker.changes.length > 0 ? (
          <ConfigPlan changes={marker.changes} />
        ) : (
          <p className="text-muted-foreground text-sm">Config not on record.</p>
        )}
      </section>

      <section className="flex flex-col gap-1">
        <h3 className="font-medium text-foreground text-sm">
          Runs before and after
        </h3>
        <TallyComparison
          label="Runs before and after the change"
          oneLabel="Before"
          otherLabel="After"
          runs={{ one: marker.before.runs, other: marker.after.runs }}
          verdicts={marker.verdicts}
          extra={
            qualified
              ? [judgeRow(marker, judgeAgreementPath(slug, teamId, marker))]
              : []
          }
        />
      </section>

      <div className="flex flex-wrap gap-2">
        <PillLink
          to={stationPath(slug, teamId, marker.lineId, marker.stationId)}
        >
          Open the station
        </PillLink>
        {named && (
          <ImproveStationLink
            slug={slug}
            teamId={teamId}
            targetStation={targetStationOf(named)}
          />
        )}
      </div>
    </div>
  );
}

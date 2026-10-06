import { GlanceSkeleton } from '@/components/features/stations/overview/GlanceSkeleton';
import { StationSection } from '@/components/features/stations/StationSection';
import { SectionLink } from '@/components/shared/SectionLink';
import { useStationOutcomes } from '@/hooks/api/useStationOutcomes';
import { failed, loading } from '@/lib/query';
import { stationInsightsPath } from '@/lib/station';
import { GLANCE_COLUMNS } from '@/lib/station-outcomes';

type StationGlanceProps = {
  slug: string;
  teamId: string;
  lineId: string;
  stationId: string;
};

export function StationGlance({
  slug,
  teamId,
  lineId,
  stationId,
}: StationGlanceProps) {
  const outcomes = useStationOutcomes(teamId, lineId, stationId);
  const inForce = outcomes.data?.inForce;

  if (loading(outcomes)) {
    return (
      <StationSection title="Latest runs on this config">
        <GlanceSkeleton />
      </StationSection>
    );
  }

  if (failed(outcomes) || !inForce) {
    return null;
  }

  return (
    <StationSection
      title="Latest runs on this config"
      action={
        <SectionLink to={stationInsightsPath(slug, teamId, stationId)}>
          See in Insights
        </SectionLink>
      }
    >
      <dl
        data-slot="station-glance"
        className="grid grid-cols-3 gap-x-4 gap-y-3 sm:grid-cols-6"
      >
        {GLANCE_COLUMNS.map((column) => (
          <div key={column.label} className="flex flex-col-reverse gap-0.5">
            <dt className="text-muted-foreground text-xs">{column.label}</dt>
            <dd className="font-semibold text-foreground text-xl tabular-nums tracking-tight">
              {column.shown(inForce.tally)}
            </dd>
          </div>
        ))}
      </dl>
    </StationSection>
  );
}

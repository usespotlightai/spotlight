import { Instrument } from '@/components/features/stations/config/Instrument';
import { InstrumentValue } from '@/components/features/stations/config/InstrumentValue';
import { SectionLink } from '@/components/shared/SectionLink';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { buttonVariants } from '@/components/ui/button-variants';
import { useStationInsights } from '@/hooks/api/useStationInsights';
import { failed, loading } from '@/lib/query';
import { stationInsightsPath } from '@/lib/station';
import { configVersion } from '@/lib/station-insights';
import { cn } from '@/lib/utils';

type VersionInstrumentProps = {
  slug: string;
  teamId: string;
  lineId: string;
  stationId: string;
};

export function VersionInstrument({
  slug,
  teamId,
  lineId,
  stationId,
}: VersionInstrumentProps) {
  const outcomes = useStationInsights(teamId, lineId, stationId);
  const version = configVersion(outcomes.data?.groups ?? []);

  return (
    <Instrument
      title="Version"
      action={
        version && (
          <SectionLink to={stationInsightsPath(slug, teamId, stationId)}>
            History
          </SectionLink>
        )
      }
    >
      {loading(outcomes) ? (
        <>
          <SkeletonLine className="w-28 text-[1.375rem] leading-none" />
          <SkeletonLine className="w-36 text-xs" />
        </>
      ) : failed(outcomes) ? (
        <InstrumentValue detail="Sorry, the station’s runs couldn’t be loaded.">
          <span className="text-muted-foreground">Unknown</span>
        </InstrumentValue>
      ) : version ? (
        <>
          <InstrumentValue detail={`Version ${version.fingerprint}`}>
            {version.since ? `Since ${version.since}` : 'In force'}
          </InstrumentValue>

          {version.pullRequest && (
            <a
              href={version.pullRequest}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ size: 'sm', variant: 'outline' }),
                'mt-auto self-end rounded-full bg-card shadow-none',
              )}
            >
              View pull request
            </a>
          )}
        </>
      ) : (
        <InstrumentValue detail="The station’s first run sets the first version.">
          <span className="text-muted-foreground">None yet</span>
        </InstrumentValue>
      )}
    </Instrument>
  );
}

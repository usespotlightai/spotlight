import { ConfigCard } from '@/components/features/stations/config/ConfigCard';
import { ConfigCardValue } from '@/components/features/stations/config/ConfigCardValue';
import { SectionLink } from '@/components/shared/SectionLink';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { buttonVariants } from '@/components/ui/button-variants';
import { useStationInsights } from '@/hooks/api/useStationInsights';
import { failed, loading } from '@/lib/query';
import { stationInsightsPath } from '@/lib/station';
import { configFingerprint } from '@/lib/station-insights';
import { cn } from '@/lib/utils';

type FingerprintCardProps = {
  slug: string;
  teamId: string;
  lineId: string;
  stationId: string;
};

export function FingerprintCard({
  slug,
  teamId,
  lineId,
  stationId,
}: FingerprintCardProps) {
  const outcomes = useStationInsights(teamId, lineId, stationId);
  const live = configFingerprint(outcomes.data?.groups ?? []);

  return (
    <ConfigCard
      title="Config fingerprint"
      action={
        live && (
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
        <ConfigCardValue detail="Sorry, the station’s runs couldn’t be loaded.">
          <span className="text-muted-foreground">Unknown</span>
        </ConfigCardValue>
      ) : live ? (
        <>
          <ConfigCardValue detail={`Config ${live.fingerprint}`}>
            {live.since ? `Live since ${live.since}` : 'Live'}
          </ConfigCardValue>

          {live.pullRequest && (
            <a
              href={live.pullRequest}
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
        <ConfigCardValue detail="The first run of the station sets the first config fingerprint.">
          <span className="text-muted-foreground">None yet</span>
        </ConfigCardValue>
      )}
    </ConfigCard>
  );
}

import { ArrowUpRight } from 'lucide-react';
import {
  Property,
  PropertyList,
} from '@/components/features/stations/config/PropertyList';
import { TabSection } from '@/components/features/stations/TabSection';
import { SectionLink } from '@/components/shared/SectionLink';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { WithTooltip } from '@/components/shared/WithTooltip';
import { useStationInsights } from '@/hooks/api/useStationInsights';
import { formatDay } from '@/lib/judge';
import { failed, loading } from '@/lib/query';
import { stationInsightsPath } from '@/lib/station';
import { configFingerprint } from '@/lib/station-insights';

type VersionPropertiesProps = {
  slug: string;
  teamId: string;
  lineId: string;
  stationId: string;
};

export function VersionProperties({
  slug,
  teamId,
  lineId,
  stationId,
}: VersionPropertiesProps) {
  const outcomes = useStationInsights(teamId, lineId, stationId);
  const live = configFingerprint(outcomes.data?.groups ?? []);

  return (
    <TabSection
      level={3}
      title="Live config"
      action={
        live && (
          <SectionLink to={stationInsightsPath(slug, teamId, stationId)}>
            History
          </SectionLink>
        )
      }
    >
      <div data-slot="live-config">
        {loading(outcomes) ? (
          <PropertyList>
            <Property label="Since">
              <SkeletonLine className="w-16" />
            </Property>
          </PropertyList>
        ) : failed(outcomes) ? (
          <p className="text-muted-foreground text-sm">
            Sorry, the station’s runs couldn’t be loaded.
          </p>
        ) : live ? (
          <PropertyList>
            <Property label="Since">
              <WithTooltip tooltip={`Config ${live.fingerprint}`}>
                <span>
                  {live.since ? formatDay(live.since) : 'No run ended yet'}
                </span>
              </WithTooltip>
            </Property>
            {live.pullRequest && (
              <Property label="Change">
                <a
                  href={live.pullRequest}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:underline"
                >
                  Pull request
                  <ArrowUpRight
                    aria-hidden
                    className="size-3.5 text-muted-foreground"
                  />
                </a>
              </Property>
            )}
          </PropertyList>
        ) : (
          <p className="text-muted-foreground text-sm">
            No run has used a config yet.
          </p>
        )}
      </div>
    </TabSection>
  );
}

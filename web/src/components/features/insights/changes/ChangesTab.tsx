import { useState } from 'react';
import { ChangeMarkerList } from '@/components/features/insights/changes/ChangeMarkerList';
import { ChangesSkeleton } from '@/components/features/insights/changes/ChangesSkeleton';
import { OriginsFailedNote } from '@/components/features/insights/changes/OriginsFailedNote';
import { SetupComparison } from '@/components/features/insights/changes/SetupComparison';
import { InsightsFailed } from '@/components/features/insights/InsightsFailed';
import { NoRunsInPeriod } from '@/components/features/insights/NoRunsInPeriod';
import { TruncatedNote } from '@/components/features/insights/TruncatedNote';
import { useConfigOrigins } from '@/hooks/api/useConfigOrigins';
import { useInsightsCandidates } from '@/hooks/api/useInsightsCandidates';
import { useInsightsChanges } from '@/hooks/api/useInsightsChanges';
import {
  type SetupsNarrowed,
  useInsightsSetups,
} from '@/hooks/api/useInsightsSetups';
import type { InsightsPeriod, StationNames } from '@/lib/insights';
import { DEFAULT_OUTCOME, type OutcomeMeasure } from '@/lib/insights-changes';
import { failed, loading } from '@/lib/query';

type ChangesTabProps = {
  slug: string;
  teamId: string;
  period: InsightsPeriod;
  names: StationNames;
};

const EVERY_SETUP: SetupsNarrowed = { stationId: null, size: null };

export function ChangesTab({ slug, teamId, period, names }: ChangesTabProps) {
  const [narrowed, setNarrowed] = useState<SetupsNarrowed>(EVERY_SETUP);
  const [measure, setMeasure] = useState<OutcomeMeasure>(DEFAULT_OUTCOME);
  const changes = useInsightsChanges(teamId, period);
  const setups = useInsightsSetups(teamId, period, narrowed);
  const candidates = useInsightsCandidates(teamId, period);
  const origins = useConfigOrigins(teamId, changes.data?.markers ?? []);

  if (loading(changes) || loading(setups)) {
    return <ChangesSkeleton />;
  }

  if (failed(changes) || !changes.data) {
    return <InsightsFailed what="The changes" query={changes} />;
  }

  if (failed(setups) || !setups.data) {
    return <InsightsFailed what="The setups" query={setups} />;
  }

  const narrowing = narrowed.stationId !== null || narrowed.size !== null;

  if (
    changes.data.markers.length === 0 &&
    setups.data.setups.length === 0 &&
    !narrowing
  ) {
    return (
      <NoRunsInPeriod slug={slug} teamId={teamId}>
        Config changes and results by harness, model and effort show here once
        stations run tasks.
      </NoRunsInPeriod>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {(changes.data.truncated || setups.data.truncated) && <TruncatedNote />}

      {origins.failed && <OriginsFailedNote onRetry={origins.retry} />}

      <ChangeMarkerList
        slug={slug}
        teamId={teamId}
        markers={changes.data.markers}
        origins={origins.origins}
        names={names}
      />

      <SetupComparison
        slug={slug}
        teamId={teamId}
        setups={setups.data}
        candidates={candidates}
        narrowed={narrowed}
        measure={measure}
        names={names}
        onNarrow={setNarrowed}
        onMeasure={setMeasure}
      />
    </div>
  );
}

import { useState } from 'react';
import { AgentConfigComparison } from '@/components/features/insights/changes/AgentConfigComparison';
import { ChangeMarkerList } from '@/components/features/insights/changes/ChangeMarkerList';
import { ChangesSkeleton } from '@/components/features/insights/changes/ChangesSkeleton';
import { InsightsFailed } from '@/components/features/insights/InsightsFailed';
import { NoRunsInPeriod } from '@/components/features/insights/NoRunsInPeriod';
import { useInsightsAgentConfigs } from '@/hooks/api/useInsightsAgentConfigs';
import { useInsightsCandidates } from '@/hooks/api/useInsightsCandidates';
import { useInsightsChanges } from '@/hooks/api/useInsightsChanges';
import type { InsightsPeriod, StationNames } from '@/lib/insights';
import {
  type AgentConfigsNarrowed,
  DEFAULT_OUTCOME,
  EVERY_AGENT_CONFIG,
  type OutcomeMeasure,
} from '@/lib/insights-changes';
import { failed, loading } from '@/lib/query';

type ChangesTabProps = {
  slug: string;
  teamId: string;
  period: InsightsPeriod;
  names: StationNames;
};

export function ChangesTab({ slug, teamId, period, names }: ChangesTabProps) {
  const [narrowed, setNarrowed] =
    useState<AgentConfigsNarrowed>(EVERY_AGENT_CONFIG);
  const [measure, setMeasure] = useState<OutcomeMeasure>(DEFAULT_OUTCOME);
  const changes = useInsightsChanges(teamId, period);
  const agentConfigs = useInsightsAgentConfigs(teamId, period, narrowed);
  const candidates = useInsightsCandidates(teamId, period);

  if (loading(changes) || loading(agentConfigs)) {
    return <ChangesSkeleton names={names} />;
  }

  if (failed(changes) || !changes.data) {
    return <InsightsFailed what="The changes" query={changes} />;
  }

  if (failed(agentConfigs) || !agentConfigs.data) {
    return <InsightsFailed what="The agent configs" query={agentConfigs} />;
  }

  const narrowing = narrowed.stationId !== null || narrowed.size !== null;

  if (
    changes.data.markers.length === 0 &&
    agentConfigs.data.agentConfigs.length === 0 &&
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
      <ChangeMarkerList
        slug={slug}
        teamId={teamId}
        markers={changes.data.markers}
        names={names}
      />

      <AgentConfigComparison
        slug={slug}
        teamId={teamId}
        comparison={agentConfigs.data}
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

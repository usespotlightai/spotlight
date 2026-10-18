import { AgentConfigFilters } from '@/components/features/insights/changes/AgentConfigFilters';
import { AGENT_CONFIG_SCATTER_HEIGHT } from '@/components/features/insights/changes/AgentConfigScatter';
import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';
import { NestedTableSkeleton } from '@/components/shared/nested-table/NestedTableSkeleton';
import { ChartSkeleton } from '@/components/shared/skeleton/ChartSkeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import type { StationNames } from '@/lib/insights';
import {
  CHANGE_HEADINGS,
  CHANGES_NOTE,
  DEFAULT_OUTCOME,
  EVERY_AGENT_CONFIG,
  outcomeLabel,
} from '@/lib/insights-changes';
import { ignore } from '@/lib/utils';

export function ChangesSkeleton({ names }: { names: StationNames }) {
  return (
    <div
      role="status"
      aria-label="Loading the changes"
      className="flex flex-col gap-3"
    >
      <InsightsCardSkeleton title="Config changes" description={CHANGES_NOTE}>
        <NestedTableSkeleton
          label="Loading the config changes"
          headings={CHANGE_HEADINGS}
          rows={4}
          trailing
          rowClassName="py-2"
        />
      </InsightsCardSkeleton>

      <InsightsCardSkeleton
        switchable
        title="Harness, model, effort and profile"
        description={`${outcomeLabel(DEFAULT_OUTCOME)} against cost per run.`}
        actions={
          <div inert>
            <AgentConfigFilters
              narrowed={EVERY_AGENT_CONFIG}
              measure={DEFAULT_OUTCOME}
              judged={false}
              names={names}
              onNarrow={ignore}
              onMeasure={ignore}
            />
          </div>
        }
      >
        <figure className="flex flex-col gap-1">
          <ChartSkeleton height={AGENT_CONFIG_SCATTER_HEIGHT} />
          <SkeletonLine className="ml-14 h-5 w-64" />
        </figure>
      </InsightsCardSkeleton>
    </div>
  );
}

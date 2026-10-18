import { Pause, Play } from 'lucide-react';
import { useMemo, useState } from 'react';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { PercentilePicker } from '@/components/features/insights/shipping/PercentilePicker';
import { PipelineFlowChart } from '@/components/features/insights/shipping/PipelineFlowChart';
import { PipelineFlowLegend } from '@/components/features/insights/shipping/PipelineFlowLegend';
import { PipelineFlowTable } from '@/components/features/insights/shipping/PipelineFlowTable';
import { Segmented } from '@/components/shared/Segmented';
import { Button } from '@/components/ui/button';
import { formatCount, formatDurationOrNone } from '@/lib/insights';
import { formatType, type PullRequestType } from '@/lib/insights-pull-requests';
import {
  DEFAULT_PERCENTILE,
  FLOW_LAYOUTS,
  type PipelineFlow as Flow,
  type FlowLayout,
  flowStages,
  type Percentile,
} from '@/lib/insights-shipping';

export function PipelineFlow({ flow }: { flow: Flow }) {
  const [percentile, setPercentile] = useState<Percentile>(DEFAULT_PERCENTILE);
  const [layout, setLayout] = useState<FlowLayout>('stations');
  const [focus, setFocus] = useState<PullRequestType | null>(null);
  const [playing, setPlaying] = useState(false);

  const stages = useMemo(
    () => flowStages(flow, layout, percentile, focus),
    [flow, layout, percentile, focus],
  );
  const worst = stages.find((stage) => stage.worst);
  const merged = focus
    ? (flow.types.find((each) => each.type === focus)?.merged ?? 0)
    : flow.merged;
  const which = focus ? `${formatType(focus).toLowerCase()} ` : '';

  return (
    <InsightsCard
      title="Flow through the pipeline"
      description="Time that merged pull requests spend in each stage, from task opened to merge, at the chosen percentile. Stages: each station the task ran at, awaiting review, in review, awaiting merge. Awaiting review ends at the first review by someone other than the author, or at any approval. Bots’ reviews count. Pick a type to see its own times."
      table={<PipelineFlowTable stages={stages} />}
      actions={
        <div className="flex items-center gap-1.5">
          <span className="text-[0.7rem] text-muted-foreground tabular-nums">
            {formatCount(merged)} {which}PRs merged
          </span>
          <Segmented
            label="Show coding as"
            segments={FLOW_LAYOUTS}
            value={layout}
            onChange={setLayout}
          />
          <PercentilePicker value={percentile} onChange={setPercentile} />
          <Button
            type="button"
            variant="outline"
            size="xs"
            aria-pressed={!playing}
            onClick={() => setPlaying((was) => !was)}
          >
            {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
            {playing ? 'Pause' : 'Play'}
          </Button>
        </div>
      }
    >
      <PipelineFlowChart
        stages={stages}
        shares={flow.types}
        focus={focus}
        playing={playing}
        label={`${formatCount(merged)} merged ${which}pull requests at ${percentile}: ${stages
          .map((stage) => `${stage.label} ${formatDurationOrNone(stage.ms)}`)
          .join(
            ', ',
          )}.${worst ? ` The worst bottleneck is ${worst.label}.` : ''}`}
      />
      <PipelineFlowLegend
        shares={flow.types}
        focus={focus}
        onFocus={setFocus}
      />
    </InsightsCard>
  );
}

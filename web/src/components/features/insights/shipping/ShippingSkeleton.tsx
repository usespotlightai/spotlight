import { Play } from 'lucide-react';
import {
  AUTHOR_SERIES,
  ROUND_FILLS,
  THROUGHPUT,
} from '@/components/features/insights/chart-series';
import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';
import { InsightsSection } from '@/components/features/insights/InsightsSection';
import { InsightsTableSkeleton } from '@/components/features/insights/InsightsTableSkeleton';
import { ChartLegend } from '@/components/features/insights/shipping/ChartLegend';
import { DayChartSkeleton } from '@/components/features/insights/shipping/DayChartSkeleton';
import { PercentilePicker } from '@/components/features/insights/shipping/PercentilePicker';
import { PIPELINE_HEIGHT } from '@/components/features/insights/shipping/PipelineFlowChart';
import { Segmented } from '@/components/shared/Segmented';
import { ChartSkeleton } from '@/components/shared/skeleton/ChartSkeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { Button } from '@/components/ui/button';
import {
  MERGE_BY_TYPE_NOTE,
  TIME_TO_MERGE_NOTE,
} from '@/lib/insights-pull-requests';
import {
  AWAITING_REVIEW_NOTE,
  DEFAULT_PERCENTILE,
  DEPTH_OVER_TIME_NOTE,
  FIRST_REVIEW_NOTE,
  FLOW_LAYOUTS,
  formatRounds,
  HUMAN_REVIEWS_NOTE,
  PIPELINE_NOTE,
  REVIEW_BOTS_NOTE,
  ROUNDS,
  SMOOTHINGS,
} from '@/lib/insights-shipping';
import { ignore } from '@/lib/utils';

const TYPES = 4;

const percentile = (
  <PercentilePicker value={DEFAULT_PERCENTILE} onChange={ignore} />
);

const smoothing = (
  <Segmented
    label="Smoothing"
    segments={SMOOTHINGS}
    value="rolling"
    onChange={ignore}
  />
);

const DEPTH_LEGEND = [
  ...ROUNDS.map((rounds) => ({
    label: formatRounds(rounds),
    color: ROUND_FILLS[rounds],
  })),
  { label: 'Merged that week', color: THROUGHPUT },
];

export function ShippingSkeleton() {
  return (
    <>
      <InsightsSection title="What the agents ship">
        <div
          role="status"
          aria-label="Loading what the agents ship"
          className="flex flex-col gap-2"
        >
          <InsightsCardSkeleton
            switchable
            title="Flow through the pipeline"
            description={PIPELINE_NOTE}
            actions={
              <div inert className="flex items-center gap-1.5">
                <SkeletonLine className="w-20 text-[0.7rem]" />
                <Segmented
                  label="Show coding as"
                  segments={FLOW_LAYOUTS}
                  value="stations"
                  onChange={ignore}
                />
                {percentile}
                <Button type="button" variant="outline" size="xs">
                  <Play aria-hidden />
                  Play
                </Button>
              </div>
            }
          >
            <ChartSkeleton height={PIPELINE_HEIGHT} />
            <div className="flex items-center gap-4 border-border border-t pt-2 text-xs">
              <SkeletonLine className="w-48" />
              <SkeletonLine className="w-40" />
            </div>
          </InsightsCardSkeleton>

          <div className="grid gap-3 lg:grid-cols-2">
            <InsightsCardSkeleton
              title="Time to merge"
              description={TIME_TO_MERGE_NOTE}
              actions={
                <div inert className="flex items-center gap-1.5">
                  {percentile}
                  {smoothing}
                </div>
              }
            >
              <dl className="flex flex-wrap gap-x-8 gap-y-3">
                {AUTHOR_SERIES.map((author) => (
                  <div key={author.key} className="flex flex-col gap-1">
                    <dt className="flex items-center gap-1.5 text-muted-foreground text-xs">
                      <span
                        aria-hidden
                        className="size-2 rounded-sm"
                        style={{ background: author.color }}
                      />
                      {author.label}
                    </dt>
                    <dd className="flex items-baseline gap-2">
                      <SkeletonLine className="w-20 text-[1.375rem] leading-none" />
                      <SkeletonLine className="w-12 text-xs" />
                    </dd>
                  </div>
                ))}
              </dl>
              <DayChartSkeleton legend={AUTHOR_SERIES} />
            </InsightsCardSkeleton>

            <InsightsCardSkeleton
              title="Time to merge by PR type"
              description={MERGE_BY_TYPE_NOTE}
              actions={<div inert>{percentile}</div>}
            >
              <ul className="flex flex-col gap-2">
                {Array.from({ length: TYPES }, (_, at) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: placeholder types have no identity
                  <li key={at} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <SkeletonLine className="w-28" />
                      <SkeletonLine className="w-20" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="h-1.5 rounded-full bg-muted" />
                      <span className="h-1 rounded-full bg-muted" />
                    </div>
                  </li>
                ))}
              </ul>
              <ChartLegend entries={AUTHOR_SERIES} />
            </InsightsCardSkeleton>
          </div>

          <InsightsCardSkeleton
            title="Review depth as throughput climbs"
            description={DEPTH_OVER_TIME_NOTE}
          >
            <div className="grid gap-3 md:grid-cols-[1fr_14rem]">
              <figure className="flex flex-col gap-2">
                <ChartSkeleton height={200} />
                <ChartLegend entries={DEPTH_LEGEND} />
              </figure>
              <dl className="flex flex-col justify-center gap-0.5 text-xs">
                {ROUNDS.map((rounds) => (
                  <div
                    key={rounds}
                    className="flex items-center gap-2 rounded-md px-2 py-1 even:bg-muted/30"
                  >
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-sm"
                      style={{ background: ROUND_FILLS[rounds] }}
                    />
                    <dt className="flex-1 text-foreground">
                      {formatRounds(rounds)}
                    </dt>
                    <dd>
                      <SkeletonLine className="w-6" />
                    </dd>
                    <dd className="w-10">
                      <SkeletonLine className="ml-auto w-8" />
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </InsightsCardSkeleton>
        </div>
      </InsightsSection>

      <InsightsSection title="Review and approval">
        <div
          role="status"
          aria-label="Loading the reviews"
          className="flex flex-col gap-2"
        >
          <div className="grid gap-3 lg:grid-cols-2">
            <InsightsCardSkeleton
              title="Time to first review"
              description={FIRST_REVIEW_NOTE}
              actions={
                <div inert className="flex items-center gap-1.5">
                  {percentile}
                  {smoothing}
                </div>
              }
            >
              <DayChartSkeleton />
            </InsightsCardSkeleton>
            <InsightsCardSkeleton
              title="PRs awaiting first review"
              description={AWAITING_REVIEW_NOTE}
            >
              <DayChartSkeleton />
            </InsightsCardSkeleton>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <InsightsCardSkeleton
              tableOnly
              title="AI review agents"
              description={REVIEW_BOTS_NOTE}
            >
              <InsightsTableSkeleton
                label="Loading the AI review agents"
                headers={['Agent', 'Comments', 'Reviews', 'Resolved']}
              />
            </InsightsCardSkeleton>
            <InsightsCardSkeleton
              title="Human reviews"
              description={HUMAN_REVIEWS_NOTE}
            >
              <DayChartSkeleton />
            </InsightsCardSkeleton>
          </div>
        </div>
      </InsightsSection>
    </>
  );
}

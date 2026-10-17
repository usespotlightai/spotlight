import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { InsightsSection } from '@/components/features/insights/InsightsSection';
import { DayChart } from '@/components/features/insights/shipping/DayChart';
import { PipelineFlow } from '@/components/features/insights/shipping/PipelineFlow';
import { ReviewBots } from '@/components/features/insights/shipping/ReviewBots';
import { ReviewDepthOverTime } from '@/components/features/insights/shipping/ReviewDepthOverTime';
import { TimeToFirstReview } from '@/components/features/insights/shipping/TimeToFirstReview';
import { TimeToMerge } from '@/components/features/insights/shipping/TimeToMerge';
import { TimeToMergeByType } from '@/components/features/insights/shipping/TimeToMergeByType';
import { formatCount } from '@/lib/insights';
import type { InsightsShipping } from '@/lib/insights-shipping';

type ShippingPanelsProps = {
  shipping: InsightsShipping;
};

export function ShippingPanels({ shipping }: ShippingPanelsProps) {
  return (
    <>
      <InsightsSection title="What the agents ship">
        <PipelineFlow flow={shipping.pipeline} />
        <div className="grid gap-3 lg:grid-cols-2">
          <TimeToMerge
            now={shipping.toMerge}
            changes={shipping.toMergeChanges}
            days={shipping.mergeDays}
          />
          <TimeToMergeByType merges={shipping} />
        </div>
        <ReviewDepthOverTime
          weeks={shipping.depth}
          totals={shipping.depthTotals}
        />
      </InsightsSection>

      <InsightsSection title="Review and approval">
        <div className="grid gap-3 lg:grid-cols-2">
          <TimeToFirstReview days={shipping.reviewDays} />
          <InsightsCard
            title="PRs awaiting first review"
            description="Open pull requests with no human review yet, at each day’s end."
          >
            <DayChart
              label="Pull requests awaiting a first review, day by day"
              points={shipping.reviewDays.map((each) => ({
                day: each.day,
                awaiting: each.awaiting,
              }))}
              series={[
                {
                  key: 'awaiting',
                  label: 'Awaiting',
                  color: 'var(--chart-primary)',
                  as: 'line',
                },
              ]}
              format={formatCount}
              legend={false}
            />
          </InsightsCard>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <ReviewBots bots={shipping.bots} />
          <InsightsCard
            title="Human reviews"
            description="Human reviews on the team’s pull requests per day."
          >
            <DayChart
              label="Reviews by people, day by day"
              points={shipping.reviewDays.map((each) => ({
                day: each.day,
                reviews: each.humanReviews,
              }))}
              series={[
                {
                  key: 'reviews',
                  label: 'Reviews',
                  color: 'var(--chart-2)',
                  as: 'bar',
                },
              ]}
              format={formatCount}
              legend={false}
            />
          </InsightsCard>
        </div>
      </InsightsSection>
    </>
  );
}

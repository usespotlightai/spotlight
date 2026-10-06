import type { Meta, StoryObj } from '@storybook/react-vite';
import type { QueryClient } from '@tanstack/react-query';
import { Route, useSearchParams } from 'react-router';
import { InsightsTabs } from '@/components/features/insights/InsightsTabs';
import { ProductivityTab } from '@/components/features/insights/ProductivityTab';
import { ShippingPanels } from '@/components/features/insights/shipping/ShippingPanels';
import { ScrollArea } from '@/components/shared/ScrollArea';
import { useLines } from '@/hooks/api/useLines';
import { paramsOf, stationNamesOf, viewOf } from '@/lib/insights';
import { insightsAt, seedFlow } from '@/stories/fixtures/insights';
import { seedPullRequests } from '@/stories/fixtures/insights-pull-requests';
import { SHIPPING } from '@/stories/fixtures/insights-shipping';
import { SLUG, TEAM_ID } from '@/stories/fixtures/team';
import { StoryShell } from '@/stories/StoryShell';

function ProposedProductivity() {
  const [params, setParams] = useSearchParams();
  const view = viewOf(params);
  const names = stationNamesOf(useLines(TEAM_ID).data);

  return (
    <div className="flex h-screen min-h-0 flex-col bg-background">
      <InsightsTabs slug={SLUG} teamId={TEAM_ID} view={view} />
      <ScrollArea className="flex-1">
        <main className="flex w-full flex-col gap-3 px-3 pt-2 pb-6">
          <ShippingPanels shipping={SHIPPING} />
          <ProductivityTab
            slug={SLUG}
            teamId={TEAM_ID}
            view={view}
            names={names}
            onView={(next) => setParams(paramsOf(next), { replace: true })}
          />
        </main>
      </ScrollArea>
    </div>
  );
}

const seed = (client: QueryClient) => {
  seedFlow(client);
  seedPullRequests(client);
};

const meta = {
  title: 'Team/Insights/Productivity/What the agents ship (proposed)',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const InTheTab: Story = {
  name: 'In the Productivity tab',
  render: () => (
    <StoryShell at={insightsAt('productivity')} seed={seed}>
      <Route
        path="/w/:slug/team/:teamId/insights"
        element={<ProposedProductivity />}
      />
    </StoryShell>
  ),
};

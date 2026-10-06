import type { Meta, StoryObj } from '@storybook/react-vite';
import type { QueryClient } from '@tanstack/react-query';
import { Route } from 'react-router';
import { BeforeAfterPanel } from '@/components/features/insights/changes/BeforeAfterPanel';
import { useLines } from '@/hooks/api/useLines';
import { DEFAULT_PERIOD, stationNamesOf } from '@/lib/insights';
import { insightsAt, loadInsights } from '@/stories/fixtures/insights';
import {
  EFFORT_CHANGE,
  failBeforeAfter,
  goneBeforeAfter,
  seedBeforeAfter,
} from '@/stories/fixtures/insights-changes';
import { SLUG, TEAM_ID } from '@/stories/fixtures/team';
import { StoryShell } from '@/stories/StoryShell';

function Panel() {
  const names = stationNamesOf(useLines(TEAM_ID).data);

  return (
    <div className="flex h-screen">
      <div className="flex-1" />
      <BeforeAfterPanel
        slug={SLUG}
        teamId={TEAM_ID}
        period={DEFAULT_PERIOD}
        change={EFFORT_CHANGE}
        names={names}
        open
        onClose={() => {}}
      />
    </div>
  );
}

function Showing({ seed }: { seed: (client: QueryClient) => void }) {
  return (
    <StoryShell at={insightsAt('changes')} seed={seed}>
      <Route path="/w/:slug/team/:teamId/insights" element={<Panel />} />
    </StoryShell>
  );
}

const meta = {
  title: 'Team/Insights/Impact',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  render: () => <Showing seed={loadInsights} />,
};

export const Empty: Story = {
  name: 'Change gone',
  render: () => <Showing seed={goneBeforeAfter} />,
};

export const Failed: Story = {
  name: 'Error',
  render: () => <Showing seed={failBeforeAfter} />,
};

export const WithData: Story = {
  render: () => <Showing seed={seedBeforeAfter} />,
};

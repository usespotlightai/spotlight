import type { Meta, StoryObj } from '@storybook/react-vite';
import type { QueryClient } from '@tanstack/react-query';
import { Route } from 'react-router';
import { Insights } from '@/routes/Insights';
import {
  insightsAt,
  loadInsights,
  seedStations,
} from '@/stories/fixtures/insights';
import {
  emptyCandidates,
  failCandidates,
  seedCandidates,
} from '@/stories/fixtures/insights-candidates';
import { seedChanges } from '@/stories/fixtures/insights-changes';
import { StoryPage } from '@/stories/StoryPage';

const routes = (
  <Route path="/w/:slug/team/:teamId/insights" element={<Insights />} />
);

const at = insightsAt('stations');

const alongside =
  (seed: (client: QueryClient) => void) => (client: QueryClient) => {
    seedStations(client);
    seedChanges(client);
    seed(client);
  };

const meta = {
  title: 'Team/Insights/Stations/Candidates',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  render: () => (
    <StoryPage at={at} seed={alongside(loadInsights)}>
      {routes}
    </StoryPage>
  ),
};

export const Empty: Story = {
  render: () => (
    <StoryPage at={at} seed={alongside(emptyCandidates)}>
      {routes}
    </StoryPage>
  ),
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryPage at={at} seed={alongside(failCandidates)}>
      {routes}
    </StoryPage>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryPage at={at} seed={alongside(seedCandidates)}>
      {routes}
    </StoryPage>
  ),
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { Insights } from '@/routes/Insights';
import { insightsAt, loadInsights } from '@/stories/fixtures/insights';
import {
  emptyCandidates,
  failCandidates,
  seedCandidates,
} from '@/stories/fixtures/insights-candidates';
import { StoryPage } from '@/stories/StoryPage';

const routes = (
  <Route path="/w/:slug/team/:teamId/insights" element={<Insights />} />
);

const at = insightsAt('candidates');

const meta = {
  title: 'Team/Insights/Candidates',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  render: () => (
    <StoryPage at={at} seed={loadInsights}>
      {routes}
    </StoryPage>
  ),
};

export const Empty: Story = {
  render: () => (
    <StoryPage at={at} seed={emptyCandidates}>
      {routes}
    </StoryPage>
  ),
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryPage at={at} seed={failCandidates}>
      {routes}
    </StoryPage>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryPage at={at} seed={seedCandidates}>
      {routes}
    </StoryPage>
  ),
};

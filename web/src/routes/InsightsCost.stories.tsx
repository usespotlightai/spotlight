import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { Insights } from '@/routes/Insights';
import {
  emptyCost,
  failCost,
  insightsAt,
  loadInsights,
  seedCost,
} from '@/stories/fixtures/insights';
import { StoryPage } from '@/stories/StoryPage';

const routes = (
  <Route path="/w/:slug/team/:teamId/insights" element={<Insights />} />
);

const at = insightsAt('cost');

const meta = {
  title: 'Team/Insights/Cost',
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
    <StoryPage at={at} seed={emptyCost}>
      {routes}
    </StoryPage>
  ),
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryPage at={at} seed={failCost}>
      {routes}
    </StoryPage>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryPage at={at} seed={seedCost}>
      {routes}
    </StoryPage>
  ),
};

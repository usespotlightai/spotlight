import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { TeamSection } from '@/routes/TeamSection';
import { insightsAt, loadInsights } from '@/stories/fixtures/insights';
import {
  emptyChanges,
  failChanges,
  seedChanges,
} from '@/stories/fixtures/insights-changes';
import { StoryPage } from '@/stories/StoryPage';

const routes = (
  <Route path="/w/:slug/team/:teamId/:section" element={<TeamSection />} />
);

const at = insightsAt('changes');

const meta = {
  title: 'Team/Insights/Changes',
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
    <StoryPage at={at} seed={emptyChanges}>
      {routes}
    </StoryPage>
  ),
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryPage at={at} seed={failChanges}>
      {routes}
    </StoryPage>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryPage at={at} seed={seedChanges}>
      {routes}
    </StoryPage>
  ),
};

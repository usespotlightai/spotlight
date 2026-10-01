import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { TeamSection } from '@/routes/TeamSection';
import {
  emptyPeople,
  failPeople,
  insightsAt,
  loadInsights,
  seedPeople,
} from '@/stories/fixtures/insights';
import { StoryPage } from '@/stories/StoryPage';

const routes = (
  <Route path="/w/:slug/team/:teamId/:section" element={<TeamSection />} />
);

const at = insightsAt('people');

const meta = {
  title: 'Team/Insights/People',
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
    <StoryPage at={at} seed={emptyPeople}>
      {routes}
    </StoryPage>
  ),
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryPage at={at} seed={failPeople}>
      {routes}
    </StoryPage>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryPage at={at} seed={seedPeople}>
      {routes}
    </StoryPage>
  ),
};

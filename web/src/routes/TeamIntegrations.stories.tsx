import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { settingsPath } from '@/lib/team';
import { TeamIntegrations } from '@/routes/TeamIntegrations';
import {
  emptyTeamIntegrations,
  failTeamIntegrations,
  seedTeamIntegrations,
} from '@/stories/fixtures/integrations';
import { SLUG, TEAM_ID } from '@/stories/fixtures/team';
import { StoryPage } from '@/stories/StoryPage';

const at = settingsPath(SLUG, TEAM_ID, 'integrations');

const routes = (
  <Route
    path="/w/:slug/team/:teamId/settings/integrations"
    element={<TeamIntegrations />}
  />
);

const meta = {
  title: 'Team/Settings/Integrations',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  render: () => <StoryPage at={at}>{routes}</StoryPage>,
};

export const Empty: Story = {
  render: () => (
    <StoryPage at={at} seed={emptyTeamIntegrations}>
      {routes}
    </StoryPage>
  ),
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryPage at={at} seed={failTeamIntegrations}>
      {routes}
    </StoryPage>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryPage at={at} seed={seedTeamIntegrations}>
      {routes}
    </StoryPage>
  ),
};

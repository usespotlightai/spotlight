import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { teamSettingsPath } from '@/lib/settings';
import { TeamConnections } from '@/routes/TeamConnections';
import {
  emptyTeamConnections,
  failTeamConnections,
  seedTeamConnections,
} from '@/stories/fixtures/connections';
import { SLUG, TEAM_ID } from '@/stories/fixtures/team';
import { StoryPage } from '@/stories/StoryPage';

const at = teamSettingsPath(SLUG, TEAM_ID, 'connections');

const routes = (
  <Route
    path="/w/:slug/settings/team/:teamId/connections"
    element={<TeamConnections />}
  />
);

const meta = {
  title: 'Settings/Team/Connections',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  render: () => <StoryPage at={at}>{routes}</StoryPage>,
};

export const Empty: Story = {
  render: () => (
    <StoryPage at={at} seed={emptyTeamConnections}>
      {routes}
    </StoryPage>
  ),
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryPage at={at} seed={failTeamConnections}>
      {routes}
    </StoryPage>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryPage at={at} seed={seedTeamConnections}>
      {routes}
    </StoryPage>
  ),
};

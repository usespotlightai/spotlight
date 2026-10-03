import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { teamSectionPath } from '@/lib/team';
import { Agent } from '@/routes/Agent';
import {
  emptyChats,
  failChats,
  SLUG,
  seedChats,
  seedTeam,
  TEAM_ID,
} from '@/stories/fixtures/team-section';
import { StoryPage } from '@/stories/StoryPage';

const routes = <Route path="/w/:slug/team/:teamId/agent" element={<Agent />} />;

const at = teamSectionPath(SLUG, TEAM_ID, 'agent');

const meta = {
  title: 'Team/Agent/Chats',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  render: () => (
    <StoryPage at={at} seed={seedTeam}>
      {routes}
    </StoryPage>
  ),
};

export const Empty: Story = {
  render: () => (
    <StoryPage at={at} seed={emptyChats}>
      {routes}
    </StoryPage>
  ),
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryPage at={at} seed={failChats}>
      {routes}
    </StoryPage>
  ),
};

export const SharingTraces: Story = {
  render: () => (
    <StoryPage
      at={{
        pathname: at,
        state: {
          traces: [
            {
              taskId: 'task_retries',
              title: 'Retry webhook deliveries that time out',
            },
            { taskId: 'task_checks', title: 'Keep checks green on main' },
          ],
        },
      }}
      seed={seedChats}
    >
      {routes}
    </StoryPage>
  ),
};

export const ImprovingAStation: Story = {
  name: 'Improving a station',
  render: () => (
    <StoryPage
      at={{
        pathname: at,
        state: {
          improving: {
            lineId: 'line_delivery',
            lineKey: 'delivery',
            lineName: 'Delivery',
            stationId: 'station_implementation',
            stationKey: 'implementation',
            stationName: 'Implementation',
          },
        },
      }}
      seed={seedChats}
    >
      {routes}
    </StoryPage>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryPage at={at} seed={seedChats}>
      {routes}
    </StoryPage>
  ),
};

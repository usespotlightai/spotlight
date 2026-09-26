import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { taskTracePath } from '@/lib/task';
import { TaskTrace } from '@/routes/TaskTrace';
import { SLUG, TASK_ID, TEAM_ID } from '@/stories/fixtures/board';
import {
  emptyTrace,
  failTrace,
  loadingTrace,
  seedTrace,
} from '@/stories/fixtures/trace';
import { StoryPage } from '@/stories/StoryPage';

const routes = (
  <Route
    path="/w/:slug/team/:teamId/observability/tasks/:taskId"
    element={<TaskTrace />}
  />
);

const at = taskTracePath(SLUG, TEAM_ID, TASK_ID);

const meta = {
  title: 'Team/Observability/Task trace',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  render: () => (
    <StoryPage at={at} seed={loadingTrace}>
      {routes}
    </StoryPage>
  ),
};

export const Empty: Story = {
  render: () => (
    <StoryPage at={at} seed={emptyTrace}>
      {routes}
    </StoryPage>
  ),
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryPage at={at} seed={failTrace}>
      {routes}
    </StoryPage>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryPage at={at} seed={seedTrace}>
      {routes}
    </StoryPage>
  ),
};

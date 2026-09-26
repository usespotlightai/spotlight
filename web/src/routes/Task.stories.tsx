import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { taskPath } from '@/lib/task';
import { Task } from '@/routes/Task';
import {
  failTask,
  MISSING_TASK_ID,
  SLUG,
  seedBoard,
  seedWorkspace,
  TASK_ID,
  TEAM_ID,
} from '@/stories/fixtures/board';
import { StoryPage } from '@/stories/StoryPage';

const routes = (
  <Route path="/w/:slug/team/:teamId/tasks/:taskId" element={<Task />} />
);

const meta = {
  title: 'Team/Lines/Task',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  render: () => (
    <StoryPage at={taskPath(SLUG, TEAM_ID, TASK_ID)} seed={seedWorkspace}>
      {routes}
    </StoryPage>
  ),
};

export const Empty: Story = {
  name: 'Not found',
  render: () => (
    <StoryPage at={taskPath(SLUG, TEAM_ID, MISSING_TASK_ID)} seed={seedBoard}>
      {routes}
    </StoryPage>
  ),
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryPage at={taskPath(SLUG, TEAM_ID, TASK_ID)} seed={failTask}>
      {routes}
    </StoryPage>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryPage at={taskPath(SLUG, TEAM_ID, TASK_ID)} seed={seedBoard}>
      {routes}
    </StoryPage>
  ),
};

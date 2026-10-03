import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { taskTracePath } from '@/lib/task';
import { TaskTrace } from '@/routes/TaskTrace';
import { SLUG, TASK_ID, TEAM_ID } from '@/stories/fixtures/board';
import {
  emptyTrace,
  failJudgeTrace,
  failTrace,
  loadingTrace,
  seedJudgeHiddenTrace,
  seedTrace,
} from '@/stories/fixtures/trace';
import { StoryPage } from '@/stories/StoryPage';

const routes = (
  <Route
    path="/w/:slug/team/:teamId/tasks/:taskId/trace"
    element={<TaskTrace />}
  />
);

const at = taskTracePath(SLUG, TEAM_ID, TASK_ID);

const meta = {
  title: 'Team/Lines/Task trace',
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

const pickingTheJudgedRun: Story['play'] = async ({ canvas, userEvent }) => {
  await userEvent.click(
    await canvas.findByRole('button', { name: 'Implementation' }),
  );
};

export const Judged: Story = {
  render: () => (
    <StoryPage at={at} seed={seedTrace}>
      {routes}
    </StoryPage>
  ),
  play: pickingTheJudgedRun,
};

export const JudgeHidden: Story = {
  name: 'Judge score hidden',
  render: () => (
    <StoryPage at={at} seed={seedJudgeHiddenTrace}>
      {routes}
    </StoryPage>
  ),
  play: pickingTheJudgedRun,
};

export const JudgeFailed: Story = {
  name: 'Judge score error',
  render: () => (
    <StoryPage at={at} seed={failJudgeTrace}>
      {routes}
    </StoryPage>
  ),
  play: pickingTheJudgedRun,
};

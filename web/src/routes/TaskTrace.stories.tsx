import type { Meta, StoryObj } from '@storybook/react-vite';
import { choice, type PageArgs, pageStory } from '@/stories/application';

type TaskTraceArgs = {
  readonly task: 'task_retries' | 'task_billing';
};

const meta = {
  title: 'Team/Lines/Task trace',
  ...pageStory<TaskTraceArgs>({
    states: ['data', 'loading', 'error'],
    at: ({ task }) => `/w/acme/team/team_platform/tasks/${task}/trace`,
    args: { task: 'task_retries' },
    argTypes: {
      task: choice('Task', {
        task_retries: 'Working',
        task_billing: 'Run failed',
      }),
    },
  }),
} satisfies Meta<PageArgs & TaskTraceArgs>;

export default meta;

export const TaskTrace: StoryObj<typeof meta> = { name: 'Task trace' };

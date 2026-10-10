import type { Meta, StoryObj } from '@storybook/react-vite';
import { choice, type PageArgs, pageStory } from '@/stories/application';

type TaskArgs = {
  readonly task: 'task_retries' | 'task_postgres' | 'task_search';
};

const meta = {
  title: 'Team/Lines/Task',
  ...pageStory<TaskArgs>({
    at: ({ task }) => `/w/acme/team/team_platform/tasks/${task}`,
    args: { task: 'task_retries' },
    argTypes: {
      task: choice('Task', {
        task_retries: 'Working',
        task_postgres: 'Waiting for you',
        task_search: 'Completed',
      }),
    },
  }),
} satisfies Meta<PageArgs & TaskArgs>;

export default meta;

export const Task: StoryObj<typeof meta> = {};

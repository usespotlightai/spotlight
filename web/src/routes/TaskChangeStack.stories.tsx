import type { Meta, StoryObj } from '@storybook/react-vite';

import { choice, type PageArgs, pageStory } from '@/stories/application';

type TaskChangeStackArgs = {
  readonly opened: 'run' | 'push';
};

const OPENED_QUERY: Record<TaskChangeStackArgs['opened'], string> = {
  run: '?repository=acme%2Fapi',
  push: '?repository=acme%2Fworker',
};

const meta = {
  title: 'Team/Lines/Task change stack',
  ...pageStory<TaskChangeStackArgs>({
    states: ['data', 'loading', 'error'],
    at: ({ opened }) =>
      `/w/acme/team/team_platform/tasks/task_postgres/changes${OPENED_QUERY[opened]}`,
    args: { opened: 'push' },
    argTypes: {
      opened: choice('Opened', {
        run: 'From a run',
        push: 'From a push',
      }),
    },
  }),
} satisfies Meta<PageArgs & TaskChangeStackArgs>;

export default meta;

export const TaskChangeStack: StoryObj<typeof meta> = {
  name: 'Task change stack',
};

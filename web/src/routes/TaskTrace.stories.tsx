import type { Meta, StoryObj } from '@storybook/react-vite';

import { withJudgeHidden, withoutPeople } from '@/mocks/world/inbox-scores';
import { inboxStore } from '@/mocks/world/inbox-store';
import { choice, type PageArgs, pageStory } from '@/stories/application';

type Verdicts = 'seeded' | 'judge-only' | 'judge-hidden';

const VERDICTS = {
  'judge-only': withoutPeople,
  'judge-hidden': withJudgeHidden,
} as const;

type TaskTraceArgs = {
  readonly task: 'task_retries' | 'task_billing' | 'task_postgres';
  readonly verdicts: Verdicts;
};

const meta = {
  title: 'Team/Lines/Task trace',
  ...pageStory<TaskTraceArgs>({
    states: ['data', 'loading', 'error'],
    at: ({ task }) => `/w/acme/team/team_platform/tasks/${task}/trace`,
    args: { task: 'task_retries', verdicts: 'seeded' },
    argTypes: {
      task: choice('Task', {
        task_retries: 'Working',
        task_billing: 'Run failed',
        task_postgres: 'Judge disagrees with people',
      }),
      verdicts: choice<Verdicts>('Verdicts', {
        seeded: 'As seeded',
        'judge-only': 'Judge only, no word from people',
        'judge-hidden': 'Judge verdicts hidden',
      }),
    },
    world: ({ verdicts }) => {
      if (verdicts === 'seeded') return;

      const { scores } = inboxStore();
      for (const [runId, each] of Object.entries(scores)) {
        scores[runId] = VERDICTS[verdicts](each);
      }
    },
  }),
} satisfies Meta<PageArgs & TaskTraceArgs>;

export default meta;

export const TaskTrace: StoryObj<typeof meta> = { name: 'Task trace' };

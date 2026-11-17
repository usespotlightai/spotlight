import type { Meta, StoryObj } from '@storybook/react-vite';

import { onHoldBy } from '@/mocks/world/holds';
import { MAYA, SAM } from '@/mocks/world/people';
import {
  choice,
  type PageArgs,
  pageStory,
  toggle,
} from '@/stories/application';
import { openDialog } from '@/stories/open-dialog';

type RunArgs = {
  readonly run:
    | 'run_retries_1'
    | 'run_retries_2'
    | 'run_retries_3'
    | 'run_billing_1'
    | 'run_postgres_3';
  readonly memories: boolean;
  readonly hold: 'none' | 'yours' | 'resuming' | 'taken';
};

const meta = {
  title: 'Team/Runs/Run',
  ...pageStory<RunArgs>({
    states: ['data', 'loading', 'error'],
    at: ({ run }) => `/w/acme/team/team_platform/runs/${run}`,
    args: { run: 'run_retries_2', memories: false, hold: 'none' },
    argTypes: {
      run: choice('Run', {
        run_retries_1: 'At a station the task has left',
        run_retries_2: 'Finished',
        run_retries_3: 'Working',
        run_billing_1: 'Run failed',
        run_postgres_3: 'Waiting for you',
      }),
      memories: toggle('Showing the run’s memories'),
      hold: choice('Hold of the working task', {
        none: 'Not on hold',
        yours: 'On hold by you',
        resuming: 'Resume dialog',
        taken: 'On hold by someone else',
      }),
    },
    world: ({ hold }) => {
      if (hold === 'yours' || hold === 'resuming') {
        onHoldBy('team_platform', 'task_retries', SAM);
      }
      if (hold === 'taken') {
        onHoldBy('team_platform', 'task_retries', MAYA);
      }
    },
    script: ({ memories, hold }) => {
      if (hold === 'resuming') {
        return openDialog('Resume');
      }
      return memories
        ? async (screen, user) => {
            await user.click(
              await screen.findByRole('button', { name: 'Memories' }),
            );
          }
        : undefined;
    },
  }),
} satisfies Meta<PageArgs & RunArgs>;

export default meta;

export const Run: StoryObj<typeof meta> = {};

export const ShowingMemories: StoryObj<typeof meta> = {
  name: 'Showing the run’s memories',
  args: { run: 'run_postgres_3', memories: true },
};

export const HeldByYou: StoryObj<typeof meta> = {
  args: { run: 'run_retries_3', hold: 'yours' },
};

export const Resuming: StoryObj<typeof meta> = {
  args: { run: 'run_retries_3', hold: 'resuming' },
};

export const Held: StoryObj<typeof meta> = {
  args: { run: 'run_retries_3', hold: 'taken' },
};

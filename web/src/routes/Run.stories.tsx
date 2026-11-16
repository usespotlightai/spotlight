import type { Meta, StoryObj } from '@storybook/react-vite';

import { MAYA, SAM } from '@/mocks/world/people';
import { takenOverBy } from '@/mocks/world/takeovers';
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
  readonly takeover: 'none' | 'taking' | 'yours' | 'handing-back' | 'taken';
};

const meta = {
  title: 'Team/Runs/Run',
  ...pageStory<RunArgs>({
    states: ['data', 'loading', 'error'],
    at: ({ run }) => `/w/acme/team/team_platform/runs/${run}`,
    args: { run: 'run_retries_2', memories: false, takeover: 'none' },
    argTypes: {
      run: choice('Run', {
        run_retries_1: 'At a station the task has left',
        run_retries_2: 'Finished',
        run_retries_3: 'Working',
        run_billing_1: 'Run failed',
        run_postgres_3: 'Waiting for you',
      }),
      memories: toggle('Showing the run’s memories'),
      takeover: choice('Takeover of the working task', {
        none: 'Not taken over',
        taking: 'Take over dialog',
        yours: 'Taken over by you',
        'handing-back': 'Hand it back dialog',
        taken: 'Taken over by someone else',
      }),
    },
    world: ({ takeover }) => {
      if (takeover === 'yours' || takeover === 'handing-back') {
        takenOverBy('team_platform', 'task_retries', SAM);
      }
      if (takeover === 'taken') {
        takenOverBy('team_platform', 'task_retries', MAYA);
      }
    },
    script: ({ memories, takeover }) => {
      if (takeover === 'taking') {
        return openDialog('Take over');
      }
      if (takeover === 'handing-back') {
        return openDialog('Hand it back');
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

export const TakeOver: StoryObj<typeof meta> = {
  args: { run: 'run_retries_3', takeover: 'taking' },
};

export const TakenOverByYou: StoryObj<typeof meta> = {
  args: { run: 'run_retries_3', takeover: 'yours' },
};

export const HandItBack: StoryObj<typeof meta> = {
  args: { run: 'run_retries_3', takeover: 'handing-back' },
};

export const TakenOver: StoryObj<typeof meta> = {
  args: { run: 'run_retries_3', takeover: 'taken' },
};

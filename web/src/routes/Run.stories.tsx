import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  choice,
  type PageArgs,
  pageStory,
  toggle,
} from '@/stories/application';

type RunArgs = {
  readonly run:
    | 'run_retries_2'
    | 'run_retries_3'
    | 'run_billing_1'
    | 'run_postgres_3';
  readonly memories: boolean;
};

const meta = {
  title: 'Team/Runs/Run',
  ...pageStory<RunArgs>({
    states: ['data', 'loading', 'error'],
    at: ({ run }) => `/w/acme/team/team_platform/runs/${run}`,
    args: { run: 'run_retries_2', memories: false },
    argTypes: {
      run: choice('Run', {
        run_retries_2: 'Finished',
        run_retries_3: 'Working',
        run_billing_1: 'Run failed',
        run_postgres_3: 'Waiting for you',
      }),
      memories: toggle('Showing the run’s memories'),
    },
    script: ({ memories }) =>
      memories
        ? async (screen, user) => {
            await user.click(
              await screen.findByRole('button', { name: 'Memories' }),
            );
          }
        : undefined,
  }),
} satisfies Meta<PageArgs & RunArgs>;

export default meta;

export const Run: StoryObj<typeof meta> = {};

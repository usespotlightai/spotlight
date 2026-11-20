import type { Meta, StoryObj } from '@storybook/react-vite';

import { world } from '@/mocks/world';
import { type PageArgs, pageStory, toggle } from '@/stories/application';

type RunsArgs = { nothingWaiting: boolean };

const answerEveryReview = () => {
  const { runs } = world();
  for (const [taskId, ofTask] of Object.entries(runs)) {
    runs[taskId] = ofTask.map((run) =>
      run.review?.state === 'pending'
        ? { ...run, review: { ...run.review, state: 'answered' } }
        : run,
    );
  }
};

const showFilter = (filter: string) => {
  try {
    localStorage.setItem('spotlight.run-filter', filter);
  } catch {}
};

const meta = {
  title: 'Team/Runs/All runs',
  ...pageStory<RunsArgs>({
    at: '/w/acme/team/team_platform/runs',
    args: { nothingWaiting: false },
    argTypes: { nothingWaiting: toggle('Nothing waiting for you') },
    world: ({ nothingWaiting }) => {
      showFilter(nothingWaiting ? 'waiting-for-you' : 'all');
      if (nothingWaiting) {
        answerEveryReview();
      }
    },
  }),
} satisfies Meta<PageArgs & RunsArgs>;

export default meta;

export const AllRuns: StoryObj<typeof meta> = { name: 'All runs' };

export const NothingWaiting: StoryObj<typeof meta> = {
  name: 'Nothing waiting for you',
  args: { nothingWaiting: true },
};

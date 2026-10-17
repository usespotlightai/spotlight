import type { Meta, StoryObj } from '@storybook/react-vite';
import { insightsPath } from '@/lib/insights';
import {
  formatAuthor,
  formatState,
  PULL_REQUEST_AUTHORS,
  PULL_REQUEST_STATES,
  type PullRequestAuthor,
  type PullRequestState,
} from '@/lib/insights-pull-requests';
import { PLATFORM_ID, SLUG } from '@/mocks/world';
import { choice, type PageArgs, pageStory } from '@/stories/application';

type PullRequestsArgs = {
  readonly author: PullRequestAuthor | 'anyone';
  readonly status: PullRequestState | 'any';
};

const meta = {
  title: 'Team/Insights/Productivity/Pull requests',
  ...pageStory<PullRequestsArgs>({
    at: ({ author, status }) =>
      insightsPath(SLUG, PLATFORM_ID, {
        tab: 'productivity',
        period: '30d',
        filter: {
          ...(author === 'anyone' ? {} : { author }),
          ...(status === 'any' ? {} : { state: status }),
        },
        page: 1,
      }),
    args: { author: 'anyone', status: 'any' },
    argTypes: {
      author: choice('Written by', {
        anyone: 'Anyone',
        ...Object.fromEntries(
          PULL_REQUEST_AUTHORS.map((author) => [author, formatAuthor(author)]),
        ),
      }),
      status: choice('Pull request state', {
        any: 'Any state',
        ...Object.fromEntries(
          PULL_REQUEST_STATES.map((state) => [state, formatState(state)]),
        ),
      }),
    },
  }),
} satisfies Meta<PageArgs & PullRequestsArgs>;

export default meta;

export const PullRequests: StoryObj<typeof meta> = { name: 'Pull requests' };

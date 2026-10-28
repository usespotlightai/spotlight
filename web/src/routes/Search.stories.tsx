import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  CONFIG_PULL_REQUESTS,
  type ConfigPullRequestShown,
} from '@/mocks/world/config-pull-requests';
import { searchSpec } from '@/mocks/world/station-searches';
import { choice, type PageArgs, pageStory } from '@/stories/application';

type SearchArgs = {
  readonly search: 'search_tests_first' | 'search_live';
  readonly pullRequest: ConfigPullRequestShown;
};

const meta = {
  title: 'Team/Lines/Search',
  ...pageStory<SearchArgs>({
    states: ['data', 'loading', 'error'],
    at: ({ search }) =>
      `/w/acme/team/team_platform/lines/line_delivery/stations/station_implementation/searches/${search}`,
    args: { search: 'search_tests_first', pullRequest: 'opened' },
    argTypes: {
      search: choice('Search', {
        search_tests_first: 'Finished',
        search_live: 'Stopped',
      }),
      pullRequest: choice('Config pull request', {
        opened: 'Open',
        closing: 'Closing',
        'closed-stale': 'Closed: live config changed',
        'closed-by-person': 'Closed on GitHub',
        'closed-close-failure': 'Closed: Spotlight could not close it',
        merged: 'Merged',
      }),
    },
    world: ({ pullRequest }) => {
      const picked = searchSpec('search_tests_first')?.candidates.find(
        (each) => each.pullRequest !== null,
      );

      if (picked) {
        picked.pullRequest = CONFIG_PULL_REQUESTS[pullRequest];
      }
    },
  }),
} satisfies Meta<PageArgs & SearchArgs>;

export default meta;

export const Search: StoryObj<typeof meta> = {};

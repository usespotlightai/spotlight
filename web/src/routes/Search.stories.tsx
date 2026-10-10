import type { Meta, StoryObj } from '@storybook/react-vite';
import { choice, type PageArgs, pageStory } from '@/stories/application';

type SearchArgs = {
  readonly search: 'search_tests_first' | 'search_live';
};

const meta = {
  title: 'Team/Lines/Search',
  ...pageStory<SearchArgs>({
    states: ['data', 'loading', 'error'],
    at: ({ search }) =>
      `/w/acme/team/team_platform/lines/line_delivery/stations/station_implementation/searches/${search}`,
    args: { search: 'search_tests_first' },
    argTypes: {
      search: choice('Search', {
        search_tests_first: 'Finished',
        search_live: 'Stopped',
      }),
    },
  }),
} satisfies Meta<PageArgs & SearchArgs>;

export default meta;

export const Search: StoryObj<typeof meta> = {};

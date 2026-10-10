import type { Meta, StoryObj } from '@storybook/react-vite';
import { insightsPath } from '@/lib/insights';
import { PLATFORM_ID, SLUG } from '@/mocks/world';
import { PLATFORM_LINES } from '@/mocks/world/platform';
import { choice, type PageArgs, pageStory } from '@/stories/application';

type StationsArgs = {
  readonly station: string;
};

const meta = {
  title: 'Team/Insights/Stations/By station',
  ...pageStory<StationsArgs>({
    at: ({ station }) =>
      insightsPath(SLUG, PLATFORM_ID, {
        tab: 'stations',
        period: '30d',
        filter: station === 'all' ? {} : { stationId: station },
        page: 1,
      }),
    args: { station: 'all' },
    argTypes: {
      station: choice('Station', {
        all: 'Every station',
        ...Object.fromEntries(
          PLATFORM_LINES.flatMap(({ stations }) =>
            stations.map(({ id, name }) => [id, name]),
          ),
        ),
      }),
    },
  }),
} satisfies Meta<PageArgs & StationsArgs>;

export default meta;

export const ByStation: StoryObj<typeof meta> = { name: 'By station' };

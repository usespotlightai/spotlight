import type { Meta, StoryObj } from '@storybook/react-vite';
import { insightsPath, RUN_ENDINGS, type RunEnding } from '@/lib/insights';
import { PLATFORM_ID, SLUG } from '@/mocks/world';
import { PLATFORM_LINES } from '@/mocks/world/platform';
import { choice, type PageArgs, pageStory } from '@/stories/application';

type RunsArgs = {
  readonly station: string;
  readonly outcome: RunEnding | 'any';
};

const meta = {
  title: 'Team/Insights/Runs',
  ...pageStory<RunsArgs>({
    at: ({ station, outcome }) =>
      insightsPath(SLUG, PLATFORM_ID, {
        tab: 'runs',
        period: '30d',
        filter: {
          ...(station === 'all' ? {} : { stationId: station }),
          ...(outcome === 'any' ? {} : { outcome }),
        },
        page: 1,
      }),
    args: { station: 'all', outcome: 'any' },
    argTypes: {
      station: choice('Station', {
        all: 'Every station',
        ...Object.fromEntries(
          PLATFORM_LINES.flatMap(({ stations }) =>
            stations.map(({ id, name }) => [id, name]),
          ),
        ),
      }),
      outcome: choice('Outcome', {
        any: 'Any outcome',
        ...Object.fromEntries(
          RUN_ENDINGS.map((ending) => [
            ending,
            ending.charAt(0).toUpperCase() + ending.slice(1),
          ]),
        ),
      }),
    },
  }),
} satisfies Meta<PageArgs & RunsArgs>;

export default meta;

export const Runs: StoryObj<typeof meta> = {};

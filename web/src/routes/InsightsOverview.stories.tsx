import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  DEFAULT_PERIOD,
  type InsightsPeriod,
  insightsPath,
  PERIOD_RANGES,
} from '@/lib/insights';
import { PLATFORM_ID, SLUG } from '@/mocks/world';
import { choice, type PageArgs, pageStory } from '@/stories/application';

type OverviewArgs = {
  readonly period: InsightsPeriod;
};

const meta = {
  title: 'Team/Insights/Overview',
  ...pageStory<OverviewArgs>({
    at: ({ period }) =>
      insightsPath(SLUG, PLATFORM_ID, {
        tab: 'overview',
        period,
        filter: {},
        page: 1,
      }),
    args: { period: DEFAULT_PERIOD },
    argTypes: {
      period: choice(
        'Period',
        Object.fromEntries(
          PERIOD_RANGES.map(({ id, label }) => [id, label]),
        ) as Record<InsightsPeriod, string>,
      ),
    },
  }),
} satisfies Meta<PageArgs & OverviewArgs>;

export default meta;

export const Overview: StoryObj<typeof meta> = {};

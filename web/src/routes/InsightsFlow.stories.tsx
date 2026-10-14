import type { Meta, StoryObj } from '@storybook/react-vite';
import { insightsPath } from '@/lib/insights';
import { PLATFORM_ID, SLUG } from '@/mocks/world';
import { type PageArgs, pageStory } from '@/stories/application';

const meta = {
  title: 'Team/Insights/Productivity/Where work waits',
  ...pageStory({
    at: insightsPath(SLUG, PLATFORM_ID, {
      tab: 'productivity',
      period: '30d',
      filter: {},
      page: 1,
    }),
  }),
} satisfies Meta<PageArgs>;

export default meta;

export const WhereWorkWaits: StoryObj<typeof meta> = {
  name: 'Where work waits',
};

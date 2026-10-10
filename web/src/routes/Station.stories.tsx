import type { Meta, StoryObj } from '@storybook/react-vite';
import type { StationTab } from '@/lib/station';
import { choice, type PageArgs, pageStory } from '@/stories/application';

type StationArgs = {
  readonly tab: StationTab;
};

const meta = {
  title: 'Team/Lines/Station',
  ...pageStory<StationArgs>({
    at: ({ tab }) =>
      `/w/acme/team/team_platform/lines/line_delivery/stations/station_implementation${tab === 'overview' ? '' : `/${tab}`}`,
    args: { tab: 'overview' },
    argTypes: {
      tab: choice('Tab', { overview: 'Overview', improve: 'Improve' }),
    },
  }),
} satisfies Meta<PageArgs & StationArgs>;

export default meta;

export const Station: StoryObj<typeof meta> = {};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { choice, type PageArgs, pageStory } from '@/stories/application';

const station =
  '/w/acme/team/team_platform/lines/line_delivery/stations/station_implementation';

type StationArgs = {
  readonly tab: string;
};

const meta = {
  title: 'Team/Lines/Station',
  ...pageStory<StationArgs>({
    at: ({ tab }) => (tab === 'config' ? station : `${station}/${tab}`),
    args: { tab: 'config' },
    argTypes: {
      tab: choice('Tab', {
        config: 'Config',
        activity: 'Activity',
        judge: 'Judge',
      }),
    },
  }),
} satisfies Meta<PageArgs & StationArgs>;

export default meta;

export const Station: StoryObj<typeof meta> = {};

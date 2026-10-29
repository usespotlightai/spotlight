import type { Meta, StoryObj } from '@storybook/react-vite';
import { type PageArgs, pageStory } from '@/stories/application';

const meta = {
  title: 'Team/Lines/Station',
  ...pageStory({
    at: '/w/acme/team/team_platform/lines/line_delivery/stations/station_implementation',
  }),
} satisfies Meta<PageArgs>;

export default meta;

export const Station: StoryObj<typeof meta> = {};

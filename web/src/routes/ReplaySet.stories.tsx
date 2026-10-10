import type { Meta, StoryObj } from '@storybook/react-vite';
import { choice, type PageArgs, pageStory } from '@/stories/application';

type ReplaySetArgs = {
  readonly set: 'set_billing_work' | 'set_docs';
};

const meta = {
  title: 'Team/Lines/Replay set',
  ...pageStory<ReplaySetArgs>({
    at: ({ set }) =>
      `/w/acme/team/team_platform/lines/line_delivery/stations/station_implementation/replay-sets/${set}`,
    args: { set: 'set_billing_work' },
    argTypes: {
      set: choice('Replay set', {
        set_billing_work: 'Replayed',
        set_docs: 'Not replayed yet',
      }),
    },
  }),
} satisfies Meta<PageArgs & ReplaySetArgs>;

export default meta;

export const ReplaySet: StoryObj<typeof meta> = { name: 'Replay set' };

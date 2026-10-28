import type { Meta, StoryObj } from '@storybook/react-vite';
import { setSpec } from '@/mocks/world/station-sets';
import { choice, type PageArgs, pageStory } from '@/stories/application';

type ShownSet = 'set_billing_work' | 'set_triage_billing' | 'empty';

type ReplaySetArgs = {
  readonly set: ShownSet;
};

const EMPTIED = 'set_billing_work';

const IDS: Record<ShownSet, string> = {
  set_billing_work: 'set_billing_work',
  set_triage_billing: 'set_triage_billing',
  empty: EMPTIED,
};

const STATIONS: Record<ShownSet, string> = {
  set_billing_work: 'station_implementation',
  set_triage_billing: 'station_triage',
  empty: 'station_implementation',
};

const meta = {
  title: 'Team/Lines/Replay set',
  ...pageStory<ReplaySetArgs>({
    states: ['data', 'loading', 'error'],
    at: ({ set }) =>
      `/w/acme/team/team_platform/lines/line_delivery/stations/${STATIONS[set]}/replay-sets/${IDS[set]}`,
    args: { set: 'set_billing_work' },
    argTypes: {
      set: choice('Replay set', {
        set_billing_work: 'Implementation',
        set_triage_billing: 'Triage',
        empty: 'Empty, not refreshed yet',
      }),
    },
    world: ({ set }) => {
      const emptied = set === 'empty' ? setSpec(EMPTIED) : undefined;

      if (emptied) {
        emptied.entries = [];
        emptied.refreshedHoursAgo = null;
        emptied.refresh = null;
      }
    },
  }),
} satisfies Meta<PageArgs & ReplaySetArgs>;

export default meta;

export const ReplaySet: StoryObj<typeof meta> = { name: 'Replay set' };

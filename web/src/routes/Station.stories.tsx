import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ImprovementStatus } from '@/lib/station-improvement';
import { shownImprovements } from '@/mocks/world/station-improvement';
import { choice, type PageArgs, pageStory } from '@/stories/application';

type ShownImprovement = 'world' | ImprovementStatus;

type StationArgs = {
  readonly improvement: ShownImprovement;
};

const STATION = 'station_implementation';

const meta = {
  title: 'Team/Lines/Station',
  ...pageStory<StationArgs>({
    at: `/w/acme/team/team_platform/lines/line_delivery/stations/${STATION}`,
    args: { improvement: 'world' },
    argTypes: {
      improvement: choice('Improvement', {
        world: 'As the mock world has it',
        searching: 'Searching',
        picking: 'Choosing a config',
        'pull-request-open': 'Pull request open',
        improved: 'Improved',
        'not-improving': 'Not improving',
        waiting: 'Waiting for next check',
        off: 'Not searching',
        'not-started': 'No runs yet',
      }),
    },
    world: ({ improvement }) => {
      if (improvement !== 'world') {
        shownImprovements().set(STATION, improvement);
      }
    },
  }),
} satisfies Meta<PageArgs & StationArgs>;

export default meta;

export const Station: StoryObj<typeof meta> = {};

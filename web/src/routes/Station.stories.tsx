import type { Meta, StoryObj } from '@storybook/react-vite';

import { type JudgeShape, judgeShape } from '@/mocks/world/station-judge';
import { choice, type PageArgs, pageStory } from '@/stories/application';

const station =
  '/w/acme/team/team_platform/lines/line_delivery/stations/station_implementation';

type StationArgs = {
  readonly tab: string;
  readonly agreement: JudgeShape;
};

const meta = {
  title: 'Team/Lines/Station',
  ...pageStory<StationArgs>({
    at: ({ tab }) => (tab === 'config' ? station : `${station}/${tab}`),
    args: { tab: 'config', agreement: 'seeded' },
    argTypes: {
      tab: choice('Tab', {
        config: 'Config',
        activity: 'Activity',
        judge: 'Judge',
      }),
      agreement: choice('Judge agreement', {
        seeded: 'As seeded',
        few: 'Too few runs (3)',
        healthy: 'Healthy (60 runs)',
        poor: 'Poor (40 runs)',
        claims: 'Claims (36 runs)',
        number: 'Scale of 1 to 5 (48 runs)',
      }),
    },
    world: ({ agreement }) => {
      judgeShape().shape = agreement;
    },
  }),
} satisfies Meta<PageArgs & StationArgs>;

export default meta;

export const Station: StoryObj<typeof meta> = {};

export const JudgeTooFewRuns: StoryObj<typeof meta> = {
  args: { tab: 'judge', agreement: 'few' },
};

export const JudgeHealthy: StoryObj<typeof meta> = {
  args: { tab: 'judge', agreement: 'healthy' },
};

export const JudgePoor: StoryObj<typeof meta> = {
  args: { tab: 'judge', agreement: 'poor' },
};

export const JudgeClaims: StoryObj<typeof meta> = {
  args: { tab: 'judge', agreement: 'claims' },
};

export const JudgeNumbers: StoryObj<typeof meta> = {
  args: { tab: 'judge', agreement: 'number' },
};

export const ConfigTooFewRuns: StoryObj<typeof meta> = {
  args: { tab: 'config', agreement: 'few' },
};

export const ConfigHealthy: StoryObj<typeof meta> = {
  args: { tab: 'config', agreement: 'healthy' },
};

export const ConfigPoor: StoryObj<typeof meta> = {
  args: { tab: 'config', agreement: 'poor' },
};

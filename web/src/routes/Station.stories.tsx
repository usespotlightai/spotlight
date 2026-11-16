import type { Meta, StoryObj } from '@storybook/react-vite';

import { type JudgeShape, judgeShape } from '@/mocks/world/station-judge';
import { choice, type PageArgs, pageStory } from '@/stories/application';

const stationPath = (station: string) =>
  `/w/acme/team/team_platform/lines/line_delivery/stations/${station}`;

type StationArgs = {
  readonly tab: string;
  readonly station: string;
  readonly agreement: JudgeShape;
};

const meta = {
  title: 'Team/Lines/Station',
  ...pageStory<StationArgs>({
    at: ({ tab, station }) =>
      tab === 'config'
        ? stationPath(station)
        : `${stationPath(station)}/${tab}`,
    args: {
      tab: 'config',
      station: 'station_implementation',
      agreement: 'seeded',
    },
    argTypes: {
      tab: choice('Tab', {
        config: 'Config',
        activity: 'Activity',
        judge: 'Judge',
      }),
      station: choice('Station', {
        station_implementation: 'Implementation, with a judge',
        station_review: 'Code Review, with no judge',
      }),
      agreement: choice('Judge agreement', {
        seeded: 'As seeded',
        unjudged: 'No judged runs',
        few: 'Too few runs (3)',
        healthy: 'Healthy (60 runs)',
        poor: 'Poor (40 runs)',
        claims: 'Agreement by claim (36 runs)',
        versions: 'Three claims versions',
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

export const JudgeVersions: StoryObj<typeof meta> = {
  args: { tab: 'judge', agreement: 'versions' },
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

export const JudgeNoJudgedRuns: StoryObj<typeof meta> = {
  args: { tab: 'judge', agreement: 'unjudged' },
};

export const ConfigNoJudge: StoryObj<typeof meta> = {
  args: { tab: 'config', station: 'station_review' },
};

import type {
  LineResponseDto,
  StationResponseDto,
  TaskResponseDto,
  TaskRunResponseDto,
} from '@/lib/api';
import { hoursAgo } from '@/mocks/clock';
import { PRIYA } from '@/mocks/world/people';
import { runStationOf, station } from '@/mocks/world/stations';

export const GROWTH_ID = 'team_growth';
export const EXPERIMENTS_ID = 'line_experiments';

const STATIONS: StationResponseDto[] = [
  station({
    id: 'station_ideas',
    key: 'ideas',
    name: 'Ideas',
    position: 0,
    color: '#a3a8b0',
    kind: 'backlog',
  }),
  station({
    id: 'station_design',
    key: 'design',
    name: 'Design',
    position: 1,
    color: '#b36ae2',
    description:
      'Writes the experiment: the change, the metric and the stop rule.',
    harness: 'claude-code',
    model: 'opus',
    effort: 'medium',
    judge: {
      rubric:
        '## A good experiment design\n\nJudge the design as written, not the result the experiment would get. A claim the design leaves to later is not met.',
      claims: [
        'Names the one change it tests',
        'Names the metric and what it reads today',
        'Sets a stop rule',
      ],
      passShare: 1,
      sample: 1,
      trust: 0.6,
    },
  }),
  station({
    id: 'station_build',
    key: 'build',
    name: 'Build',
    position: 2,
    color: '#5c66d9',
    description: 'Builds the variant behind a flag.',
    harness: 'claude-code',
    model: 'sonnet',
    effort: 'high',
  }),
  station({
    id: 'station_shipped',
    key: 'shipped',
    name: 'Shipped',
    position: 3,
    color: '#3fa66a',
    kind: 'completed',
  }),
];

export const GROWTH_LINES: LineResponseDto[] = [
  {
    id: EXPERIMENTS_ID,
    key: 'experiments',
    name: 'Experiments',
    stations: STATIONS,
    reactions: [],
    repositories: ['acme/web'],
    source: null,
    replayCheck: null,
  },
];

const task = (
  over: Partial<TaskResponseDto> & {
    id: string;
    title: string;
    stationId: string;
  },
): TaskResponseDto => ({
  revision: 0,
  description: null,
  attachments: [],
  createdAt: hoursAgo(24),
  running: false,
  awaitingReview: null,
  pullRequest: null,
  raisedBy: PRIYA,
  assignee: PRIYA,
  note: null,
  ...over,
});

export const GROWTH_TASKS: TaskResponseDto[] = [
  task({
    id: 'task_onboarding_copy',
    title: 'Test a shorter onboarding checklist',
    stationId: 'station_design',
    awaitingReview: { conversationId: 'task_onboarding_copy:0' },
    createdAt: hoursAgo(20),
  }),
  task({
    id: 'task_pricing_toggle',
    title: 'Annual pricing toggle on the plans page',
    stationId: 'station_build',
    running: true,
    createdAt: hoursAgo(40),
  }),
  task({
    id: 'task_signup_survey',
    title: 'Ask new signups where they heard of us',
    stationId: 'station_design',
    running: true,
    createdAt: hoursAgo(3),
    description:
      'Most signups never say where they found us. Try one optional question on the welcome screen.',
  }),
  task({
    id: 'task_referral',
    title: 'Referral link in the invite email',
    stationId: 'station_shipped',
    pullRequest: 'https://github.com/acme/web/pull/88',
    createdAt: hoursAgo(300),
  }),
];

const run = (
  over: Partial<TaskRunResponseDto> & {
    id: string;
    stationId: string;
    startedHoursAgo: number;
    tookHours: number;
  },
): TaskRunResponseDto => {
  const { stationId, startedHoursAgo, tookHours, ...rest } = over;

  return {
    state: 'completed',
    attempt: 1,
    exitCode: 0,
    startedAt: hoursAgo(startedHoursAgo),
    updatedAt: hoursAgo(startedHoursAgo - tookHours),
    harness: 'claude-code',
    image: null,
    station: runStationOf(STATIONS, stationId),
    review: null,
    ...rest,
  };
};

export const GROWTH_RUNS: Record<string, TaskRunResponseDto[]> = {
  task_onboarding_copy: [
    run({
      id: 'run_onboarding_1',
      stationId: 'station_design',
      startedHoursAgo: 2,
      tookHours: 0.3,
      review: { state: 'pending', conversationId: 'task_onboarding_copy:0' },
    }),
  ],
  task_pricing_toggle: [
    run({
      id: 'run_pricing_2',
      stationId: 'station_build',
      state: 'claimed',
      exitCode: null,
      startedHoursAgo: 0.4,
      tookHours: 0.1,
    }),
    run({
      id: 'run_pricing_1',
      stationId: 'station_design',
      startedHoursAgo: 38,
      tookHours: 0.3,
    }),
  ],
  task_signup_survey: [
    run({
      id: 'run_survey_1',
      stationId: 'station_design',
      state: 'claimed',
      exitCode: null,
      startedHoursAgo: 0.13,
      tookHours: 0.1,
    }),
  ],
  task_referral: [
    run({
      id: 'run_referral_1',
      stationId: 'station_build',
      startedHoursAgo: 290,
      tookHours: 1,
    }),
  ],
};

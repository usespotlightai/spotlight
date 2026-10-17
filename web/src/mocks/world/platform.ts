import type {
  LineResponseDto,
  StationResponseDto,
  TaskResponseDto,
  TaskRunResponseDto,
} from '@/lib/api';
import { hoursAgo } from '@/mocks/clock';
import { MAYA, PRIYA, SAM, TOM } from '@/mocks/world/people';
import { runStationOf, station } from '@/mocks/world/stations';

export const PLATFORM_ID = 'team_platform';
export const DELIVERY_ID = 'line_delivery';
export const INCIDENTS_ID = 'line_incidents';

const DELIVERY_STATIONS: StationResponseDto[] = [
  station({
    id: 'station_backlog',
    key: 'backlog',
    name: 'Backlog',
    position: 0,
    color: '#a3a8b0',
    kind: 'backlog',
  }),
  station({
    id: 'station_triage',
    key: 'triage',
    name: 'Triage',
    position: 1,
    color: '#edc12b',
    description: 'Reproduces a report and decides what the fix needs.',
    harness: 'claude-code',
    model: 'haiku',
    effort: 'low',
    agentPrompt:
      '## Role\n\nReproduce the report on the task.\n\n- Name the failing path\n- Say what a fix needs, not how',
  }),
  station({
    id: 'station_spec',
    key: 'spec',
    name: 'Spec',
    position: 2,
    color: '#b36ae2',
    description: 'Turns a triaged task into a spec someone can build from.',
    harness: 'claude-code',
    model: 'opus',
    effort: 'medium',
    agentPrompt:
      '## Role\n\nWrite the spec for the task.\n\n- List what changes and what stays\n- Ask when the report is unclear',
  }),
  station({
    id: 'station_implementation',
    key: 'implementation',
    name: 'Implementation',
    position: 3,
    color: '#5c66d9',
    description: 'Where a spec becomes a pull request.',
    harness: 'claude-code',
    model: 'sonnet',
    effort: 'high',
    agentPrompt:
      '## Role\n\nImplement the spec on the task.\n\n- Read the tests that cover the change first, and write the failing one before the fix\n- Keep the change small\n- Ask when the spec is unclear',
    skills: ['grafana-dashboards'],
    judge: {
      rubric:
        '## A good run\n\n- Changes only what the spec requires\n- Leaves the tests passing\n- Says what it could not do',
      claims: [],
      passShare: 1,
      sample: 0.2,
      trust: 0.6,
    },
    alerts: [
      {
        measure: 'sent_back_rate',
        risesBy: 0.2,
        above: null,
        fallsBy: null,
        below: null,
        over: 20,
      },
      {
        measure: 'cost_per_run',
        risesBy: null,
        above: 2,
        fallsBy: null,
        below: null,
        over: 10,
      },
    ],
  }),
  station({
    id: 'station_review',
    key: 'review',
    name: 'Code Review',
    position: 4,
    color: '#56b98d',
    description: 'Reviews the pull request before a person merges it.',
    harness: 'codex',
    model: 'gpt-5',
    effort: 'medium',
    agentPrompt:
      '## Role\n\nReview the pull request on the task.\n\n- Flag what would break in production\n- Approve only what you would merge',
  }),
  station({
    id: 'station_completed',
    key: 'completed',
    name: 'Completed',
    position: 5,
    color: '#3fa66a',
    kind: 'completed',
  }),
];

const INCIDENT_STATIONS: StationResponseDto[] = [
  station({
    id: 'station_incoming',
    key: 'incoming',
    name: 'Incoming',
    position: 0,
    color: '#a3a8b0',
    kind: 'backlog',
  }),
  station({
    id: 'station_investigate',
    key: 'investigate',
    name: 'Investigate',
    position: 1,
    color: '#e5484d',
    description: 'Finds the cause of an alert from logs and dashboards.',
    harness: 'claude-code',
    model: 'sonnet',
    effort: 'high',
    skills: ['grafana-dashboards'],
    agentPrompt:
      '## Role\n\nFind the cause of the alert on the task.\n\n- Quote the log lines you rely on\n- Say how sure you are',
  }),
  station({
    id: 'station_mitigate',
    key: 'mitigate',
    name: 'Mitigate',
    position: 2,
    color: '#f76b15',
    description: 'Proposes the smallest change that stops the bleeding.',
    harness: 'claude-code',
    model: 'sonnet',
    effort: 'medium',
  }),
  station({
    id: 'station_resolved',
    key: 'resolved',
    name: 'Resolved',
    position: 3,
    color: '#3fa66a',
    kind: 'completed',
  }),
];

export const PLATFORM_LINES: LineResponseDto[] = [
  {
    id: DELIVERY_ID,
    key: 'delivery',
    name: 'Delivery',
    stations: DELIVERY_STATIONS,
    reactions: [],
    repositories: ['acme/api', 'acme/worker'],
    source: { repository: 'acme/config', path: 'lines/delivery.tf' },
    replayCheck: {
      maxRegressions: 0,
      ceiling: 10,
      currency: 'USD',
      minGain: 0.05,
    },
  },
  {
    id: INCIDENTS_ID,
    key: 'incidents',
    name: 'Incidents',
    stations: INCIDENT_STATIONS,
    reactions: [],
    repositories: ['acme/api', 'acme/infra'],
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
  raisedBy: SAM,
  assignee: null,
  note: null,
  ...over,
});

export const PLATFORM_TASKS: TaskResponseDto[] = [
  task({
    id: 'task_checkout',
    title: 'Flaky checkout test on CI',
    stationId: 'station_triage',
    raisedBy: TOM,
    createdAt: hoursAgo(5),
    description:
      'The `checkout completes with a saved card` test fails about one run in five on CI, never locally.',
  }),
  task({
    id: 'task_rate_limits',
    title: 'Add rate limiting to the public API',
    stationId: 'station_spec',
    awaitingReview: { conversationId: 'task_rate_limits:0' },
    assignee: SAM,
    createdAt: hoursAgo(50),
    description:
      'Partners hit the public API in bursts. Limit each token to a fair share without breaking the dashboard.',
  }),
  task({
    id: 'task_retries',
    title: 'Drain the stuck retry queues',
    stationId: 'station_implementation',
    running: true,
    assignee: MAYA,
    createdAt: hoursAgo(30),
    description:
      'Webhook deliveries have been failing since the queue worker was redeployed on Friday.\n\n- Find the retry queues that contain jobs that never ran\n- Replay what can still be delivered\n- Stop retrying endpoints that answer `410 Gone`',
  }),
  task({
    id: 'task_billing',
    title: 'Reconcile open invoices after the retry drain',
    stationId: 'station_implementation',
    raisedBy: PRIYA,
    createdAt: hoursAgo(28),
  }),
  task({
    id: 'task_postgres',
    title: 'Upgrade the Postgres driver',
    stationId: 'station_review',
    awaitingReview: { conversationId: 'task_postgres:0' },
    assignee: MAYA,
    createdAt: hoursAgo(96),
    pullRequest: 'https://github.com/acme/api/pull/431',
  }),
  task({
    id: 'task_tokens',
    title: 'Document runner token rotation',
    stationId: 'station_backlog',
    createdAt: hoursAgo(200),
  }),
  task({
    id: 'task_search',
    title: 'Speed up workspace search',
    stationId: 'station_completed',
    pullRequest: 'https://github.com/acme/api/pull/412',
    createdAt: hoursAgo(400),
  }),
  task({
    id: 'task_latency',
    title: 'p99 latency alert on the payments API',
    stationId: 'station_investigate',
    running: true,
    raisedBy: TOM,
    assignee: TOM,
    createdAt: hoursAgo(2),
    description:
      'Grafana fired `payments-api p99 > 800ms` at 09:12. It cleared twice and came back.',
  }),
  task({
    id: 'task_disk',
    title: 'Worker disk filling up on eu-west-1',
    stationId: 'station_resolved',
    raisedBy: TOM,
    createdAt: hoursAgo(80),
  }),
];

const DELIVERY = DELIVERY_STATIONS;
const INCIDENTS = INCIDENT_STATIONS;

const run = (
  stations: readonly StationResponseDto[],
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
    station: runStationOf(stations, stationId),
    review: null,
    ...rest,
  };
};

export const PLATFORM_RUNS: Record<string, TaskRunResponseDto[]> = {
  task_checkout: [
    run(DELIVERY, {
      id: 'run_checkout_1',
      stationId: 'station_triage',
      state: 'claimed',
      exitCode: null,
      startedHoursAgo: 0.3,
      tookHours: 0.1,
    }),
  ],
  task_rate_limits: [
    run(DELIVERY, {
      id: 'run_rate_limits_2',
      stationId: 'station_spec',
      startedHoursAgo: 3,
      tookHours: 0.4,
      review: { state: 'pending', conversationId: 'task_rate_limits:0' },
    }),
    run(DELIVERY, {
      id: 'run_rate_limits_1',
      stationId: 'station_triage',
      startedHoursAgo: 49,
      tookHours: 0.2,
    }),
  ],
  task_retries: [
    run(DELIVERY, {
      id: 'run_retries_3',
      stationId: 'station_implementation',
      state: 'claimed',
      exitCode: null,
      startedHoursAgo: 0.2,
      tookHours: 0.1,
    }),
    run(DELIVERY, {
      id: 'run_retries_2',
      stationId: 'station_spec',
      startedHoursAgo: 4,
      tookHours: 0.3,
      review: { state: 'answered', conversationId: 'task_retries:0' },
    }),
    run(DELIVERY, {
      id: 'run_retries_1',
      stationId: 'station_triage',
      startedHoursAgo: 6,
      tookHours: 0.1,
    }),
  ],
  task_billing: [
    run(DELIVERY, {
      id: 'run_billing_1',
      stationId: 'station_implementation',
      state: 'failed',
      exitCode: 1,
      startedHoursAgo: 20,
      tookHours: 0.6,
    }),
  ],
  task_postgres: [
    run(DELIVERY, {
      id: 'run_postgres_3',
      stationId: 'station_review',
      harness: 'codex',
      startedHoursAgo: 8,
      tookHours: 0.3,
      review: { state: 'pending', conversationId: 'task_postgres:0' },
    }),
    run(DELIVERY, {
      id: 'run_postgres_2',
      stationId: 'station_implementation',
      startedHoursAgo: 30,
      tookHours: 1.2,
    }),
    run(DELIVERY, {
      id: 'run_postgres_1',
      stationId: 'station_spec',
      startedHoursAgo: 90,
      tookHours: 0.4,
    }),
  ],
  task_search: [
    run(DELIVERY, {
      id: 'run_search_3',
      stationId: 'station_review',
      harness: 'codex',
      startedHoursAgo: 380,
      tookHours: 0.2,
    }),
    run(DELIVERY, {
      id: 'run_search_2',
      stationId: 'station_implementation',
      startedHoursAgo: 390,
      tookHours: 1.5,
    }),
  ],
  task_latency: [
    run(INCIDENTS, {
      id: 'run_latency_1',
      stationId: 'station_investigate',
      state: 'claimed',
      exitCode: null,
      startedHoursAgo: 0.5,
      tookHours: 0.2,
    }),
  ],
  task_disk: [
    run(INCIDENTS, {
      id: 'run_disk_2',
      stationId: 'station_mitigate',
      startedHoursAgo: 76,
      tookHours: 0.5,
    }),
    run(INCIDENTS, {
      id: 'run_disk_1',
      stationId: 'station_investigate',
      startedHoursAgo: 79,
      tookHours: 0.8,
    }),
  ],
};

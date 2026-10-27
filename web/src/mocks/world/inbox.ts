import type {
  InboxItemResponseDto,
  InboxNoticeResponseDto,
  ListInboxResponse,
  NoteResponseDto,
} from '@/lib/api';
import { daysAgo, hoursAgo } from '@/mocks/clock';
import { GROWTH_ID } from '@/mocks/world/growth';
import {
  type AlertFiring,
  alertFiring,
  costAlertFiring,
} from '@/mocks/world/inbox-alert';
import {
  minutesAfter,
  placeOf,
  runEnded,
  runsOfTask,
  seededTask,
} from '@/mocks/world/inbox-places';
import { history } from '@/mocks/world/insights-history';
import { isCoreTask, pastTaskOf } from '@/mocks/world/past-work';
import { PLATFORM_ID } from '@/mocks/world/platform';
import { notesOfRun, type StoryNote } from '@/mocks/world/run-stories';
import { onEarlierRubric } from '@/mocks/world/station-judge';

export type InboxEntry = ListInboxResponse[number];

export const MEMORIES_REQUEST_ID = 'request_retries_memories';
export const ALERT_REQUEST_ID = 'request_sent_back_alert';
export const GRADE_REQUEST_ID = 'request_postgres_grade';
export const GRADED_REQUEST_ID = 'request_search_grade';
export const STALLED_NOTICE_ID = 'notice_search_stalled';
export const FINISHED_NOTICE_ID = 'notice_search_finished';
export const ALERT_ID = 'alert_sent_back';
export const COST_ALERT_REQUEST_ID = 'request_cost_alert';
export const COST_ALERT_ID = 'alert_cost_per_run';
export const DECIDED_MEMORIES_REQUEST_ID = 'request_disk_memories';
export const FIVE_POINT_GRADE_REQUEST_ID = 'request_earlier_rubric_grade';
export const CLAIMS_GRADE_REQUEST_ID = 'request_pricing_grade';
export const SETUP_ITEM_ID = 'task_setup_platform:0';

const numbered = (notes: readonly StoryNote[]): NoteResponseDto[] =>
  notes.map((note, position) => ({ ...note, position }));

const notesOfTask = (taskId: string): StoryNote[] =>
  [...runsOfTask(taskId)]
    .sort((one, other) => one.startedAt.localeCompare(other.startedAt))
    .flatMap(notesOfRun);

type Conversation = Omit<Partial<InboxItemResponseDto>, 'notes'> & {
  readonly taskId: string;
  readonly teamId: string;
  readonly askedIn: string;
  readonly originIn: string;
};

const conversation = ({
  taskId,
  teamId,
  askedIn,
  originIn,
  ...over
}: Conversation): InboxItemResponseDto => {
  const task = seededTask(taskId);
  const at = placeOf(askedIn);
  const currentStation = placeOf(task.stationId);
  const numberedNotes = numbered(notesOfTask(taskId));

  return {
    kind: 'task',
    id: `${taskId}:0`,
    taskId,
    teamId,
    title: task.title,
    description: task.description,
    attachments: [],
    station: at.name,
    stationColor: at.color,
    stationPosition: at.position,
    stationCount: at.count,
    originStation: placeOf(originIn),
    currentStation: {
      name: currentStation.name,
      color: currentStation.color,
      position: currentStation.position,
    },
    createdAt: task.createdAt,
    askedAt: numberedNotes[numberedNotes.length - 1]?.at ?? task.createdAt,
    resolved: false,
    progress: null,
    runId: null,
    unread: false,
    briefing: [task.title, task.description].filter(Boolean).join('\n\n'),
    failure: null,
    inboxRequest: null,
    notes: numberedNotes,
    ...over,
  };
};

type InboxRequestItem = Pick<
  InboxItemResponseDto,
  'id' | 'taskId' | 'teamId' | 'askedAt'
> &
  Partial<InboxItemResponseDto> & {
    readonly inboxRequest: NonNullable<InboxItemResponseDto['inboxRequest']>;
  };

const inboxRequestOf = ({
  id,
  taskId,
  teamId,
  askedAt,
  inboxRequest,
  ...over
}: InboxRequestItem): InboxItemResponseDto => {
  const task = pastTaskOf(taskId) ?? seededTask(taskId);
  const currentStation = placeOf(task.stationId);
  const place = {
    name: currentStation.name,
    color: currentStation.color,
    position: currentStation.position,
  };

  return {
    kind: 'task',
    id,
    taskId,
    teamId,
    title: task.title,
    description: task.description,
    attachments: [],
    station: place.name,
    stationColor: place.color,
    stationPosition: place.position,
    stationCount: currentStation.count,
    originStation: place,
    currentStation: place,
    createdAt: task.createdAt,
    askedAt,
    resolved: false,
    progress: null,
    runId: null,
    unread: false,
    briefing: null,
    failure: null,
    inboxRequest,
    notes: [],
    ...over,
  };
};

const SEARCH_LINK =
  'lines/line_delivery/stations/station_implementation/searches';

const NOTICES: InboxNoticeResponseDto[] = [
  {
    kind: 'notice',
    id: STALLED_NOTICE_ID,
    teamId: PLATFORM_ID,
    form: 'ended',
    headline:
      'The search for a better Implementation config stalled: nothing left the config can fix',
    points: [
      'Two iterations in a row found nothing better, so its agent looked into the 3 tasks the best config so far still fails, and found none a change to the config could fix. The search stopped, keeping the $14.20 it did not spend.',
      'Fix the station’s check (Reconcile open invoices after the retry drain): the reconcile script needs the billing database, which the runner cannot reach.',
      'Fix the judge’s rubric (Drain the stuck retry queues): it wants a test for every change, but restoring `RETRY_CONCURRENCY` is a config change with nothing to test.',
      'Take the task out of the replay set, or reword it (Upgrade the Postgres driver): its migration rewrites 1.3M invoice rows, which no candidate finishes inside the run’s time limit.',
    ],
    link: `${SEARCH_LINK}/search_live`,
    linkLabel: 'Open the search',
    askedAt: hoursAgo(1.2),
    unread: true,
    resolved: false,
  },
  {
    kind: 'notice',
    id: FINISHED_NOTICE_ID,
    teamId: PLATFORM_ID,
    form: 'ended',
    headline:
      'The search for a better Implementation config finished: writing the tests first passes 2 more tasks',
    points: [
      'Four iterations tried 11 configs against Billing work. The best one tells the agent to write a failing test before it changes any code.',
      'It passes 7 of 9 tasks, where the station’s config passes 5, for $0.21 more a run.',
      'Adopt it from the search, or keep looking with a larger replay set.',
    ],
    link: `${SEARCH_LINK}/search_tests_first`,
    linkLabel: 'Open the search',
    askedAt: daysAgo(3),
    unread: false,
    resolved: true,
  },
];

const OPEN_CONVERSATIONS = (): InboxItemResponseDto[] => [
  conversation({
    taskId: 'task_latency',
    teamId: PLATFORM_ID,
    askedIn: 'station_investigate',
    originIn: 'station_incoming',
    runId: 'run_latency_1',
    unread: true,
  }),
  conversation({
    taskId: 'task_onboarding_copy',
    teamId: GROWTH_ID,
    askedIn: 'station_design',
    originIn: 'station_ideas',
    unread: true,
  }),
  conversation({
    taskId: 'task_rate_limits',
    teamId: PLATFORM_ID,
    askedIn: 'station_spec',
    originIn: 'station_triage',
    unread: true,
  }),
  conversation({
    taskId: 'task_checkout',
    teamId: PLATFORM_ID,
    askedIn: 'station_triage',
    originIn: 'station_backlog',
    runId: 'run_checkout_1',
    unread: true,
  }),
  conversation({
    taskId: 'task_pricing_toggle',
    teamId: GROWTH_ID,
    askedIn: 'station_build',
    originIn: 'station_ideas',
    runId: 'run_pricing_2',
  }),
  conversation({
    taskId: 'task_signup_survey',
    teamId: GROWTH_ID,
    askedIn: 'station_design',
    originIn: 'station_ideas',
    runId: 'run_survey_1',
    unread: true,
  }),
  conversation({
    taskId: 'task_billing',
    teamId: PLATFORM_ID,
    askedIn: 'station_implementation',
    originIn: 'station_implementation',
    failure: { source: 'run', code: 'exited', occurrences: 1 },
  }),
  conversation({
    taskId: 'task_postgres',
    teamId: PLATFORM_ID,
    askedIn: 'station_review',
    originIn: 'station_spec',
  }),
];

const RESOLVED_CONVERSATIONS = (): InboxItemResponseDto[] => [
  conversation({
    taskId: 'task_retries',
    teamId: PLATFORM_ID,
    askedIn: 'station_spec',
    originIn: 'station_triage',
    resolved: true,
  }),
  conversation({
    taskId: 'task_disk',
    teamId: PLATFORM_ID,
    askedIn: 'station_mitigate',
    originIn: 'station_incoming',
    resolved: true,
  }),
  conversation({
    taskId: 'task_search',
    teamId: PLATFORM_ID,
    askedIn: 'station_review',
    originIn: 'station_backlog',
    resolved: true,
  }),
  conversation({
    taskId: 'task_referral',
    teamId: GROWTH_ID,
    askedIn: 'station_build',
    originIn: 'station_ideas',
    resolved: true,
  }),
];

const firedAtOf = ({ run }: AlertFiring) =>
  minutesAfter(run.endedAt ?? new Date(run.at).toISOString(), 2);

const alertInboxRequest = (
  id: string,
  alertId: string,
  firing: AlertFiring | null,
): InboxItemResponseDto[] =>
  firing
    ? [
        inboxRequestOf({
          id,
          taskId: firing.run.taskId,
          teamId: PLATFORM_ID,
          askedAt: firedAtOf(firing),
          resolved: firing.resolved !== null,
          unread: firing.resolved === null,
          inboxRequest: { form: 'alert', about: alertId },
        }),
      ]
    : [];

const earlierRubricRun = () =>
  history().runs.find(
    (run) =>
      run.teamId === PLATFORM_ID &&
      run.stationId === 'station_implementation' &&
      run.judge !== null &&
      !isCoreTask(run.taskId) &&
      onEarlierRubric(run.at),
  );

const earlierRubricGrade = (): InboxItemResponseDto[] => {
  const run = earlierRubricRun();

  return run
    ? [
        inboxRequestOf({
          id: FIVE_POINT_GRADE_REQUEST_ID,
          taskId: run.taskId,
          teamId: PLATFORM_ID,
          askedAt: minutesAfter(
            run.endedAt ?? new Date(run.at).toISOString(),
            4,
          ),
          inboxRequest: { form: 'grade', about: run.runId },
        }),
      ]
    : [];
};

const INBOX_REQUESTS = (): InboxItemResponseDto[] => [
  inboxRequestOf({
    id: MEMORIES_REQUEST_ID,
    taskId: 'task_retries',
    teamId: PLATFORM_ID,
    askedAt: minutesAfter(runEnded('run_retries_2'), 3),
    unread: true,
    inboxRequest: { form: 'memories', about: 'run_retries_2' },
  }),
  inboxRequestOf({
    id: DECIDED_MEMORIES_REQUEST_ID,
    taskId: 'task_disk',
    teamId: PLATFORM_ID,
    askedAt: minutesAfter(runEnded('run_disk_1'), 3),
    resolved: true,
    inboxRequest: { form: 'memories', about: 'run_disk_1' },
  }),
  ...alertInboxRequest(ALERT_REQUEST_ID, ALERT_ID, alertFiring()),
  ...alertInboxRequest(COST_ALERT_REQUEST_ID, COST_ALERT_ID, costAlertFiring()),
  inboxRequestOf({
    id: GRADE_REQUEST_ID,
    taskId: 'task_postgres',
    teamId: PLATFORM_ID,
    askedAt: minutesAfter(runEnded('run_postgres_2'), 4),
    inboxRequest: { form: 'grade', about: 'run_postgres_2' },
  }),
  inboxRequestOf({
    id: GRADED_REQUEST_ID,
    taskId: 'task_search',
    teamId: PLATFORM_ID,
    askedAt: minutesAfter(runEnded('run_search_2'), 4),
    resolved: true,
    inboxRequest: { form: 'grade', about: 'run_search_2' },
  }),
  inboxRequestOf({
    id: CLAIMS_GRADE_REQUEST_ID,
    taskId: 'task_pricing_toggle',
    teamId: GROWTH_ID,
    askedAt: minutesAfter(runEnded('run_pricing_1'), 4),
    inboxRequest: { form: 'grade', about: 'run_pricing_1' },
  }),
  ...earlierRubricGrade(),
];

const SETUP_ABOUT = {
  title: 'Set up your team',
  description:
    'A few quick steps will get everything ready for your team to start working with Spotlight.',
};

const setupItem = (
  createdAt: string,
  resolved: boolean,
): InboxItemResponseDto => {
  const place = placeOf('station_backlog');
  const at = {
    name: place.name,
    color: place.color,
    position: place.position,
  };

  return {
    kind: 'task',
    id: SETUP_ITEM_ID,
    taskId: 'task_setup_platform',
    teamId: PLATFORM_ID,
    ...SETUP_ABOUT,
    attachments: [],
    station: place.name,
    stationColor: place.color,
    stationPosition: place.position,
    stationCount: place.count,
    originStation: at,
    currentStation: at,
    createdAt,
    askedAt: createdAt,
    resolved,
    progress: null,
    runId: null,
    unread: !resolved,
    briefing: null,
    failure: null,
    inboxRequest: null,
    notes: [
      {
        position: 0,
        kind: 'asked',
        form: 'setup',
        voice: 'station',
        station: place.name,
        stationColor: place.color,
        stationPosition: place.position,
        runId: null,
        body: '1. Install the GitHub App.\n2. Connect a host.',
        attachments: [],
        at: createdAt,
        author: null,
        coAuthors: [],
        approval: null,
        failure: null,
        connection: null,
      },
    ],
  };
};

export const freshInbox = (): InboxEntry[] => [setupItem(hoursAgo(0.1), false)];

export const seedInbox = (): InboxEntry[] => [
  ...NOTICES.map((notice) => structuredClone(notice)),
  ...OPEN_CONVERSATIONS(),
  ...INBOX_REQUESTS(),
  ...RESOLVED_CONVERSATIONS(),
  setupItem(daysAgo(190), true),
];

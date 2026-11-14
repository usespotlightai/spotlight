import type {
  InboxChatResponseDto,
  InboxItemViewResponseDto,
  InboxNoticeResponseDto,
  InboxRunResponseDto,
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
  latestRunAt,
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

type Shown = 'section' | 'reopenable';

export type InboxConversation = Omit<
  InboxItemViewResponseDto,
  'lastNote' | Shown
>;

type StoredNotice = Omit<InboxNoticeResponseDto, Shown>;

type StoredRun = Omit<InboxRunResponseDto, Shown>;

type StoredChat = Omit<InboxChatResponseDto, Shown>;

export type InboxEntry =
  | InboxConversation
  | StoredNotice
  | StoredRun
  | StoredChat;

const sectionOf = (entry: InboxEntry): InboxNoticeResponseDto['section'] => {
  if (
    (entry.kind === 'task' || entry.kind === 'run') &&
    entry.standing === 'following'
  ) {
    return 'following';
  }
  if (entry.unread) {
    return 'open';
  }
  if (entry.resolved) {
    return 'resolved';
  }

  return entry.kind === 'run' ||
    ((entry.kind === 'task' || entry.kind === 'chat') &&
      entry.progress !== null)
    ? 'running'
    : 'open';
};

const reopenableOf = (entry: InboxEntry): boolean => {
  if (entry.kind === 'run' || !entry.resolved) {
    return false;
  }
  if (entry.kind === 'notice' || entry.kind === 'chat' || entry.inboxRequest) {
    return true;
  }

  const closing = entry.notes[entry.notes.length - 1];

  return closing?.form === 'resolved' && closing.voice === 'person';
};

export const shown = <T extends InboxEntry>(
  entry: T,
): T & Pick<InboxNoticeResponseDto, Shown> => ({
  ...entry,
  section: sectionOf(entry),
  reopenable: reopenableOf(entry),
});

export const MEMORIES_REQUEST_ID = 'request_retries_memories';
export const ALERT_REQUEST_ID = 'request_sent_back_alert';
export const GRADE_REQUEST_ID = 'request_postgres_grade';
export const GRADED_REQUEST_ID = 'request_search_grade';
export const STALLED_NOTICE_ID = 'notice_search_stalled';
export const PULL_REQUEST_NOTICE_ID = 'notice_config_pull_request';
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

type Conversation = Omit<Partial<InboxConversation>, 'notes'> & {
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
}: Conversation): InboxConversation => {
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
      latestRunId: latestRunAt(taskId, task.stationId),
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
    standing: 'assignee',
    ...over,
  };
};

type InboxRequestItem = Pick<
  InboxConversation,
  'id' | 'taskId' | 'teamId' | 'askedAt'
> &
  Partial<InboxConversation> & {
    readonly inboxRequest: NonNullable<InboxConversation['inboxRequest']>;
  };

const inboxRequestOf = ({
  id,
  taskId,
  teamId,
  askedAt,
  inboxRequest,
  ...over
}: InboxRequestItem): InboxConversation => {
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
    currentStation: {
      ...place,
      latestRunId: latestRunAt(taskId, task.stationId),
    },
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
    standing: 'team',
    ...over,
  };
};

const STATION_LINK = 'lines/line_delivery/stations/station_implementation';

const NOTICES: StoredNotice[] = [
  {
    kind: 'notice',
    id: STALLED_NOTICE_ID,
    teamId: PLATFORM_ID,
    form: 'advice',
    headline:
      'The search of the Implementation station stalled on causes outside the config',
    points: [
      '“Reconcile open invoices after the retry drain”: the cause is the check. The reconcile script needs the billing database, which the runner cannot reach. Please fix the check of the station.',
      '“Drain the stuck retry queues”: the cause is the judge. It wants a test for every change, but this change has nothing to test. Please fix the rubric of the judge.',
      '“Upgrade the Postgres driver”: the cause is the task itself. Its migration rewrites 1.3M invoice rows, which no candidate finishes in time. Spotlight takes the task out of the replay set.',
    ],
    link: STATION_LINK,
    linkLabel: 'Open the station',
    externalLink: null,
    askedAt: hoursAgo(1.2),
    unread: true,
    resolved: false,
  },
  {
    kind: 'notice',
    id: PULL_REQUEST_NOTICE_ID,
    teamId: PLATFORM_ID,
    form: 'ended',
    headline:
      'Spotlight opened a config pull request for the Implementation station',
    points: [
      'Candidate tests-first changes prompt.',
      'Held-out gain: +22 points',
    ],
    link: STATION_LINK,
    linkLabel: 'Open the station',
    externalLink: {
      url: 'https://github.com/acme/spotlight-config/pull/42',
      label: 'Review the pull request',
    },
    askedAt: daysAgo(3),
    unread: false,
    resolved: true,
  },
];

const OPEN_CONVERSATIONS = (): InboxConversation[] => [
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

const RESOLVED_CONVERSATIONS = (): InboxConversation[] => [
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
): InboxConversation[] =>
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

const earlierRubricGrade = (): InboxConversation[] => {
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

const INBOX_REQUESTS = (): InboxConversation[] => [
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

const setupItem = (createdAt: string, resolved: boolean): InboxConversation => {
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
    currentStation: { ...at, latestRunId: null },
    createdAt,
    askedAt: createdAt,
    resolved,
    progress: null,
    runId: null,
    unread: !resolved,
    briefing: null,
    failure: null,
    inboxRequest: null,
    standing: 'assignee',
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
        source: null,
        deferredTo: null,
        approval: null,
        failure: null,
        connection: null,
      },
    ],
  };
};

const runningOn = (
  taskId: string,
  teamId: string,
  runId: string,
): StoredRun => {
  const task = seededTask(taskId);
  const at = placeOf(task.stationId);
  const run = runsOfTask(taskId).find((each) => each.id === runId);

  return {
    kind: 'run',
    id: runId,
    taskId,
    teamId,
    title: task.title,
    station: at.name,
    stationColor: at.color,
    stationPosition: at.position,
    stationCount: at.count,
    progress: 'in-progress',
    askedAt: run?.startedAt ?? task.createdAt,
    unread: false,
    resolved: false,
    standing: 'assignee',
  };
};

const RUNNING = (): StoredRun[] => [
  runningOn('task_retries', PLATFORM_ID, 'run_retries_3'),
];

const CHATS = (): StoredChat[] => [
  {
    kind: 'chat',
    id: 'chat_retries',
    teamId: PLATFORM_ID,
    title: 'Why do retries pile up?',
    progress: null,
    openProposals: 3,
    askedAt: hoursAgo(2.5),
    unread: true,
    resolved: false,
  },
  {
    kind: 'chat',
    id: 'chat_rate_limits',
    teamId: PLATFORM_ID,
    title: 'Rate limiting for the public API',
    progress: 'in-progress',
    openProposals: 0,
    askedAt: hoursAgo(0.3),
    unread: false,
    resolved: false,
  },
  {
    kind: 'chat',
    id: 'chat_quarter',
    teamId: PLATFORM_ID,
    title: 'What should the platform team take on next quarter?',
    progress: null,
    openProposals: 0,
    askedAt: daysAgo(2),
    unread: false,
    resolved: true,
  },
];

export const freshInbox = (): InboxEntry[] => [setupItem(hoursAgo(0.1), false)];

export const seedInbox = (): InboxEntry[] => [
  ...NOTICES.map((notice) => structuredClone(notice)),
  ...OPEN_CONVERSATIONS(),
  ...INBOX_REQUESTS(),
  ...RESOLVED_CONVERSATIONS(),
  ...RUNNING(),
  ...CHATS(),
  setupItem(daysAgo(190), true),
];

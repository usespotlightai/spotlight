import type {
  InboxChatResponseDto,
  InboxItemViewResponseDto,
  InboxNoticeResponseDto,
  InboxRunResponseDto,
  NoteResponseDto,
} from '@/lib/api';
import type { InboxPart } from '@/lib/inbox';
import { daysAgo, hoursAgo } from '@/mocks/clock';
import {
  acceptedRun,
  claimsChangedRun,
  labelGoneRun,
  mergedRun,
  type Opening,
  openingOfRun,
  sentBackRun,
  verdictsAgreeRun,
} from '@/mocks/world/disagreement-runs';
import { foldedAround, lastConversationIn } from '@/mocks/world/folded-visits';
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
import { pastTaskOf } from '@/mocks/world/past-work';
import { SAM } from '@/mocks/world/people';
import { PLATFORM_ID } from '@/mocks/world/platform';
import { notesOfRun, type StoryNote } from '@/mocks/world/run-stories';

type Shown = 'section' | 'reopenable' | 'unreadCount';

type Grouped = 'conversationId' | 'latest' | 'quiet' | 'parts' | 'firstUnread';

// The mock keeps what the control plane keeps: each conversation and each
// inbox request on its own. The handlers show them one item per task.
export type InboxConversation = Omit<
  InboxItemViewResponseDto,
  'lastNote' | 'answerable' | 'resolvable' | Shown | Grouped
> & {
  readonly inboxRequest: {
    readonly form: NonNullable<InboxPart['form']>;
    readonly about: string;
  } | null;
};

const answers = (entry: InboxConversation): boolean =>
  entry.standing === 'assignee' ||
  entry.standing === 'asked' ||
  entry.standing === 'team';

type StoredNotice = Omit<InboxNoticeResponseDto, Shown | 'resolvable'>;

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

  const closing = entry.notes.at(-1);

  return (
    answers(entry) && closing?.form === 'resolved' && closing.voice === 'person'
  );
};

const resolvableOf = (entry: InboxConversation): boolean =>
  !entry.resolved &&
  (entry.inboxRequest !== null ||
    entry.standing === 'assignee' ||
    entry.standing === 'team');

const answerableOf = (entry: InboxConversation): boolean =>
  !entry.resolved && entry.inboxRequest === null && answers(entry);

type Showing = Pick<InboxNoticeResponseDto, Shown>;

export type ShownConversation = InboxConversation &
  Showing &
  Pick<InboxItemViewResponseDto, 'answerable' | 'resolvable'>;

type ShownEntry =
  | ShownConversation
  | (StoredNotice & Showing & Pick<InboxNoticeResponseDto, 'resolvable'>)
  | (StoredRun & Showing)
  | (StoredChat & Showing);

const showing = (entry: InboxEntry): Showing => ({
  section: sectionOf(entry),
  reopenable: reopenableOf(entry),
  unreadCount: entry.unread ? 1 : 0,
});

export const shownConversation = (
  entry: InboxConversation,
): ShownConversation => ({
  ...entry,
  ...showing(entry),
  answerable: answerableOf(entry),
  resolvable: resolvableOf(entry),
});

export const shown = (entry: InboxEntry): ShownEntry => {
  if (entry.kind === 'task') {
    return shownConversation(entry);
  }
  if (entry.kind === 'notice') {
    return { ...entry, ...showing(entry), resolvable: !entry.resolved };
  }

  return { ...entry, ...showing(entry) };
};

export const MEMORIES_REQUEST_ID = 'request_retries_memories';
export const ALERT_REQUEST_ID = 'request_sent_back_alert';
export const STALLED_NOTICE_ID = 'notice_search_stalled';
export const PULL_REQUEST_NOTICE_ID = 'notice_config_pull_request';
export const ALERT_ID = 'alert_sent_back';
export const COST_ALERT_REQUEST_ID = 'request_cost_alert';
export const COST_ALERT_ID = 'alert_cost_per_run';
export const DECIDED_MEMORIES_REQUEST_ID = 'request_disk_memories';
export const SEARCH_DISAGREEMENT_ID = 'disagreement_search_2';
export const SEARCH_DISAGREEMENT_REQUEST_ID = 'request_search_disagreement';
export const VERDICTS_AGREE_DISAGREEMENT_ID = 'disagreement_verdicts_agree';
export const VERDICTS_AGREE_DISAGREEMENT_REQUEST_ID =
  'request_verdicts_agree_disagreement';
export const SENT_BACK_DISAGREEMENT_ID = 'disagreement_sent_back';
export const SENT_BACK_DISAGREEMENT_REQUEST_ID =
  'request_sent_back_disagreement';
export const ACCEPTED_DISAGREEMENT_ID = 'disagreement_accepted';
export const ACCEPTED_DISAGREEMENT_REQUEST_ID = 'request_accepted_disagreement';
export const MERGED_DISAGREEMENT_ID = 'disagreement_merged';
export const MERGED_DISAGREEMENT_REQUEST_ID = 'request_merged_disagreement';
export const CLAIMS_CHANGED_DISAGREEMENT_ID = 'disagreement_claims_changed';
export const CLAIMS_CHANGED_DISAGREEMENT_REQUEST_ID =
  'request_claims_changed_disagreement';
export const LABEL_GONE_DISAGREEMENT_ID = 'disagreement_label_gone';
export const LABEL_GONE_DISAGREEMENT_REQUEST_ID =
  'request_label_gone_disagreement';
export const SETUP_ITEM_ID = 'task_setup_platform:0';

const numbered = (notes: readonly StoryNote[]): NoteResponseDto[] =>
  notes.map((note, position) => ({ ...note, position }));

const notesOfTask = (taskId: string): StoryNote[] =>
  [...runsOfTask(taskId)]
    .sort((one, other) => one.startedAt.localeCompare(other.startedAt))
    .flatMap(notesOfRun);

const promptFor = (
  station: string,
  task: { readonly title: string; readonly description: string | null },
  trail: readonly NoteResponseDto[],
): string =>
  [
    `You are the ${station} station of the Delivery line. Work on the task below. Hand it over with spotlight handover when you finish. Ask a person when a decision is not yours to make.`,
    `## ${task.title}`,
    task.description,
    trail.length > 0
      ? [
          '## Already done',
          ...trail.map((note) => `### ${note.station}\n\n${note.body}`),
        ].join('\n\n')
      : null,
    '## The Spotlight CLI\n\nRun spotlight --help to see every command.',
  ]
    .filter(Boolean)
    .join('\n\n');

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
  const trail = numbered(notesOfTask(taskId));
  const numberedNotes = lastConversationIn(trail);

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
    waiting: null,
    runId: null,
    unread: false,
    briefing: promptFor(at.name, task, trail),
    failure: null,
    inboxRequest: null,
    notes: numberedNotes,
    folded: foldedAround(taskId, trail, numberedNotes),
    standing: 'assignee',
    ...over,
    stoppableByYou: (over.runId ?? null) !== null,
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
    waiting: null,
    runId: null,
    stoppableByYou: false,
    unread: false,
    briefing: null,
    failure: null,
    inboxRequest,
    notes: [],
    folded: [],
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
      '“Drain the stuck retry queues”: the cause is the judge. It wants a test for every change, but this change has nothing to test. Please fix the claims of the judge.',
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
    taskId: 'task_retry_after',
    teamId: PLATFORM_ID,
    askedIn: 'station_spec',
    originIn: 'station_triage',
    runId: 'run_retry_after_1',
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

const firedAtOf = ({ run }: AlertFiring) => minutesAfter(run.endedAt, 2);

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

type DisagreementRequest = {
  readonly id: string;
  readonly about: string;
  readonly opening: Opening | null;
  readonly unread?: boolean;
  readonly resolved?: boolean;
};

const disagreementRequest = ({
  id,
  about,
  opening,
  unread = false,
  resolved = false,
}: DisagreementRequest): InboxConversation[] =>
  opening
    ? [
        inboxRequestOf({
          id,
          taskId: opening.run.taskId,
          teamId: PLATFORM_ID,
          askedAt: opening.openedAt,
          unread,
          resolved,
          inboxRequest: { form: 'judge-disagreement', about },
          standing: opening.askedOf === SAM.id ? 'assignee' : 'team',
        }),
      ]
    : [];

const disagreementRequests = (): InboxConversation[] =>
  [
    {
      id: SEARCH_DISAGREEMENT_REQUEST_ID,
      about: SEARCH_DISAGREEMENT_ID,
      opening: openingOfRun('run_search_2'),
      unread: true,
    },
    {
      id: SENT_BACK_DISAGREEMENT_REQUEST_ID,
      about: SENT_BACK_DISAGREEMENT_ID,
      opening: sentBackRun(),
    },
    {
      id: ACCEPTED_DISAGREEMENT_REQUEST_ID,
      about: ACCEPTED_DISAGREEMENT_ID,
      opening: acceptedRun(),
    },
    {
      id: MERGED_DISAGREEMENT_REQUEST_ID,
      about: MERGED_DISAGREEMENT_ID,
      opening: mergedRun(),
    },
    {
      id: VERDICTS_AGREE_DISAGREEMENT_REQUEST_ID,
      about: VERDICTS_AGREE_DISAGREEMENT_ID,
      opening: verdictsAgreeRun(),
      resolved: true,
    },
    {
      id: CLAIMS_CHANGED_DISAGREEMENT_REQUEST_ID,
      about: CLAIMS_CHANGED_DISAGREEMENT_ID,
      opening: claimsChangedRun(),
      resolved: true,
    },
    {
      id: LABEL_GONE_DISAGREEMENT_REQUEST_ID,
      about: LABEL_GONE_DISAGREEMENT_ID,
      opening: labelGoneRun(),
      resolved: true,
    },
  ].flatMap(disagreementRequest);

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
  ...disagreementRequests(),
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
    waiting: null,
    runId: null,
    stoppableByYou: false,
    unread: !resolved,
    briefing: null,
    failure: null,
    inboxRequest: null,
    standing: 'assignee',
    folded: [],
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
        resumption: null,
        suggestsClosing: false,
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
    waiting: null,
    askedAt: run?.startedAt ?? task.createdAt,
    unread: false,
    resolved: false,
    standing: 'assignee',
    stoppableByYou: true,
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
    waiting: null,
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
    waiting: null,
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
    waiting: null,
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

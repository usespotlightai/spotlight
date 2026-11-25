import type {
  ChatMessageResponseDto,
  ChatResponseDto,
  ChatSetupRequestDto,
  ChatSummaryResponseDto,
  ChatTargetStationResponseDto,
  ChatTraceResponseDto,
} from '@/lib/api';
import {
  type ApprovalStatus,
  WAITING_FOR_APPROVAL,
} from '@/lib/approval-status';
import type { JournalledRun, JournalStep, RunJournal } from '@/lib/inbox';
import { stretchesOf } from '@/lib/journal-step';
import { teamSectionPath } from '@/lib/team';

export type Chat = ChatResponseDto;

export type ChatSummary = ChatSummaryResponseDto;

export type ChatMessage = ChatMessageResponseDto;

export type Proposal = NonNullable<ChatMessage['proposal']>;

export type ChatPullRequest = NonNullable<ChatMessage['pullRequest']>;

export type SharedTrace = ChatTraceResponseDto;

const isSharedTrace = (value: unknown): value is SharedTrace =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as SharedTrace).taskId === 'string' &&
  typeof (value as SharedTrace).title === 'string';

export const tracesHandedOver = (state: unknown): SharedTrace[] => {
  const traces = (state as { traces?: unknown } | null)?.traces;

  return Array.isArray(traces) ? traces.filter(isSharedTrace) : [];
};

export type TargetStation = ChatTargetStationResponseDto;

const TARGET_STATION_FIELDS = [
  'lineId',
  'lineKey',
  'lineName',
  'stationId',
  'stationKey',
  'stationName',
] as const satisfies readonly (keyof TargetStation)[];

const isTargetStation = (value: unknown): value is TargetStation =>
  typeof value === 'object' &&
  value !== null &&
  TARGET_STATION_FIELDS.every(
    (field) => typeof (value as Record<string, unknown>)[field] === 'string',
  );

export const targetStationHandedOver = (
  state: unknown,
): TargetStation | null => {
  const targetStation = (state as { targetStation?: unknown } | null)
    ?.targetStation;

  return isTargetStation(targetStation)
    ? {
        lineId: targetStation.lineId,
        lineKey: targetStation.lineKey,
        lineName: targetStation.lineName,
        stationId: targetStation.stationId,
        stationKey: targetStation.stationKey,
        stationName: targetStation.stationName,
      }
    : null;
};

export const promptHandedOver = (state: unknown): string | null => {
  const prompt = (state as { prompt?: unknown } | null)?.prompt;

  return typeof prompt === 'string' && prompt.trim() ? prompt : null;
};

export type ChatSetup = ChatSetupRequestDto;

const isChatSetup = (given: unknown): given is ChatSetup =>
  typeof given === 'object' &&
  given !== null &&
  typeof (given as ChatSetup).repository === 'string' &&
  typeof (given as ChatSetup).folder === 'string';

export const setupHandedOver = (state: unknown): ChatSetup | null => {
  const setup = (state as { setup?: unknown } | null)?.setup;

  return isChatSetup(setup)
    ? { repository: setup.repository, folder: setup.folder }
    : null;
};

export const repositoriesHandedOver = (state: unknown): string[] => {
  const repositories = (state as { repositories?: unknown } | null)
    ?.repositories;

  return Array.isArray(repositories)
    ? repositories.filter((each): each is string => typeof each === 'string')
    : [];
};

export type ChatMoment =
  | {
      readonly kind: 'message';
      readonly key: string;
      readonly at: string;
      readonly message: ChatMessage;
    }
  | {
      readonly kind: 'proposed';
      readonly key: string;
      readonly at: string;
      readonly message: ChatMessage;
      readonly proposal: Proposal;
    }
  | {
      readonly kind: 'opened';
      readonly key: string;
      readonly at: string;
      readonly message: ChatMessage;
      readonly pullRequest: ChatPullRequest;
    }
  | {
      readonly kind: 'answered';
      readonly key: string;
      readonly at: string;
      readonly text: string;
    }
  | {
      readonly kind: 'worked';
      readonly key: string;
      readonly at: string;
      readonly steps: readonly JournalStep[];
    }
  | {
      readonly kind: 'pending';
      readonly key: string;
      readonly at: string;
      readonly count: number;
    };

export const CHAT_KEEPS_REPOSITORIES =
  'A chat keeps the repositories it started with. To use other repositories, start a new chat.';

export const chatPath = (
  slug: string,
  teamId: string,
  chatId: string,
): string => `${teamSectionPath(slug, teamId, 'agent')}/${chatId}`;

const QUEUED_AFTER_MESSAGE_MS = 1_000;

const momentOf = (message: ChatMessage): ChatMoment =>
  message.proposal
    ? {
        kind: 'proposed',
        key: `message:${message.position}`,
        at: message.at,
        message,
        proposal: message.proposal,
      }
    : message.pullRequest
      ? {
          kind: 'opened',
          key: `message:${message.position}`,
          at: message.at,
          message,
          pullRequest: message.pullRequest,
        }
      : {
          kind: 'message',
          key: `message:${message.position}`,
          at: message.at,
          message,
        };

const later = (at: string, floor: string | null): string =>
  floor && Date.parse(floor) > Date.parse(at) ? floor : at;

const starterOf = (
  journal: RunJournal,
  messages: readonly ChatMessage[],
): string | null => {
  const first = journal.steps[0];
  if (!first) {
    return null;
  }
  const queued = Date.parse(first.startedAt) + QUEUED_AFTER_MESSAGE_MS;

  return messages
    .filter(
      (message) =>
        (message.kind === 'message' || message.kind === 'happened') &&
        Date.parse(message.at) <= queued,
    )
    .reduce<string | null>(
      (found, message) =>
        found && Date.parse(found) >= Date.parse(message.at)
          ? found
          : message.at,
      null,
    );
};

const worked = (
  journal: RunJournal,
  messages: readonly ChatMessage[],
): ChatMoment[] => {
  const floor = starterOf(journal, messages);
  const run = `${journal.runId}:${journal.attempt}`;

  return stretchesOf(journal.steps).map((stretch) =>
    stretch.kind === 'said'
      ? {
          kind: 'answered',
          key: `said:${run}:${stretch.at}`,
          at: later(stretch.step.startedAt, floor),
          text: stretch.step.text,
        }
      : {
          kind: 'worked',
          key: `worked:${run}:${stretch.at}`,
          at: later(stretch.steps[0].startedAt, floor),
          steps: stretch.steps,
        },
  );
};

const pendingOf = (
  runs: readonly JournalledRun[],
  journals: readonly RunJournal[],
): ChatMoment[] =>
  runs
    .filter(
      (run) =>
        run.stepCount > 0 &&
        !journals.some((journal) => journal.runId === run.runId),
    )
    .map((run) => ({
      kind: 'pending',
      key: `pending:${run.runId}`,
      at: run.createdAt,
      count: run.stepCount,
    }));

export const momentsOf = (
  messages: readonly ChatMessage[],
  journals: readonly RunJournal[],
  runs: readonly JournalledRun[],
): ChatMoment[] =>
  [
    ...messages.map(momentOf),
    ...journals.flatMap((journal) => worked(journal, messages)),
    ...pendingOf(runs, journals),
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

export type ChatTurn = {
  readonly message: ChatMessage | null;
  readonly moments: readonly ChatMoment[];
};

export const turnsOf = (moments: readonly ChatMoment[]): ChatTurn[] => {
  const cut: { message: ChatMessage | null; moments: ChatMoment[] }[] = [
    { message: null, moments: [] },
  ];

  for (const moment of moments) {
    if (moment.kind === 'message') {
      cut.push({ message: moment.message, moments: [] });
    } else {
      cut[cut.length - 1]?.moments.push(moment);
    }
  }

  return cut
    .filter((turn) => turn.message || turn.moments.length > 0)
    .map((turn) => ({
      message: turn.message,
      moments: [
        ...turn.moments.filter((moment) => moment.kind !== 'opened'),
        ...turn.moments.filter((moment) => moment.kind === 'opened'),
      ],
    }));
};

export const runsOfTurn = (turn: ChatTurn | undefined): string[] =>
  turn?.message?.takenUpBy ? [turn.message.takenUpBy] : [];

const PROPOSAL_STATUSES: Record<Proposal['state'], ApprovalStatus> = {
  open: 'pending',
  accepted: 'working',
  created: 'approved',
  dismissed: 'dismissed',
  replaced: 'dismissed',
};

export const proposalStatusOf = (proposal: Proposal): ApprovalStatus =>
  PROPOSAL_STATUSES[proposal.state];

const PROPOSAL_TITLES: Record<Proposal['state'], string> = {
  open: WAITING_FOR_APPROVAL,
  accepted: 'Creating the task',
  created: 'Task created',
  dismissed: 'Dismissed',
  replaced: 'Replaced by a newer proposal',
};

export const proposalTitleOf = (proposal: Proposal): string =>
  PROPOSAL_TITLES[proposal.state];

export const proposedStationOf = (proposal: Proposal): string | null =>
  proposal.stationName
    ? [proposal.lineName, proposal.stationName].filter(Boolean).join(' › ')
    : null;

const PULL_REQUEST_STATUSES: Record<
  Exclude<ChatPullRequest['state'], 'held'>,
  ApprovalStatus
> = {
  line: 'working',
  completed: 'approved',
  gone: 'dismissed',
};

export const pullRequestStatusOf = (
  state: Exclude<ChatPullRequest['state'], 'held'>,
): ApprovalStatus => PULL_REQUEST_STATUSES[state];

const PULL_REQUEST_TITLES: Record<ChatPullRequest['state'], string> = {
  held: 'On hold for this chat',
  line: 'Handed to the line',
  completed: 'Task completed',
  gone: 'Task deleted',
};

export const pullRequestTitleOf = (pullRequest: ChatPullRequest): string =>
  PULL_REQUEST_TITLES[pullRequest.state];

export const pullRequestNameOf = (url: string): string => {
  const found = /github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/.exec(url);

  return found ? `${found[1]}#${found[2]}` : url;
};

export const pullRequestStationOf = (
  pullRequest: ChatPullRequest,
): string | null =>
  pullRequest.stationName
    ? [pullRequest.lineName, pullRequest.stationName]
        .filter(Boolean)
        .join(' › ')
    : null;

export const proposalText = (proposal: Proposal): string =>
  proposal.description
    ? `${proposal.title}\n\n${proposal.description}`
    : proposal.title;

export type SentMessage = Pick<ChatMessage, 'body' | 'author' | 'attachments'>;

export const sentTo = (chat: Chat, sent: SentMessage, at: string): Chat => ({
  ...chat,
  progress: chat.progress ?? 'queued',
  messages: [
    ...chat.messages,
    {
      ...sent,
      position: (chat.messages.at(-1)?.position ?? -1) + 1,
      kind: 'message',
      at,
      runId: null,
      takenUpBy: null,
      traces: [],
      proposal: null,
      pullRequest: null,
    },
  ],
});

export const withoutMessage = (chat: Chat, position: number): Chat => ({
  ...chat,
  messages: chat.messages.filter((message) => message.position !== position),
});

export const decidedIn = (
  chat: Chat,
  position: number,
  state: Proposal['state'],
): Chat => ({
  ...chat,
  messages: chat.messages.map((message) =>
    message.position === position && message.proposal
      ? { ...message, proposal: { ...message.proposal, state } }
      : message,
  ),
});

type PhaseClock = { readonly key: string; readonly since: number | null };

export type AgentPhase =
  | ({ readonly kind: 'preparing' } & PhaseClock)
  | ({ readonly kind: 'step'; readonly step: JournalStep } & PhaseClock)
  | ({ readonly kind: 'working' } & PhaseClock);

const startOf = (step: JournalStep): number => Date.parse(step.startedAt);

export const phaseOf = (
  journals: readonly RunJournal[],
  runId: string | null,
): AgentPhase => {
  const journal = journals.findLast((each) => each.runId === runId);
  const steps = journal?.steps ?? [];
  const started = journal?.marks.startedAt ?? steps[0]?.startedAt;
  const preparing = !steps.some((step) => step.kind !== 'hook');
  const running = steps.findLast(
    (step) =>
      step.kind !== 'message' &&
      (step.status === 'running' || step.status === 'pending'),
  );
  if (running) {
    return {
      kind: 'step',
      step: running,
      key: `${runId}:step:${running.startedAt}:${running.text}`,
      since: preparing && started ? Date.parse(started) : startOf(running),
    };
  }
  if (preparing) {
    return {
      kind: 'preparing',
      key: `${runId}:preparing`,
      since: started ? Date.parse(started) : null,
    };
  }
  const last = steps.at(-1);

  return {
    kind: 'working',
    key: `${runId}:working:${steps.length}`,
    since: last ? startOf(last) + last.ms : null,
  };
};

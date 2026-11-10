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
import { teamSectionPath } from '@/lib/team';
import { oneLineOf, stepsCounted } from '@/lib/turns';

export type Chat = ChatResponseDto;

export type ChatSummary = ChatSummaryResponseDto;

export type ChatMessage = ChatMessageResponseDto;

export type Proposal = NonNullable<ChatMessage['proposal']>;

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
      readonly at: string;
      readonly message: ChatMessage;
    }
  | {
      readonly kind: 'proposed';
      readonly at: string;
      readonly message: ChatMessage;
      readonly proposal: Proposal;
    }
  | { readonly kind: 'answered'; readonly at: string; readonly text: string }
  | {
      readonly kind: 'worked';
      readonly at: string;
      readonly steps: readonly JournalStep[];
    }
  | { readonly kind: 'pending'; readonly at: string; readonly count: number };

export const CHAT_KEEPS_REPOSITORIES =
  'A chat keeps the repositories it started with. To use other repositories, start a new chat.';

export const chatPath = (
  slug: string,
  teamId: string,
  chatId: string,
): string => `${teamSectionPath(slug, teamId, 'agent')}/${chatId}`;

const momentOf = (message: ChatMessage): ChatMoment =>
  message.proposal
    ? {
        kind: 'proposed',
        at: message.at,
        message,
        proposal: message.proposal,
      }
    : { kind: 'message', at: message.at, message };

const finishedAt = (step: JournalStep): string =>
  new Date(Date.parse(step.startedAt) + step.ms).toISOString();

const worked = (journal: RunJournal): ChatMoment[] => {
  const cut: ChatMoment[] = [];

  for (const step of journal.steps) {
    const last = cut[cut.length - 1];

    if (step.kind === 'message') {
      cut.push({ kind: 'answered', at: step.startedAt, text: step.text });
    } else if (last?.kind === 'worked') {
      cut[cut.length - 1] = { ...last, steps: [...last.steps, step] };
    } else {
      cut.push({ kind: 'worked', at: finishedAt(step), steps: [step] });
    }
  }

  return cut;
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
    ...journals.flatMap(worked),
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

  return cut.filter((turn) => turn.message || turn.moments.length > 0);
};

export const waitsOnDecision = (turn: ChatTurn): boolean =>
  turn.moments.some(
    (moment) => moment.kind === 'proposed' && moment.proposal.state === 'open',
  );

export const turnSummaryOf = (
  turn: ChatTurn,
): { readonly text: string; readonly count?: string } => {
  const steps = turn.moments.reduce(
    (all, moment) =>
      all +
      (moment.kind === 'worked'
        ? moment.steps.length
        : moment.kind === 'pending'
          ? moment.count
          : 0),
    0,
  );
  const said = turn.moments.findLast(
    (moment) => moment.kind === 'answered' || moment.kind === 'proposed',
  );
  const text =
    said?.kind === 'answered'
      ? said.text
      : said?.kind === 'proposed'
        ? `Proposed ${said.proposal.title}`
        : 'Worked';

  return {
    text: oneLineOf(text),
    count: steps > 0 ? stepsCounted(steps) : undefined,
  };
};

export const runsOfTurn = (turn: ChatTurn | undefined): string[] =>
  turn?.message?.takenUpBy ? [turn.message.takenUpBy] : [];

const PROPOSAL_STATUSES: Record<Proposal['state'], ApprovalStatus> = {
  open: 'pending',
  accepted: 'approved',
  created: 'approved',
  dismissed: 'dismissed',
};

export const proposalStatusOf = (proposal: Proposal): ApprovalStatus =>
  PROPOSAL_STATUSES[proposal.state];

const PROPOSAL_TITLES: Record<Proposal['state'], string> = {
  open: WAITING_FOR_APPROVAL,
  accepted: 'Creating the task',
  created: 'Task created',
  dismissed: 'Dismissed',
};

export const proposalTitleOf = (proposal: Proposal): string =>
  PROPOSAL_TITLES[proposal.state];

export const proposedStationOf = (proposal: Proposal): string | null =>
  proposal.stationName
    ? [proposal.lineName, proposal.stationName].filter(Boolean).join(' › ')
    : null;

export const proposalText = (proposal: Proposal): string =>
  proposal.description
    ? `${proposal.title}\n\n${proposal.description}`
    : proposal.title;

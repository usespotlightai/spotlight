import type {
  ChatMessageResponseDto,
  ChatResponseDto,
  ChatSummaryResponseDto,
  ChatTargetStationResponseDto,
  ChatTraceResponseDto,
} from '@/lib/api';
import {
  type ApprovalStatus,
  WAITING_FOR_APPROVAL,
} from '@/lib/approval-status';
import type { JournalStep, RunJournal } from '@/lib/inbox';
import { teamSectionPath } from '@/lib/team';

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
    };

export const CHAT_HARNESS_KEY = 'spotlight.chat-harness';

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

export const momentsOf = (
  messages: readonly ChatMessage[],
  journals: readonly RunJournal[],
): ChatMoment[] =>
  [...messages.map(momentOf), ...journals.flatMap(worked)].sort(
    (a, b) => Date.parse(a.at) - Date.parse(b.at),
  );

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

const PROPOSAL_STATUSES: Record<Proposal['state'], ApprovalStatus> = {
  open: 'waiting',
  accepted: 'approved',
  created: 'approved',
  dismissed: 'declined',
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

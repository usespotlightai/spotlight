import type {
  ChatImprovingResponseDto,
  ChatMessageResponseDto,
  ChatResponseDto,
  ChatSummaryResponseDto,
  ChatTraceResponseDto,
} from '@/lib/api';
import type { JournalStep, RunJournal } from '@/lib/inbox';
import { teamSectionPath } from '@/lib/team';

export type Chat = ChatResponseDto;

export type ChatSummary = ChatSummaryResponseDto;

export type ChatMessage = ChatMessageResponseDto;

export type Proposal = NonNullable<ChatMessage['proposal']>;

export type SharedTrace = ChatTraceResponseDto;

const isSharedTrace = (given: unknown): given is SharedTrace =>
  typeof given === 'object' &&
  given !== null &&
  typeof (given as SharedTrace).taskId === 'string' &&
  typeof (given as SharedTrace).title === 'string';

export const tracesHandedOver = (state: unknown): SharedTrace[] => {
  const traces = (state as { traces?: unknown } | null)?.traces;

  return Array.isArray(traces) ? traces.filter(isSharedTrace) : [];
};

export type ImprovedStation = ChatImprovingResponseDto;

const IMPROVED_STATION_FIELDS = [
  'lineId',
  'lineKey',
  'lineName',
  'stationId',
  'stationKey',
  'stationName',
] as const satisfies readonly (keyof ImprovedStation)[];

const isImprovedStation = (given: unknown): given is ImprovedStation =>
  typeof given === 'object' &&
  given !== null &&
  IMPROVED_STATION_FIELDS.every(
    (field) => typeof (given as Record<string, unknown>)[field] === 'string',
  );

export const improvingHandedOver = (state: unknown): ImprovedStation | null => {
  const improving = (state as { improving?: unknown } | null)?.improving;

  return isImprovedStation(improving)
    ? {
        lineId: improving.lineId,
        lineKey: improving.lineKey,
        lineName: improving.lineName,
        stationId: improving.stationId,
        stationKey: improving.stationKey,
        stationName: improving.stationName,
      }
    : null;
};

export type ChatMoment =
  | {
      readonly kind: 'said';
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

export const chatPath = (
  slug: string,
  teamId: string,
  chatId: string,
): string => `${teamSectionPath(slug, teamId, 'agent')}/${chatId}`;

const spoken = (message: ChatMessage): ChatMoment =>
  message.proposal
    ? {
        kind: 'proposed',
        at: message.at,
        message,
        proposal: message.proposal,
      }
    : { kind: 'said', at: message.at, message };

const finishedAt = (step: JournalStep): string =>
  new Date(Date.parse(step.startedAt) + step.ms).toISOString();

const worked = (journal: RunJournal): ChatMoment[] => {
  const cut: ChatMoment[] = [];

  for (const step of journal.steps) {
    const last = cut[cut.length - 1];

    if (step.kind === 'said') {
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
  [...messages.map(spoken), ...journals.flatMap(worked)].sort(
    (a, b) => Date.parse(a.at) - Date.parse(b.at),
  );

export type ChatTurn = {
  readonly said: ChatMessage | null;
  readonly moments: readonly ChatMoment[];
};

export const turnsOf = (moments: readonly ChatMoment[]): ChatTurn[] => {
  const cut: { said: ChatMessage | null; moments: ChatMoment[] }[] = [
    { said: null, moments: [] },
  ];

  for (const moment of moments) {
    if (moment.kind === 'said') {
      cut.push({ said: moment.message, moments: [] });
    } else {
      cut[cut.length - 1]?.moments.push(moment);
    }
  }

  return cut.filter((turn) => turn.said || turn.moments.length > 0);
};

export const newlyProposed = (
  messages: readonly ChatMessage[],
  since: number,
): number | null =>
  messages
    .slice(since)
    .reduce<number | null>(
      (found, message) =>
        message.proposal?.state === 'open' ? message.position : found,
      null,
    );

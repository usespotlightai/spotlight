import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { TeamStanding } from '@work/domain/value-objects/team-standing.vo';

export const CONVERSATION_STANDINGS = [
  'assignee',
  'asked',
  'team',
  'following',
] as const;

export type ConversationStanding = (typeof CONVERSATION_STANDINGS)[number];

export const RUN_STANDINGS = [
  'assignee',
  'following',
] as const satisfies readonly ConversationStanding[];

export type RunStanding = (typeof RUN_STANDINGS)[number];

export interface ConversationViewer {
  readonly person: UserId;
  readonly onTeam: boolean;
}

export interface OpenAsk {
  readonly approval: {
    readonly open: boolean;
    readonly askedOf: UserId | null;
  } | null;
  readonly connectionAsk: {
    readonly met: boolean;
    readonly personId: UserId;
  } | null;
}

const awaits = (ask: OpenAsk, person: UserId): boolean =>
  (ask.approval?.open === true &&
    (ask.approval.askedOf?.equals(person) ?? false)) ||
  (ask.connectionAsk?.met === false &&
    ask.connectionAsk.personId.equals(person));

export interface ConversationReader extends ConversationViewer {
  readonly wroteIn: boolean;
  readonly asked: boolean;
}

export const ConversationAudience = {
  asks(ask: OpenAsk | null, person: UserId): boolean {
    return ask !== null && awaits(ask, person);
  },

  standingOf(
    assignee: UserId | null,
    reader: ConversationReader,
  ): ConversationStanding | null {
    if (assignee?.equals(reader.person)) {
      return 'assignee';
    }

    if (assignee === null && reader.onTeam) {
      return 'team';
    }

    if (reader.asked) {
      return 'asked';
    }

    return assignee !== null && reader.wroteIn ? 'following' : null;
  },

  answers(standing: ConversationStanding | null): boolean {
    return (
      standing === 'assignee' || standing === 'asked' || standing === 'team'
    );
  },

  resolves(standing: ConversationStanding | null): boolean {
    return standing === 'assignee' || standing === 'team';
  },

  mayAnswer(
    team: TeamStanding,
    standing: ConversationStanding | null,
  ): boolean {
    return team.actsOnTasks && ConversationAudience.answers(standing);
  },

  mayResolve(
    team: TeamStanding,
    standing: ConversationStanding | null,
  ): boolean {
    return team.actsOnTasks && ConversationAudience.resolves(standing);
  },

  notifies(standing: ConversationStanding | null): boolean {
    return ConversationAudience.answers(standing);
  },

  listsResolved(standing: ConversationStanding): boolean {
    return standing === 'assignee';
  },

  listsRuns(standing: ConversationStanding): standing is RunStanding {
    return standing === 'assignee' || standing === 'following';
  },
};

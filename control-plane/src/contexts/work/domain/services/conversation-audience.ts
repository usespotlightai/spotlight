import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export const CONVERSATION_STANDINGS = [
  'assignee',
  'team',
  'following',
] as const;

export type ConversationStanding = (typeof CONVERSATION_STANDINGS)[number];

export interface ConversationViewer {
  readonly person: UserId;
  readonly onTeam: boolean;
}

export interface ConversationReader extends ConversationViewer {
  readonly wroteIn: boolean;
}

export const ConversationAudience = {
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

    return assignee !== null && reader.wroteIn ? 'following' : null;
  },

  answers(standing: ConversationStanding | null): boolean {
    return standing === 'assignee' || standing === 'team';
  },

  notifies(standing: ConversationStanding | null): boolean {
    return ConversationAudience.answers(standing);
  },

  listsResolved(standing: ConversationStanding): boolean {
    return standing === 'assignee';
  },

  listsRuns(standing: ConversationStanding): boolean {
    return standing !== 'team';
  },
};

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
  readonly team: TeamStanding;
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

export interface Awaiting {
  readonly assignee: UserId | null;
  readonly ask: OpenAsk | null;
}

const awaits = (ask: OpenAsk, person: UserId): boolean =>
  (ask.approval?.open === true &&
    (ask.approval.askedOf?.equals(person) ?? false)) ||
  (ask.connectionAsk?.met === false &&
    ask.connectionAsk.personId.equals(person));

interface AnsweringReader {
  readonly person: UserId;
  readonly takesTasks: boolean;
  readonly asked: boolean;
}

export interface ConversationReader extends AnsweringReader {
  readonly wroteIn: boolean;
}

const answeringStandingOf = (
  assignee: UserId | null,
  reader: AnsweringReader,
): ConversationStanding | null => {
  if (assignee?.equals(reader.person)) {
    return 'assignee';
  }

  if (assignee === null && reader.takesTasks) {
    return 'team';
  }

  return reader.asked ? 'asked' : null;
};

const answeringOf = (
  assignee: UserId | null,
  ask: OpenAsk | null,
  viewer: ConversationViewer,
): ConversationStanding | null =>
  answeringStandingOf(assignee, {
    person: viewer.person,
    takesTasks: viewer.team.takesTasks,
    asked: ask !== null && awaits(ask, viewer.person),
  });

export interface Conversant {
  readonly standing: ConversationStanding | null;
  readonly drives: boolean;
}

export const ConversationAudience = {
  asks(ask: OpenAsk | null, person: UserId): boolean {
    return ask !== null && awaits(ask, person);
  },

  standingOf(
    assignee: UserId | null,
    reader: ConversationReader,
  ): ConversationStanding | null {
    return (
      answeringStandingOf(assignee, reader) ??
      (assignee !== null && reader.wroteIn ? 'following' : null)
    );
  },

  waitsFor(
    assignee: UserId | null,
    ask: OpenAsk | null,
    viewer: ConversationViewer,
  ): boolean {
    return ConversationAudience.answersAwaiting(
      { assignee, ask },
      viewer,
      false,
    );
  },

  answersAwaiting(
    awaiting: Awaiting,
    viewer: ConversationViewer,
    drives: boolean,
  ): boolean {
    return ConversationAudience.mayAnswer(viewer.team, {
      standing: answeringOf(awaiting.assignee, awaiting.ask, viewer),
      drives,
    });
  },

  answeredByMessage(ask: OpenAsk | null): boolean {
    return (ask?.approval ?? null) === null;
  },

  answers(standing: ConversationStanding | null): boolean {
    return (
      standing === 'assignee' || standing === 'asked' || standing === 'team'
    );
  },

  resolves(standing: ConversationStanding | null): boolean {
    return standing === 'assignee' || standing === 'team';
  },

  mayAnswer(team: TeamStanding, conversant: Conversant): boolean {
    return (
      team.actsOnTasks &&
      (conversant.drives || ConversationAudience.answers(conversant.standing))
    );
  },

  mayResolve(team: TeamStanding, conversant: Conversant): boolean {
    return (
      team.actsOnTasks &&
      (conversant.drives || ConversationAudience.resolves(conversant.standing))
    );
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

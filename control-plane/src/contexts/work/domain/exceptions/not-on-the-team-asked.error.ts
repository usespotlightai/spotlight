import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export type TeamAction = 'answer' | 'resolve' | 'reopen' | 'hold';

const BECAUSE: Record<TeamAction, string> = {
  answer:
    'waits for its team. The first answer assigns the task, so only a member of the team can answer it.',
  resolve:
    'waits for its team. Resolving it assigns the task, so only a member of the team can resolve it.',
  reopen: 'waits for its team. Only a member of the team can reopen it.',
  hold: 'goes on hold when you message it. A hold assigns the task, so only a member of the team can message it.',
};

export class NotOnTheTeamAskedError extends DomainError {
  readonly kind = 'not-allowed' as const;

  constructor(taskId: string, action: TeamAction) {
    super(
      `Task ${taskId} ${BECAUSE[action]} Workspace admins who are not on the team cannot.`,
    );
    this.name = 'NotOnTheTeamAskedError';
  }
}

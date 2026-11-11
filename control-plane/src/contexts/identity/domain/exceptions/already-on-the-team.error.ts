import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class AlreadyOnTheTeamError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(team: string) {
    super(`${team} already includes this person.`);
    this.name = 'AlreadyOnTheTeamError';
  }
}

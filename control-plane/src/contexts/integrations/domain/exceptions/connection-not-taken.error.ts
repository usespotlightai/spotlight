import type { ConnectionOwnerKind } from '@integrations/domain/value-objects/connection-owner.vo';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

const ACCOUNT: Record<ConnectionOwnerKind, string> = {
  team: 'a team account',
  person: 'a personal account',
};

export class ConnectionNotTakenError extends DomainError {
  readonly kind = 'not-found' as const;

  constructor(
    integration: string,
    readonly owner: ConnectionOwnerKind,
  ) {
    super(`Integration ${integration} doesn't take ${ACCOUNT[owner]}.`);
    this.name = 'ConnectionNotTakenError';
  }
}

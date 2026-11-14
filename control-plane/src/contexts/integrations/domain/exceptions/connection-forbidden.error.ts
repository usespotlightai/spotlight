import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export type ConnectionDenial = 'not-workspace-admin' | 'not-the-person';

const MESSAGES: Record<ConnectionDenial, string> = {
  'not-workspace-admin':
    'Only a workspace owner or admin can connect a team account.',
  'not-the-person': 'Only its person can connect a personal account.',
};

export class ConnectionForbiddenError extends DomainError {
  readonly kind = 'not-allowed' as const;

  constructor(readonly denial: ConnectionDenial) {
    super(MESSAGES[denial]);
    this.name = 'ConnectionForbiddenError';
  }
}

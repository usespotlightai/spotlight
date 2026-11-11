import type { RoleAssignmentDenial } from '@identity/domain/services/role-assignment';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

const MESSAGES: Record<Exclude<RoleAssignmentDenial, 'last-owner'>, string> = {
  'not-a-member': 'This person is not a member of this workspace.',
  'not-an-admin': 'Only an owner or an admin can set roles.',
  'not-below-you': 'You can only set roles for people below you.',
  'your-own': 'You cannot change your own role.',
  'above-your-rank': 'You cannot assign a role above your own.',
};

export class RoleAssignmentDeniedError extends DomainError {
  readonly kind = 'not-allowed' as const;

  constructor(readonly denial: Exclude<RoleAssignmentDenial, 'last-owner'>) {
    super(MESSAGES[denial]);
    this.name = 'RoleAssignmentDeniedError';
  }
}

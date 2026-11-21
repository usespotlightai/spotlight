import type { RoleAssignmentDenial } from '@identity/domain/services/role-assignment';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

const MESSAGES: Record<Exclude<RoleAssignmentDenial, 'last-owner'>, string> = {
  'not-a-member': 'This person is not a member of this workspace.',
  'not-an-admin': 'Only an owner or an admin can set roles.',
  'not-below-you': 'You can only set roles for people below you.',
  'your-own': 'You cannot change your own role.',
  'above-your-rank': 'You cannot assign a role above your own.',
  'not-an-admin-to-suspend':
    'Only an owner or an admin can suspend or unsuspend people.',
  'suspend-your-own':
    'You cannot suspend yourself. Leave the workspace instead.',
  'suspend-above-your-rank':
    'Only an owner can suspend or unsuspend another owner.',
  'suspended-member': 'This person is suspended. Unsuspend them first.',
};

export class RoleAssignmentDeniedError extends DomainError {
  readonly kind = 'not-allowed' as const;

  constructor(readonly denial: Exclude<RoleAssignmentDenial, 'last-owner'>) {
    super(MESSAGES[denial]);
    this.name = 'RoleAssignmentDeniedError';
  }
}

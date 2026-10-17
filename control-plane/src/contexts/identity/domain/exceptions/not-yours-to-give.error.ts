import type { RoleAssignmentDenial } from '@identity/domain/services/role-giving';

export type NotYoursToGiveDenial = Exclude<RoleAssignmentDenial, 'last-owner'>;

const SAYING: Record<NotYoursToGiveDenial, string> = {
  'not-a-member': 'This person is not a member of this workspace.',
  'not-yours-to-give': 'Only an owner or an admin can set roles.',
  'not-below-you': 'You can only set roles for people below you.',
  'your-own': 'You cannot change your own role.',
  'above-your-rank': 'You cannot give a role above your own.',
};

export class NotYoursToGiveError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor(readonly denial: NotYoursToGiveDenial) {
    super(SAYING[denial]);
    this.name = 'NotYoursToGiveError';
  }
}

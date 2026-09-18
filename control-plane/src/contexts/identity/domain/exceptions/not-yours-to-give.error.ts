import type { RefusalToGive } from '@identity/domain/services/role-giving';

export type RefusalNotYoursToGive = Exclude<RefusalToGive, 'last-owner'>;

const SAYING: Record<RefusalNotYoursToGive, string> = {
  'not-a-member': 'they are not of this workspace',
  'not-yours-to-give': 'only an owner or an admin may set roles',
  'not-below-you': 'they are not below you',
  'your-own': 'your own is not yours to change',
  'above-your-rank': 'nobody hands out a rank they do not hold',
};

export class NotYoursToGiveError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor(readonly refusal: RefusalNotYoursToGive) {
    super(`That role is not yours to give: ${SAYING[refusal]}`);
    this.name = 'NotYoursToGiveError';
  }
}

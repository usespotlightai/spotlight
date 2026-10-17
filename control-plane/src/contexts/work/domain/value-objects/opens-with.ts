import type { LineRole } from '@work/domain/value-objects/line-role.vo';
import type { Mark } from '@work/domain/value-objects/mark.vo';
import type { ReviewRequest } from '@work/domain/value-objects/review-request.vo';
import type { StationKey } from '@work/domain/value-objects/station-key.vo';

export interface OpensWith {
  readonly lineRole: LineRole;
  readonly station: StationKey | null;
  readonly title: string;
  readonly description: string | null;
  readonly assignEmail: string | null;
  readonly marks: readonly Mark[];
  readonly review: ReviewRequest | null;
}

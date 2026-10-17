import type {
  Invalid,
  Rejected,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { LineProblems } from '@work/application/rendering/line-problems';
import { InvalidReviewPolicyError } from '@work/domain/exceptions/invalid-review-policy.error';
import { InvalidStationLayoutError } from '@work/domain/exceptions/invalid-station-layout.error';
import { LineInUseError } from '@work/domain/exceptions/line-in-use.error';
import { LineRoleTakenError } from '@work/domain/exceptions/line-role-taken.error';
import { StrandedWorkError } from '@work/domain/exceptions/stranded-work.error';

export const lineRejection = (
  key: string,
  error: unknown,
): Invalid | Extract<Rejected, { outcome: 'in-use' }> | null => {
  if (error instanceof LineInUseError || error instanceof StrandedWorkError) {
    return { outcome: 'in-use', reason: error.message };
  }

  if (error instanceof LineRoleTakenError) {
    return {
      outcome: 'invalid',
      problems: [LineProblems.roleClaimedTwice(error.claim)],
    };
  }

  if (error instanceof ImmutableFieldError) {
    return {
      outcome: 'invalid',
      problems: [LineProblems.immutableField(key, error.field, error.because)],
    };
  }

  if (error instanceof InvalidStationLayoutError) {
    return {
      outcome: 'invalid',
      problems: [
        LineProblems.unapplied(key, FieldPath.of(['stations']), error),
      ],
    };
  }

  if (error instanceof InvalidReviewPolicyError) {
    return {
      outcome: 'invalid',
      problems: [LineProblems.unapplied(key, FieldPath.of(['reviews']), error)],
    };
  }

  return null;
};

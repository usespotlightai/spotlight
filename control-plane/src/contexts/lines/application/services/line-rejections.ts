import { LineProblems } from '@lines/application/rendering/line-problems';
import { InvalidReviewPolicyError } from '@lines/domain/exceptions/invalid-review-policy.error';
import { InvalidStationLayoutError } from '@lines/domain/exceptions/invalid-station-layout.error';
import { LineInUseError } from '@lines/domain/exceptions/line-in-use.error';
import { LineRoleTakenError } from '@lines/domain/exceptions/line-role-taken.error';
import type {
  Invalid,
  Rejected,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export const lineRejection = (
  key: string,
  error: unknown,
): Invalid | Extract<Rejected, { outcome: 'in-use' }> | null => {
  if (error instanceof LineInUseError) {
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

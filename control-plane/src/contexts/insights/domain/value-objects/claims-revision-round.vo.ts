import { InvalidClaimsRevisionError } from '@insights/domain/exceptions/invalid-claims-revision.error';
import type { ClaimsRevisionId } from '@insights/domain/value-objects/claims-revision-id.vo';

/**
 * One try at a claims revision: its drafting session and the judging sessions of its candidates. A try that failed
 * and is retried is a new round, so it orders new sessions and reserves its judge calls again.
 */
export class ClaimsRevisionRound {
  private readonly kind = 'claims-revision-round';

  private constructor(
    readonly revisionId: ClaimsRevisionId,
    readonly attempt: number,
  ) {}

  static of(input: {
    revisionId: ClaimsRevisionId;
    attempt: number;
  }): ClaimsRevisionRound {
    if (!Number.isInteger(input.attempt) || input.attempt < 1) {
      throw new InvalidClaimsRevisionError(
        `counts its tries from 1, not ${input.attempt}`,
      );
    }

    return new ClaimsRevisionRound(input.revisionId, input.attempt);
  }

  equals(other: ClaimsRevisionRound): boolean {
    return (
      other instanceof ClaimsRevisionRound &&
      this.revisionId.equals(other.revisionId) &&
      this.attempt === other.attempt
    );
  }
}

import { InvalidDecisionError } from '@change-review/domain/exceptions/invalid-decision.error';
import type { DecisionDisputeId } from '@change-review/domain/value-objects/decision-dispute-id.vo';
import type { FilePath } from '@change-review/domain/value-objects/file-path.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

const MOST_REASON = 1_000;

export class DecisionDispute {
  private constructor(
    readonly id: DecisionDisputeId,
    readonly path: FilePath,
    readonly by: UserId,
    readonly reason: string,
    readonly at: Date,
  ) {}

  static of(input: {
    id: DecisionDisputeId;
    path: FilePath;
    by: UserId;
    reason: string;
    at: Date;
  }): DecisionDispute {
    const reason = input.reason.trim();

    if (!reason || reason.length > MOST_REASON) {
      throw new InvalidDecisionError(
        `is disputed with a reason of at most ${MOST_REASON} characters`,
      );
    }

    return new DecisionDispute(
      input.id,
      input.path,
      input.by,
      reason,
      input.at,
    );
  }

  equals(other: DecisionDispute): boolean {
    return this.id.equals(other.id);
  }

  static rehydrate(input: {
    id: DecisionDisputeId;
    path: FilePath;
    by: UserId;
    reason: string;
    at: Date;
  }): DecisionDispute {
    return new DecisionDispute(
      input.id,
      input.path,
      input.by,
      input.reason,
      input.at,
    );
  }
}

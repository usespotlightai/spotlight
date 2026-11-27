import { InvalidRunVerdictError } from '@insights/domain/exceptions/invalid-run-verdict.error';
import type { LabelSource } from '@insights/domain/value-objects/label-source';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export const MAX_VERDICT_REASON_CHARS = 2_000;

export class PersonVerdict {
  private constructor(
    readonly right: boolean,
    readonly reason: string | null,
    readonly by: UserId,
    readonly at: Date,
  ) {}

  static of(input: {
    readonly right: boolean;
    readonly reason: string | null;
    readonly by: UserId;
    readonly at: Date;
  }): PersonVerdict {
    const reason = input.reason?.trim() ?? '';

    if (input.right && reason) {
      throw new InvalidRunVerdictError(
        'takes a reason only where the run was wrong',
      );
    }
    if (reason.length > MAX_VERDICT_REASON_CHARS) {
      throw new InvalidRunVerdictError(
        `takes a reason of at most ${MAX_VERDICT_REASON_CHARS} characters`,
      );
    }

    return new PersonVerdict(input.right, reason || null, input.by, input.at);
  }

  get labelFrom(): LabelSource {
    return this.right ? 'marked-right' : 'marked-wrong';
  }

  saysTheSameAs(other: PersonVerdict | null): boolean {
    return (
      other !== null &&
      other.right === this.right &&
      other.reason === this.reason &&
      other.by.equals(this.by)
    );
  }
}

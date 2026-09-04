import { EventRecorder } from '@domain/aggregates/event-recorder';
import { RunnerRevoked } from '@domain/events/runner-revoked.event';
import { InconsistentStateError } from '@domain/exceptions/inconsistent-state.error';
import { RevokedRunnerError } from '@domain/exceptions/revoked-runner.error';
import type { HarnessId } from '@domain/value-objects/harness-id.vo';
import type { RunnerId } from '@domain/value-objects/runner-id.vo';
import type { RunnerName } from '@domain/value-objects/runner-name.vo';
import type { TokenHash } from '@domain/value-objects/token-hash.vo';

/**
 * Name and token are decided at enrolment. What harnesses it has is not: what
 * is installed on a machine is the machine's to say.
 */
export class Runner extends EventRecorder {
  private constructor(
    readonly id: RunnerId,
    readonly name: RunnerName,
    readonly tokenHash: TokenHash,
    readonly harnesses: readonly HarnessId[],
    readonly revokedAt: Date | null,
    readonly lastSeenAt: Date | null,
  ) {
    super();
  }

  static enrol(input: {
    id: RunnerId;
    name: RunnerName;
    tokenHash: TokenHash;
  }): Runner {
    return new Runner(input.id, input.name, input.tokenHash, [], null, null);
  }

  static rehydrate(input: {
    id: RunnerId;
    name: RunnerName;
    tokenHash: TokenHash;
    harnesses: readonly HarnessId[];
    revokedAt: Date | null;
    lastSeenAt: Date | null;
  }): Runner {
    if (
      input.revokedAt &&
      input.lastSeenAt &&
      input.lastSeenAt > input.revokedAt
    ) {
      throw new InconsistentStateError(
        'runner',
        'was seen after it was revoked',
      );
    }

    return new Runner(
      input.id,
      input.name,
      input.tokenHash,
      [...input.harnesses],
      input.revokedAt,
      input.lastSeenAt,
    );
  }

  get revoked(): boolean {
    return this.revokedAt !== null;
  }

  get hasConnected(): boolean {
    return this.lastSeenAt !== null;
  }

  /** Reported on every registration, so restarting corrects the record. */
  reports(harnesses: readonly HarnessId[]): Runner {
    this.refuseRevoked();

    return this.with({ harnesses: [...harnesses] });
  }

  /** Every call says so, not just the first: silence stops it being counted on. */
  seen(now: Date): Runner {
    this.refuseRevoked();

    return this.with({ lastSeenAt: now });
  }

  /** Retires the token. Whatever it was holding is no longer being served. */
  revoke(now: Date): Runner {
    if (this.revoked) {
      return this;
    }

    const revoked = this.with({ revokedAt: now });

    revoked.record(new RunnerRevoked(this.id));

    return revoked;
  }

  equals(other: Runner): boolean {
    return this.id.equals(other.id);
  }

  private refuseRevoked(): void {
    if (this.revoked) {
      throw new RevokedRunnerError();
    }
  }

  private with(part: {
    harnesses?: readonly HarnessId[];
    revokedAt?: Date;
    lastSeenAt?: Date;
  }): Runner {
    return new Runner(
      this.id,
      this.name,
      this.tokenHash,
      part.harnesses ?? this.harnesses,
      part.revokedAt ?? this.revokedAt,
      part.lastSeenAt ?? this.lastSeenAt,
    );
  }
}

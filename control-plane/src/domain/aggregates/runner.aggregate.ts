import { EventRecorder } from '@domain/aggregates/event-recorder';
import { RunnerRevoked } from '@domain/events/runner-revoked.event';
import { InconsistentStateError } from '@domain/exceptions/inconsistent-state.error';
import { RevokedRunnerError } from '@domain/exceptions/revoked-runner.error';
import type { HarnessId } from '@domain/value-objects/harness-id.vo';
import type { HarnessModel } from '@domain/value-objects/harness-model.vo';
import type { RunnerId } from '@domain/value-objects/runner-id.vo';
import type { RunnerName } from '@domain/value-objects/runner-name.vo';
import type { TokenHash } from '@domain/value-objects/token-hash.vo';

export interface InstalledHarness {
  readonly id: HarnessId;
  readonly models: readonly HarnessModel[];
}

export class Runner extends EventRecorder {
  private constructor(
    readonly id: RunnerId,
    readonly name: RunnerName,
    readonly tokenHash: TokenHash,
    readonly installed: readonly InstalledHarness[],
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
    installed: readonly InstalledHarness[];
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
      [...input.installed],
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

  get harnesses(): readonly HarnessId[] {
    return this.installed.map((each) => each.id);
  }

  modelsOf(harness: HarnessId): readonly HarnessModel[] {
    return this.installed.find((each) => each.id.equals(harness))?.models ?? [];
  }

  reports(installed: readonly InstalledHarness[]): Runner {
    this.refuseRevoked();

    return this.with({ installed: [...installed] });
  }

  seen(now: Date): Runner {
    this.refuseRevoked();

    return this.with({ lastSeenAt: now });
  }

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
    installed?: readonly InstalledHarness[];
    revokedAt?: Date;
    lastSeenAt?: Date;
  }): Runner {
    return new Runner(
      this.id,
      this.name,
      this.tokenHash,
      part.installed ?? this.installed,
      part.revokedAt ?? this.revokedAt,
      part.lastSeenAt ?? this.lastSeenAt,
    );
  }
}

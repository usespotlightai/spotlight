import { RunnerEnrolled } from '@runners/domain/events/runner-enrolled.event';
import { RunnerRegistered } from '@runners/domain/events/runner-registered.event';
import { RunnerReportedHarnesses } from '@runners/domain/events/runner-reported-harnesses.event';
import { RunnerRevoked } from '@runners/domain/events/runner-revoked.event';
import { RevokedRunnerError } from '@runners/domain/exceptions/revoked-runner.error';
import type { InstalledHarness } from '@runners/domain/value-objects/installed-harness.vo';
import type { RunnerName } from '@runners/domain/value-objects/runner-name.vo';
import { EventRecorder } from '@shared-kernel/domain/aggregates/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const sameInstalled = (
  a: readonly InstalledHarness[],
  b: readonly InstalledHarness[],
): boolean =>
  a.length === b.length && a.every((each, at) => each.equals(b[at]));

export class Runner extends EventRecorder {
  private constructor(
    readonly id: RunnerId,
    readonly workspaceId: WorkspaceId,
    readonly name: RunnerName,
    readonly tokenHash: TokenHash,
    readonly installed: readonly InstalledHarness[],
    readonly revokedAt: Date | null,
    readonly lastSeenAt: Date | null,
    readonly version: number,
  ) {
    super();
  }

  static enrol(input: {
    id: RunnerId;
    workspaceId: WorkspaceId;
    name: RunnerName;
    tokenHash: TokenHash;
  }): Runner {
    const enrolled = new Runner(
      input.id,
      input.workspaceId,
      input.name,
      input.tokenHash,
      [],
      null,
      null,
      0,
    );

    enrolled.record(new RunnerEnrolled(input.id, input.workspaceId));

    return enrolled;
  }

  static rehydrate(input: {
    id: RunnerId;
    workspaceId: WorkspaceId;
    name: RunnerName;
    tokenHash: TokenHash;
    installed: readonly InstalledHarness[];
    revokedAt: Date | null;
    lastSeenAt: Date | null;
    version: number;
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

    if (!Number.isInteger(input.version) || input.version < 0) {
      throw new InconsistentStateError(
        'runner',
        `has an impossible version (${input.version})`,
      );
    }

    return new Runner(
      input.id,
      input.workspaceId,
      input.name,
      input.tokenHash,
      [...input.installed],
      input.revokedAt,
      input.lastSeenAt,
      input.version,
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

  belongsTo(workspaceId: WorkspaceId): boolean {
    return this.workspaceId.equals(workspaceId);
  }

  register(installed: readonly InstalledHarness[], at: Date): Runner {
    const registered = this.seen(at);

    registered.record(new RunnerRegistered(this.id, this.workspaceId));

    if (sameInstalled(this.installed, installed)) {
      return registered;
    }

    const reported = registered.with({ installed: [...installed] });

    reported.record(
      new RunnerReportedHarnesses(
        this.id,
        this.workspaceId,
        reported.harnesses,
      ),
    );

    return reported;
  }

  seen(at: Date): Runner {
    this.refuseRevoked();

    return this.with({ lastSeenAt: at });
  }

  revoke(at: Date): Runner {
    if (this.revoked) {
      return this;
    }

    const revoked = this.with({ revokedAt: at });

    revoked.record(new RunnerRevoked(this.id, this.workspaceId));

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
    const next = new Runner(
      this.id,
      this.workspaceId,
      this.name,
      this.tokenHash,
      part.installed ?? this.installed,
      part.revokedAt ?? this.revokedAt,
      part.lastSeenAt ?? this.lastSeenAt,
      this.version,
    );

    next.inheritEvents(this);

    return next;
  }
}

import type { RunnerTrust } from '@runners/domain/aggregates/runner-trust.aggregate';
import { RunnerEnrolled } from '@runners/domain/events/runner-enrolled.event';
import { RunnerRedefined } from '@runners/domain/events/runner-redefined.event';
import { RunnerRegistered } from '@runners/domain/events/runner-registered.event';
import { RunnerRekeyed } from '@runners/domain/events/runner-rekeyed.event';
import { RunnerReportedHarnesses } from '@runners/domain/events/runner-reported-harnesses.event';
import { RunnerRevoked } from '@runners/domain/events/runner-revoked.event';
import { RevokedRunnerError } from '@runners/domain/exceptions/revoked-runner.error';
import { RunnerNameFixedError } from '@runners/domain/exceptions/runner-name-fixed.error';
import { RunnerRevisedError } from '@runners/domain/exceptions/runner-revised.error';
import type { InstalledHarness } from '@runners/domain/value-objects/installed-harness.vo';
import { RunnerChangeDetail } from '@runners/domain/value-objects/runner-change-detail.vo';
import { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import type { RunnerName } from '@runners/domain/value-objects/runner-name.vo';
import type { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
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
    readonly labels: RunnerLabels,
    readonly trustId: RunnerTrustId | null,
    readonly installed: readonly InstalledHarness[],
    readonly revokedAt: Date | null,
    readonly lastSeenAt: Date | null,
    readonly revision: number,
    readonly version: number,
  ) {
    super();
  }

  static enrol(input: {
    id: RunnerId;
    workspaceId: WorkspaceId;
    name: RunnerName;
    tokenHash: TokenHash;
    labels?: RunnerLabels;
    trustId?: RunnerTrustId | null;
    by: Attribution;
  }): Runner {
    const enrolled = new Runner(
      input.id,
      input.workspaceId,
      input.name,
      input.tokenHash,
      input.labels ?? RunnerLabels.none(),
      input.trustId ?? null,
      [],
      null,
      null,
      0,
      0,
    );

    enrolled.record(
      new RunnerEnrolled(
        input.id,
        input.workspaceId,
        ConfigurationChange.created(
          enrolled.whatChanged,
          input.by,
          RunnerChangeDetail.enrolledUnder(enrolled.trustId),
        ),
      ),
    );

    return enrolled;
  }

  static rehydrate(input: {
    id: RunnerId;
    workspaceId: WorkspaceId;
    name: RunnerName;
    tokenHash: TokenHash;
    labels?: RunnerLabels;
    trustId?: RunnerTrustId | null;
    installed: readonly InstalledHarness[];
    revokedAt: Date | null;
    lastSeenAt: Date | null;
    revision?: number;
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
      input.labels ?? RunnerLabels.none(),
      input.trustId ?? null,
      [...input.installed],
      input.revokedAt,
      input.lastSeenAt,
      input.revision ?? 0,
      input.version,
    );
  }

  get revoked(): boolean {
    return this.revokedAt !== null;
  }

  get hasConnected(): boolean {
    return this.lastSeenAt !== null;
  }

  get offersWork(): boolean {
    return this.hasConnected && !this.revoked && this.installed.length > 0;
  }

  get harnesses(): readonly HarnessId[] {
    return this.installed.map((each) => each.id);
  }

  modelsOf(harness: HarnessId): readonly HarnessModel[] {
    return this.installed.find((each) => each.id.equals(harness))?.models ?? [];
  }

  get holdsWorkspace(): boolean {
    return !this.revoked && this.trustId === null;
  }

  enrolledUnder(trustId: RunnerTrustId): boolean {
    return this.trustId?.equals(trustId) ?? false;
  }

  standsWith(trust: RunnerTrust | null): boolean {
    if (this.revoked) {
      return false;
    }

    return (
      this.trustId === null ||
      (trust !== null && this.enrolledUnder(trust.id) && !trust.isWithdrawn)
    );
  }

  termsWith(trust: RunnerTrust | null): RunnerTerms {
    const labels =
      trust && this.enrolledUnder(trust.id)
        ? this.labels.joinedWith(trust.labels)
        : this.labels;

    return RunnerTerms.of([this.name.value, ...labels.values]);
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

  expecting(revision: number): void {
    if (revision !== this.revision) {
      throw new RunnerRevisedError(this.id.value);
    }
  }

  redefinedAs(
    definition: {
      name: RunnerName;
      labels: RunnerLabels;
      tokenHash: TokenHash | null;
    },
    by: Attribution,
  ): Runner {
    this.refuseRevoked();

    if (!definition.name.equals(this.name)) {
      throw new RunnerNameFixedError(
        this.name.value,
        `keeps its name for its whole life, since it is the runner's address; replace it to call a runner ${definition.name.value}`,
      );
    }

    const redefined = this.with({
      labels: definition.labels,
      tokenHash: definition.tokenHash ?? undefined,
      revision: this.revision + 1,
    });

    redefined.record(
      new RunnerRedefined(
        this.id,
        this.workspaceId,
        ConfigurationChange.updated(
          this.whatChanged,
          by,
          RunnerChangeDetail.redefined(definition.tokenHash !== null),
        ),
      ),
    );

    return redefined;
  }

  rekeyed(tokenHash: TokenHash, by: Attribution): Runner {
    this.refuseRevoked();

    const rekeyed = this.with({ tokenHash });

    rekeyed.record(
      new RunnerRekeyed(
        this.id,
        this.workspaceId,
        ConfigurationChange.updated(
          this.whatChanged,
          by,
          RunnerChangeDetail.redefined(true),
        ),
      ),
    );

    return rekeyed;
  }

  revoke(at: Date, by: Attribution): Runner {
    if (this.revoked) {
      return this;
    }

    const revoked = this.with({ revokedAt: at });

    revoked.record(
      new RunnerRevoked(
        this.id,
        this.workspaceId,
        ConfigurationChange.deleted(this.whatChanged, by),
      ),
    );

    return revoked;
  }

  equals(other: Runner): boolean {
    return this.id.equals(other.id);
  }

  private get whatChanged() {
    return {
      resource: 'runner' as const,
      id: this.id.value,
      key: this.name.value,
    };
  }

  private refuseRevoked(): void {
    if (this.revoked) {
      throw new RevokedRunnerError();
    }
  }

  private with(part: {
    tokenHash?: TokenHash;
    labels?: RunnerLabels;
    installed?: readonly InstalledHarness[];
    revokedAt?: Date;
    lastSeenAt?: Date;
    revision?: number;
  }): Runner {
    const next = new Runner(
      this.id,
      this.workspaceId,
      this.name,
      part.tokenHash ?? this.tokenHash,
      part.labels ?? this.labels,
      this.trustId,
      part.installed ?? this.installed,
      part.revokedAt ?? this.revokedAt,
      part.lastSeenAt ?? this.lastSeenAt,
      part.revision ?? this.revision,
      this.version,
    );

    next.inheritEvents(this);

    return next;
  }
}

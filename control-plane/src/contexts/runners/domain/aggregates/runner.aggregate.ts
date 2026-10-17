import { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import type { RunnerTrust } from '@runners/domain/aggregates/runner-trust.aggregate';
import { RunnerSpentError } from '@runners/domain/exceptions/runner-spent.error';
import { Admission } from '@runners/domain/value-objects/admission.vo';
import type { HostId } from '@runners/domain/value-objects/host-id.vo';
import type { InstalledHarness } from '@runners/domain/value-objects/installed-harness.vo';
import type { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import type {
  RunnerWork,
  RunnerWorkKind,
} from '@runners/domain/value-objects/runner-work.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import type { RunningImage } from '@shared-kernel/domain/value-objects/running-image.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export type RunnerClaims = 'reserved' | 'nothing';

const HOLDS_UNSEEN_MS: Readonly<Record<RunnerWorkKind, number>> = {
  run: 3 * 60_000,
  check: 12 * 60_000,
};

const LONGEST_HOLD_UNSEEN_MS = Math.max(...Object.values(HOLDS_UNSEEN_MS));

const REMEMBERED_AFTER_ENDING_MS = 24 * 60 * 60_000;

const RECORDS_AFTER_ENDING_MS = 2 * 60_000;

interface State {
  readonly id: RunnerId;
  readonly workspaceId: WorkspaceId;
  readonly admission: Admission;
  readonly hostId: HostId | null;
  readonly labels: RunnerLabels;
  readonly tokenHash: TokenHash;
  readonly egressTokenHash: TokenHash | null;
  readonly proxyCredentialHash: TokenHash | null;
  readonly installed: readonly InstalledHarness[];
  readonly running: RunningImage | null;
  readonly work: RunnerWork | null;
  readonly claimBy: Date;
  readonly startedAt: Date;
  readonly lastSeenAt: Date | null;
  readonly endedAt: Date | null;
  readonly version: number;
}

export class Runner extends EventRecorder {
  private constructor(
    private readonly state: State,
    readonly isDiscarded: boolean,
  ) {
    super();
  }

  static start(input: {
    id: RunnerId;
    through: RunnerPool | RunnerTrust;
    host: HostId | null;
    tokenHash: TokenHash;
    egressTokenHash: TokenHash | null;
    proxyCredentialHash: TokenHash | null;
    installed: readonly InstalledHarness[];
    running: RunningImage | null;
    at: Date;
    claimBy: Date;
  }): Runner {
    const { through } = input;

    if (
      through instanceof RunnerPool ? through.isRetired : through.isWithdrawn
    ) {
      throw new InconsistentStateError(
        'runner',
        'was started through a pool or trust that is gone',
      );
    }

    const goesOutThroughEgress =
      through instanceof RunnerPool && through.egress !== null;

    if (goesOutThroughEgress !== (input.proxyCredentialHash !== null)) {
      throw new InconsistentStateError(
        'runner',
        'was given a proxy credential that does not match the egress of its pool',
      );
    }

    if (input.claimBy.getTime() <= input.at.getTime()) {
      throw new InconsistentStateError(
        'runner',
        'was given no time to claim its work',
      );
    }

    return new Runner(
      {
        id: input.id,
        workspaceId: through.workspaceId,
        admission: Admission.through(through.id),
        hostId: input.host,
        labels: through.labels,
        tokenHash: input.tokenHash,
        egressTokenHash: input.egressTokenHash,
        proxyCredentialHash: input.proxyCredentialHash,
        installed: [...input.installed],
        running: input.running,
        work: null,
        claimBy: input.claimBy,
        startedAt: input.at,
        lastSeenAt: null,
        endedAt: null,
        version: 0,
      },
      false,
    );
  }

  static rehydrate(state: State): Runner {
    if (!Number.isInteger(state.version) || state.version < 0) {
      throw new InconsistentStateError(
        'runner',
        `has an impossible version (${state.version})`,
      );
    }

    if (state.endedAt && state.endedAt < state.startedAt) {
      throw new InconsistentStateError('runner', 'ended before it started');
    }

    return new Runner({ ...state, installed: [...state.installed] }, false);
  }

  get id(): RunnerId {
    return this.state.id;
  }

  get workspaceId(): WorkspaceId {
    return this.state.workspaceId;
  }

  get admission(): Admission {
    return this.state.admission;
  }

  get hostId(): HostId | null {
    return this.state.hostId;
  }

  get labels(): RunnerLabels {
    return this.state.labels;
  }

  get tokenHash(): TokenHash {
    return this.state.tokenHash;
  }

  get egressTokenHash(): TokenHash | null {
    return this.state.egressTokenHash;
  }

  get proxyCredentialHash(): TokenHash | null {
    return this.state.proxyCredentialHash;
  }

  get installed(): readonly InstalledHarness[] {
    return this.state.installed;
  }

  get running(): RunningImage | null {
    return this.state.running;
  }

  get work(): RunnerWork | null {
    return this.state.work;
  }

  get claimBy(): Date {
    return this.state.claimBy;
  }

  get startedAt(): Date {
    return this.state.startedAt;
  }

  get lastSeenAt(): Date | null {
    return this.state.lastSeenAt;
  }

  get endedAt(): Date | null {
    return this.state.endedAt;
  }

  get version(): number {
    return this.state.version;
  }

  get hasEnded(): boolean {
    return this.state.endedAt !== null;
  }

  get harnesses(): readonly HarnessId[] {
    return this.state.installed.map((each) => each.id);
  }

  get terms(): RunnerTerms {
    return RunnerTerms.of(this.state.labels.values).runningIn(
      this.state.running,
    );
  }

  standsAt(now: Date): boolean {
    return !this.hasEnded && now.getTime() < this.standsUntil.getTime();
  }

  private get standsUntil(): Date {
    const { work, lastSeenAt, claimBy } = this.state;

    return work !== null && lastSeenAt
      ? new Date(lastSeenAt.getTime() + HOLDS_UNSEEN_MS[work.kind])
      : claimBy;
  }

  static unseenSinceLongestHold(now: Date): Date {
    return new Date(now.getTime() - LONGEST_HOLD_UNSEEN_MS);
  }

  static rememberedEndingSince(now: Date): Date {
    return new Date(now.getTime() - REMEMBERED_AFTER_ENDING_MS);
  }

  workEgressActsFor(now: Date): RunnerWork | null {
    return this.state.egressTokenHash !== null && this.standsAt(now)
      ? this.state.work
      : null;
  }

  workEgressRecordsFor(now: Date): RunnerWork | null {
    const { endedAt, work } = this.state;
    const recordsStill =
      this.standsAt(now) ||
      (endedAt !== null &&
        now.getTime() <= endedAt.getTime() + RECORDS_AFTER_ENDING_MS);

    return recordsStill ? work : null;
  }

  claimsAt(now: Date): RunnerClaims {
    return this.state.work === null && this.standsAt(now)
      ? 'reserved'
      : 'nothing';
  }

  register(installed: readonly InstalledHarness[], at: Date): Runner {
    this.refuseEnded();

    return this.with({ installed: [...installed], lastSeenAt: at });
  }

  seen(at: Date): Runner {
    this.refuseEnded();

    return this.with({ lastSeenAt: at });
  }

  took(work: RunnerWork, at: Date): Runner {
    if (this.state.work !== null || !this.standsAt(at)) {
      throw new RunnerSpentError(this.state.id.value);
    }

    return this.with({ work, lastSeenAt: at });
  }

  holds(work: RunnerWork): boolean {
    return this.state.work?.equals(work) ?? false;
  }

  ended(at: Date): Runner {
    if (this.hasEnded) {
      return this;
    }

    return this.with({ endedAt: at });
  }

  letGo(at: Date): Runner {
    if (this.state.work !== null) {
      return this.ended(at);
    }

    const discarded = new Runner(this.state, true);
    discarded.inheritEvents(this);

    return discarded;
  }

  reservationDropped(at: Date): Runner {
    return this.state.work === null ? this.letGo(at) : this;
  }

  private refuseEnded(): void {
    if (this.hasEnded) {
      throw new RunnerSpentError(this.state.id.value);
    }
  }

  private with(part: Partial<State>): Runner {
    const next = new Runner({ ...this.state, ...part }, this.isDiscarded);

    next.inheritEvents(this);

    return next;
  }
}

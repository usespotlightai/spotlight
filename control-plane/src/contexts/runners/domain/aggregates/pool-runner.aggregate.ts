import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import { PoolRunnerSpentError } from '@runners/domain/exceptions/pool-runner-spent.error';
import type { InstalledHarness } from '@runners/domain/value-objects/installed-harness.vo';
import type {
  PoolWork,
  PoolWorkKind,
} from '@runners/domain/value-objects/pool-work.vo';
import type { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import type { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export type PoolRunnerClaims = 'reserved' | 'nothing';

const HOLDS_UNSEEN_MS: Readonly<Record<PoolWorkKind, number>> = {
  run: 3 * 60_000,
  check: 12 * 60_000,
};

const LONGEST_HOLD_UNSEEN_MS = Math.max(...Object.values(HOLDS_UNSEEN_MS));

interface State {
  readonly id: RunnerId;
  readonly workspaceId: WorkspaceId;
  readonly poolId: RunnerPoolId;
  readonly labels: RunnerLabels;
  readonly tokenHash: TokenHash;
  readonly installed: readonly InstalledHarness[];
  readonly work: PoolWork | null;
  readonly claimBy: Date;
  readonly startedAt: Date;
  readonly lastSeenAt: Date | null;
  readonly endedAt: Date | null;
  readonly version: number;
}

export class PoolRunner extends EventRecorder {
  private constructor(
    private readonly state: State,
    readonly isDiscarded: boolean,
  ) {
    super();
  }

  static started(input: {
    id: RunnerId;
    pool: RunnerPool;
    tokenHash: TokenHash;
    installed: readonly InstalledHarness[];
    at: Date;
    claimBy: Date;
  }): PoolRunner {
    if (input.pool.isRetired) {
      throw new InconsistentStateError(
        'pool runner',
        'was started for a pool that is retired',
      );
    }

    if (input.claimBy.getTime() <= input.at.getTime()) {
      throw new InconsistentStateError(
        'pool runner',
        'was given no time to claim its work',
      );
    }

    return new PoolRunner(
      {
        id: input.id,
        workspaceId: input.pool.workspaceId,
        poolId: input.pool.id,
        labels: input.pool.labels,
        tokenHash: input.tokenHash,
        installed: [...input.installed],
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

  static rehydrate(state: State): PoolRunner {
    if (!Number.isInteger(state.version) || state.version < 0) {
      throw new InconsistentStateError(
        'pool runner',
        `has an impossible version (${state.version})`,
      );
    }

    if (state.endedAt && state.endedAt < state.startedAt) {
      throw new InconsistentStateError(
        'pool runner',
        'ended before it started',
      );
    }

    return new PoolRunner({ ...state, installed: [...state.installed] }, false);
  }

  get id(): RunnerId {
    return this.state.id;
  }

  get workspaceId(): WorkspaceId {
    return this.state.workspaceId;
  }

  get poolId(): RunnerPoolId {
    return this.state.poolId;
  }

  get labels(): RunnerLabels {
    return this.state.labels;
  }

  get tokenHash(): TokenHash {
    return this.state.tokenHash;
  }

  get installed(): readonly InstalledHarness[] {
    return this.state.installed;
  }

  get work(): PoolWork | null {
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
    return RunnerTerms.of([
      ...this.state.labels.values,
      ...this.state.installed.flatMap((each) =>
        each.release ? [each.release.term] : [],
      ),
    ]);
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

  claimsAt(now: Date): PoolRunnerClaims {
    return this.state.work === null && this.standsAt(now)
      ? 'reserved'
      : 'nothing';
  }

  register(installed: readonly InstalledHarness[], at: Date): PoolRunner {
    this.refuseEnded();

    return this.with({ installed: [...installed], lastSeenAt: at });
  }

  seen(at: Date): PoolRunner {
    this.refuseEnded();

    return this.with({ lastSeenAt: at });
  }

  took(work: PoolWork, at: Date): PoolRunner {
    if (this.state.work !== null || !this.standsAt(at)) {
      throw new PoolRunnerSpentError(this.state.id.value);
    }

    return this.with({ work, lastSeenAt: at });
  }

  holds(work: PoolWork): boolean {
    return this.state.work?.equals(work) ?? false;
  }

  ended(at: Date): PoolRunner {
    if (this.hasEnded) {
      return this;
    }

    return this.with({ endedAt: at });
  }

  letGo(at: Date): PoolRunner {
    if (this.state.work !== null) {
      return this.ended(at);
    }

    const discarded = new PoolRunner(this.state, true);
    discarded.inheritEvents(this);

    return discarded;
  }

  private refuseEnded(): void {
    if (this.hasEnded) {
      throw new PoolRunnerSpentError(this.state.id.value);
    }
  }

  private with(part: Partial<State>): PoolRunner {
    const next = new PoolRunner({ ...this.state, ...part }, this.isDiscarded);

    next.inheritEvents(this);

    return next;
  }
}

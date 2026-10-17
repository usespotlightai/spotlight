import { RedemptionRecipientPinnedError } from '@secrets/domain/exceptions/redemption-recipient-pinned.error';
import { RunGrantsEndedError } from '@secrets/domain/exceptions/run-grants-ended.error';
import { RunLeaseOverError } from '@secrets/domain/exceptions/run-lease-over.error';
import type { Redeemer } from '@secrets/domain/value-objects/redeemer.vo';
import type { RedemptionRecipient } from '@secrets/domain/value-objects/redemption-recipient.vo';
import { RunLease } from '@secrets/domain/value-objects/run-lease.vo';
import type { SecretGrant } from '@secrets/domain/value-objects/secret-grant.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const KEPT_MS = 7 * 24 * 60 * 60_000;

interface State {
  readonly lease: RunLease;
  readonly workspaceId: WorkspaceId;
  readonly grants: readonly SecretGrant[];
  readonly redeemer: Redeemer | null;
  readonly leaseLost: boolean;
  readonly endedAt: Date | null;
  readonly version: number;
}

export class RunGrants extends EventRecorder {
  private constructor(
    private readonly state: State,
    readonly isDiscarded = false,
  ) {
    super();
  }

  static start(lease: RunLease, workspaceId: WorkspaceId): RunGrants {
    return new RunGrants({
      lease,
      workspaceId,
      grants: [],
      redeemer: null,
      leaseLost: false,
      endedAt: null,
      version: 0,
    });
  }

  static rehydrate(kept: State): RunGrants {
    if (!Number.isInteger(kept.version) || kept.version < 1) {
      throw new InconsistentStateError(
        'run grants',
        `has an impossible version (${kept.version})`,
      );
    }

    if ((kept.endedAt || kept.leaseLost) && kept.grants.length > 0) {
      throw new InconsistentStateError(
        'run grants',
        'kept secrets granted to a lease that is over',
      );
    }

    return new RunGrants({ ...kept, grants: [...kept.grants] });
  }

  static endedForgettablyBy(now: Date): Date {
    return new Date(now.getTime() - KEPT_MS);
  }

  grant(lease: RunLease, grants: readonly SecretGrant[]): RunGrants {
    const current = this.atLease(lease);
    const fresh: SecretGrant[] = [];

    for (const grant of grants) {
      current.guardOwn(grant);

      if (
        !current.includes(grant) &&
        !fresh.some((each) => each.equals(grant))
      ) {
        fresh.push(grant);
      }
    }

    return fresh.length === 0
      ? current
      : current.with({ grants: [...current.state.grants, ...fresh] });
  }

  allows(lease: RunLease, grant: SecretGrant): boolean {
    return (
      this.isActiveFor(lease) &&
      grant.workspaceId.equals(this.workspaceId) &&
      this.includes(grant)
    );
  }

  redeemFor(lease: RunLease, redeemer: Redeemer): RunGrants {
    const current = this.atLease(lease);
    const pinned = current.state.redeemer;

    if (!pinned) {
      return current.with({ redeemer });
    }

    if (!redeemer.mayFollow(pinned)) {
      throw new RedemptionRecipientPinnedError(this.runId.value, lease.attempt);
    }

    return pinned.equals(redeemer) ? current : current.with({ redeemer });
  }

  loseLease(lease: RunLease): RunGrants {
    this.guardRun(lease);

    if (
      this.isEnded ||
      lease.precedes(this.state.lease) ||
      (lease.equals(this.state.lease) && this.state.leaseLost)
    ) {
      return this;
    }

    return this.with({ lease, grants: [], redeemer: null, leaseLost: true });
  }

  end(now: Date): RunGrants {
    return this.isEnded ? this : this.with({ grants: [], endedAt: now });
  }

  isForgettableAt(now: Date): boolean {
    const endedAt = this.state.endedAt;

    return endedAt !== null && now.getTime() >= endedAt.getTime() + KEPT_MS;
  }

  purge(now: Date): RunGrants {
    if (!this.isForgettableAt(now)) {
      throw new InconsistentStateError(
        'run grants',
        'is kept for a week after its run ends before it is forgotten',
      );
    }

    return this.discarded();
  }

  abandon(): RunGrants {
    return this.discarded();
  }

  get runId(): RunId {
    return this.state.lease.runId;
  }

  get lease(): RunLease {
    return this.state.lease;
  }

  get workspaceId(): WorkspaceId {
    return this.state.workspaceId;
  }

  get grants(): readonly SecretGrant[] {
    return [...this.state.grants];
  }

  get redeemer(): Redeemer | null {
    return this.state.redeemer;
  }

  get recipient(): RedemptionRecipient | null {
    return this.state.redeemer?.recipient ?? null;
  }

  get isLeaseLost(): boolean {
    return this.state.leaseLost;
  }

  get endedAt(): Date | null {
    return this.state.endedAt;
  }

  get isEnded(): boolean {
    return this.state.endedAt !== null;
  }

  get version(): number {
    return this.state.version;
  }

  get isNew(): boolean {
    return this.state.version === 0;
  }

  private atLease(lease: RunLease): RunGrants {
    this.guardRun(lease);

    if (this.isEnded) {
      throw new RunGrantsEndedError(this.runId.value);
    }

    if (
      lease.precedes(this.state.lease) ||
      (lease.equals(this.state.lease) && this.state.leaseLost)
    ) {
      throw new RunLeaseOverError(this.runId.value, lease.attempt);
    }

    return lease.equals(this.state.lease)
      ? this
      : this.with({ lease, grants: [], redeemer: null, leaseLost: false });
  }

  private isActiveFor(lease: RunLease): boolean {
    return (
      !this.isEnded && !this.state.leaseLost && lease.equals(this.state.lease)
    );
  }

  private includes(grant: SecretGrant): boolean {
    return this.state.grants.some((each) => each.equals(grant));
  }

  private guardRun(lease: RunLease): void {
    if (!lease.isOfRun(this.runId)) {
      throw new InconsistentStateError(
        'run grants',
        'was handed a lease of another run',
      );
    }
  }

  private guardOwn(grant: SecretGrant): void {
    if (
      !grant.runId.equals(this.runId) ||
      !grant.workspaceId.equals(this.workspaceId)
    ) {
      throw new InconsistentStateError(
        'run grants',
        'was handed a grant to another run or workspace',
      );
    }
  }

  private discarded(): RunGrants {
    const discarded = new RunGrants(this.state, true);

    discarded.inheritEvents(this);

    return discarded;
  }

  private with(change: Partial<State>): RunGrants {
    const next = new RunGrants({ ...this.state, ...change });

    next.inheritEvents(this);

    return next;
  }
}

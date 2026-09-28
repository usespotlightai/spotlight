import { RedemptionRecipientPinnedError } from '@secrets/domain/exceptions/redemption-recipient-pinned.error';
import { RunGrantsEndedError } from '@secrets/domain/exceptions/run-grants-ended.error';
import { RunHoldOverError } from '@secrets/domain/exceptions/run-hold-over.error';
import type { RedemptionRecipient } from '@secrets/domain/value-objects/redemption-recipient.vo';
import { RunHold } from '@secrets/domain/value-objects/run-hold.vo';
import type { SecretGrant } from '@secrets/domain/value-objects/secret-grant.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const KEPT_MS = 7 * 24 * 60 * 60_000;

interface State {
  readonly hold: RunHold;
  readonly workspaceId: WorkspaceId;
  readonly grants: readonly SecretGrant[];
  readonly recipient: RedemptionRecipient | null;
  readonly holdLost: boolean;
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

  static begun(hold: RunHold, workspaceId: WorkspaceId): RunGrants {
    return new RunGrants({
      hold,
      workspaceId,
      grants: [],
      recipient: null,
      holdLost: false,
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

    if ((kept.endedAt || kept.holdLost) && kept.grants.length > 0) {
      throw new InconsistentStateError(
        'run grants',
        'kept secrets granted to a hold that is over',
      );
    }

    return new RunGrants({ ...kept, grants: [...kept.grants] });
  }

  static endedForgettablyBy(now: Date): Date {
    return new Date(now.getTime() - KEPT_MS);
  }

  granted(hold: RunHold, grants: readonly SecretGrant[]): RunGrants {
    const held = this.heldAt(hold);
    const fresh: SecretGrant[] = [];

    for (const grant of grants) {
      held.guardOwn(grant);

      if (!held.holds(grant) && !fresh.some((each) => each.equals(grant))) {
        fresh.push(grant);
      }
    }

    return fresh.length === 0
      ? held
      : held.with({ grants: [...held.state.grants, ...fresh] });
  }

  allows(hold: RunHold, grant: SecretGrant): boolean {
    return (
      this.isStandingAt(hold) &&
      grant.workspaceId.equals(this.workspaceId) &&
      this.holds(grant)
    );
  }

  redeemedFor(hold: RunHold, recipient: RedemptionRecipient): RunGrants {
    const held = this.heldAt(hold);

    if (!held.state.recipient) {
      return held.with({ recipient });
    }

    if (!held.state.recipient.equals(recipient)) {
      throw new RedemptionRecipientPinnedError(this.runId.value, hold.attempt);
    }

    return held;
  }

  lostHold(hold: RunHold): RunGrants {
    this.guardRun(hold);

    if (
      this.isEnded ||
      hold.precedes(this.state.hold) ||
      (hold.equals(this.state.hold) && this.state.holdLost)
    ) {
      return this;
    }

    return this.with({ hold, grants: [], recipient: null, holdLost: true });
  }

  ended(now: Date): RunGrants {
    return this.isEnded ? this : this.with({ grants: [], endedAt: now });
  }

  isForgettableAt(now: Date): boolean {
    const endedAt = this.state.endedAt;

    return endedAt !== null && now.getTime() >= endedAt.getTime() + KEPT_MS;
  }

  forgotten(now: Date): RunGrants {
    if (!this.isForgettableAt(now)) {
      throw new InconsistentStateError(
        'run grants',
        'is kept for a week after its run ends before it is forgotten',
      );
    }

    return this.discarded();
  }

  abandoned(): RunGrants {
    return this.discarded();
  }

  get runId(): RunId {
    return this.state.hold.runId;
  }

  get hold(): RunHold {
    return this.state.hold;
  }

  get workspaceId(): WorkspaceId {
    return this.state.workspaceId;
  }

  get grants(): readonly SecretGrant[] {
    return [...this.state.grants];
  }

  get recipient(): RedemptionRecipient | null {
    return this.state.recipient;
  }

  get isHoldLost(): boolean {
    return this.state.holdLost;
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

  private heldAt(hold: RunHold): RunGrants {
    this.guardRun(hold);

    if (this.isEnded) {
      throw new RunGrantsEndedError(this.runId.value);
    }

    if (
      hold.precedes(this.state.hold) ||
      (hold.equals(this.state.hold) && this.state.holdLost)
    ) {
      throw new RunHoldOverError(this.runId.value, hold.attempt);
    }

    return hold.equals(this.state.hold)
      ? this
      : this.with({ hold, grants: [], recipient: null, holdLost: false });
  }

  private isStandingAt(hold: RunHold): boolean {
    return (
      !this.isEnded && !this.state.holdLost && hold.equals(this.state.hold)
    );
  }

  private holds(grant: SecretGrant): boolean {
    return this.state.grants.some((each) => each.equals(grant));
  }

  private guardRun(hold: RunHold): void {
    if (!hold.isOfRun(this.runId)) {
      throw new InconsistentStateError(
        'run grants',
        'was handed a hold of another run',
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

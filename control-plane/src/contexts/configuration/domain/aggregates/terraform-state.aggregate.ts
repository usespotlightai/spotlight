import { TerraformStateLockLostError } from '@configuration/domain/exceptions/terraform-state-lock-lost.error';
import { TerraformStateLockNotYoursError } from '@configuration/domain/exceptions/terraform-state-lock-not-yours.error';
import { TerraformStateLockedError } from '@configuration/domain/exceptions/terraform-state-locked.error';
import type { StateLock } from '@configuration/domain/value-objects/state-lock.vo';
import type { StateName } from '@configuration/domain/value-objects/state-name.vo';
import type { StateSnapshot } from '@configuration/domain/value-objects/state-snapshot.vo';
import { StateVersion } from '@configuration/domain/value-objects/state-version.vo';
import type { StateVersionId } from '@configuration/domain/value-objects/state-version-id.vo';
import type { TerraformStateId } from '@configuration/domain/value-objects/terraform-state-id.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

interface Props {
  readonly id: TerraformStateId;
  readonly workspaceId: WorkspaceId;
  readonly name: StateName;
  readonly lock: StateLock | null;
  readonly latest: StateVersion | null;
  readonly version: number;
}

export class TerraformState {
  private constructor(
    private readonly state: Props,
    readonly written: StateVersion | null,
  ) {}

  static open(input: {
    id: TerraformStateId;
    workspaceId: WorkspaceId;
    name: StateName;
  }): TerraformState {
    return new TerraformState(
      { ...input, lock: null, latest: null, version: 0 },
      null,
    );
  }

  static rehydrate(input: Props): TerraformState {
    if (!Number.isInteger(input.version) || input.version < 1) {
      throw new InconsistentStateError(
        'Terraform state',
        `has an impossible version (${input.version})`,
      );
    }

    if (input.latest && input.latest.number < 1) {
      throw new InconsistentStateError(
        'Terraform state',
        `points at an impossible state version (${input.latest.number})`,
      );
    }

    return new TerraformState(input, null);
  }

  get id(): TerraformStateId {
    return this.state.id;
  }

  get workspaceId(): WorkspaceId {
    return this.state.workspaceId;
  }

  get name(): StateName {
    return this.state.name;
  }

  get lock(): StateLock | null {
    return this.state.lock;
  }

  get latest(): StateVersion | null {
    return this.state.latest;
  }

  get version(): number {
    return this.state.version;
  }

  get isNew(): boolean {
    return this.state.version === 0;
  }

  lockAs(lock: StateLock): TerraformState {
    const held = this.state.lock;

    if (held?.heldAs(lock.id) && held.lockedBy === lock.lockedBy) {
      return this;
    }

    if (held) {
      throw new TerraformStateLockedError(this.state.name.value, held);
    }

    return this.with({ lock });
  }

  unlock(
    id: string,
    by: { readonly principal: string; readonly mayForce: boolean },
  ): TerraformState {
    const held = this.state.lock;

    if (!held) {
      return this;
    }

    if (!held.heldAs(id)) {
      throw new TerraformStateLockedError(this.state.name.value, held);
    }

    if (held.lockedBy !== by.principal && !by.mayForce) {
      throw new TerraformStateLockNotYoursError(this.state.name.value, held.id);
    }

    return this.with({ lock: null });
  }

  forceUnlock(): TerraformState {
    return this.state.lock ? this.with({ lock: null }) : this;
  }

  write(input: {
    id: StateVersionId;
    snapshot: StateSnapshot;
    lockId: string | null;
    by: string;
    at: Date;
  }): { readonly state: TerraformState; readonly version: StateVersion } {
    const held = this.state.lock;

    if (held && !held.heldAs(input.lockId)) {
      throw new TerraformStateLockedError(this.state.name.value, held);
    }

    if (!held && input.lockId !== null) {
      throw new TerraformStateLockLostError(
        this.state.name.value,
        input.lockId,
      );
    }

    const written = StateVersion.of({
      id: input.id,
      number: (this.state.latest?.number ?? 0) + 1,
      snapshot: input.snapshot,
      writtenBy: input.by,
      writtenAt: input.at,
    });

    return {
      state: new TerraformState({ ...this.state, latest: written }, written),
      version: written,
    };
  }

  private with(part: Partial<Props>): TerraformState {
    return new TerraformState({ ...this.state, ...part }, this.written);
  }
}

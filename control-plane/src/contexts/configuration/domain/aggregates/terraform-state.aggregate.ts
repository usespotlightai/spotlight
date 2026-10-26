import { TerraformStateLockReleased } from '@configuration/domain/events/terraform-state-lock-released.event';
import { TerraformStateWritten } from '@configuration/domain/events/terraform-state-written.event';
import { TerraformStateDivergedError } from '@configuration/domain/exceptions/terraform-state-diverged.error';
import { TerraformStateLineageMismatchError } from '@configuration/domain/exceptions/terraform-state-lineage-mismatch.error';
import { TerraformStateLockLostError } from '@configuration/domain/exceptions/terraform-state-lock-lost.error';
import { TerraformStateLockNotYoursError } from '@configuration/domain/exceptions/terraform-state-lock-not-yours.error';
import { TerraformStateLockedError } from '@configuration/domain/exceptions/terraform-state-locked.error';
import { TerraformStateSerialBehindError } from '@configuration/domain/exceptions/terraform-state-serial-behind.error';
import { StateChangeDetail } from '@configuration/domain/value-objects/state-change-detail.vo';
import type { StateLock } from '@configuration/domain/value-objects/state-lock.vo';
import type { StateName } from '@configuration/domain/value-objects/state-name.vo';
import type { StateSnapshot } from '@configuration/domain/value-objects/state-snapshot.vo';
import { StateVersion } from '@configuration/domain/value-objects/state-version.vo';
import type { StateVersionId } from '@configuration/domain/value-objects/state-version-id.vo';
import type { TerraformStateId } from '@configuration/domain/value-objects/terraform-state-id.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import {
  type ChangeDetail,
  ConfigurationChange,
} from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

interface Props {
  readonly id: TerraformStateId;
  readonly workspaceId: WorkspaceId;
  readonly name: StateName;
  readonly lock: StateLock | null;
  readonly latest: StateVersion | null;
  readonly version: number;
}

const KEPT_VERSIONS = 100;

export class TerraformState extends EventRecorder {
  private constructor(
    private readonly state: Props,
    readonly written: StateVersion | null,
  ) {
    super();
  }

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

  get keptFrom(): number | null {
    const latest = this.state.latest?.number ?? 0;

    return latest > KEPT_VERSIONS ? latest - KEPT_VERSIONS + 1 : null;
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
    by: {
      readonly principal: string;
      readonly mayForce: boolean;
      readonly changedBy: ChangeActor;
    },
  ): TerraformState {
    const held = this.state.lock;

    if (!held) {
      return this;
    }

    if (!held.heldAs(id)) {
      throw new TerraformStateLockedError(this.state.name.value, held);
    }

    if (held.lockedBy === by.principal) {
      return this.with({ lock: null });
    }

    if (!by.mayForce) {
      throw new TerraformStateLockNotYoursError(this.state.name.value, held.id);
    }

    return this.released(held, false, by.changedBy);
  }

  forceUnlock(changedBy: ChangeActor): TerraformState {
    const held = this.state.lock;

    return held ? this.released(held, true, changedBy) : this;
  }

  write(input: {
    id: StateVersionId;
    snapshot: StateSnapshot;
    lockId: string | null;
    by: ChangeActor;
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

    this.assertFollows(input.snapshot);

    const written = StateVersion.of({
      id: input.id,
      number: (this.state.latest?.number ?? 0) + 1,
      snapshot: input.snapshot,
      writtenBy: input.by.actor?.principal.toString() ?? 'spotlight',
      writtenAt: input.at,
    });
    const next = new TerraformState(
      { ...this.state, latest: written },
      written,
    );

    next.inheritEvents(this);
    next.record(
      new TerraformStateWritten(
        this.state.id,
        this.state.workspaceId,
        this.state.name,
        this.changed(
          this.state.latest ? 'updated' : 'created',
          input.by,
          StateChangeDetail.written(written),
        ),
      ),
    );

    return { state: next, version: written };
  }

  private assertFollows(snapshot: StateSnapshot): void {
    const kept = this.state.latest?.snapshot;

    if (!kept) {
      return;
    }

    if (snapshot.lineage !== kept.lineage) {
      throw new TerraformStateLineageMismatchError(
        this.state.name.value,
        kept.lineage,
        snapshot.lineage,
      );
    }

    if (snapshot.serial < kept.serial) {
      throw new TerraformStateSerialBehindError(
        this.state.name.value,
        kept.serial,
        snapshot.serial,
      );
    }

    if (snapshot.serial === kept.serial && snapshot.md5 !== kept.md5) {
      throw new TerraformStateDivergedError(this.state.name.value, kept.serial);
    }
  }

  private released(
    held: StateLock,
    forced: boolean,
    changedBy: ChangeActor,
  ): TerraformState {
    const next = this.with({ lock: null });

    next.record(
      new TerraformStateLockReleased(
        this.state.id,
        this.state.workspaceId,
        this.state.name,
        this.changed(
          'updated',
          changedBy,
          StateChangeDetail.released(held, forced),
        ),
      ),
    );

    return next;
  }

  private changed(
    action: 'created' | 'updated',
    by: ChangeActor,
    detail: ChangeDetail,
  ): ConfigurationChange {
    const changed = {
      resource: 'terraform-state' as const,
      id: this.state.id.value,
      key: this.state.name.value,
    };

    return action === 'created'
      ? ConfigurationChange.created(changed, by, detail)
      : ConfigurationChange.updated(changed, by, detail);
  }

  private with(part: Partial<Props>): TerraformState {
    const next = new TerraformState({ ...this.state, ...part }, this.written);

    next.inheritEvents(this);

    return next;
  }
}

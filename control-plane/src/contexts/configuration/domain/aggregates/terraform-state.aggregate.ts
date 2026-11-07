import { TerraformStateDeleted } from '@configuration/domain/events/terraform-state-deleted.event';
import { TerraformStateLockReleased } from '@configuration/domain/events/terraform-state-lock-released.event';
import { TerraformStateWritten } from '@configuration/domain/events/terraform-state-written.event';
import { TerraformStateDivergedError } from '@configuration/domain/exceptions/terraform-state-diverged.error';
import { TerraformStateLineageMismatchError } from '@configuration/domain/exceptions/terraform-state-lineage-mismatch.error';
import { TerraformStateLockLostError } from '@configuration/domain/exceptions/terraform-state-lock-lost.error';
import { TerraformStateLockNotYoursError } from '@configuration/domain/exceptions/terraform-state-lock-not-yours.error';
import { TerraformStateLockedError } from '@configuration/domain/exceptions/terraform-state-locked.error';
import { TerraformStateSerialBehindError } from '@configuration/domain/exceptions/terraform-state-serial-behind.error';
import { PrincipalRef } from '@configuration/domain/value-objects/principal-ref.vo';
import { StateChangeDetail } from '@configuration/domain/value-objects/state-change-detail.vo';
import type { StateLock } from '@configuration/domain/value-objects/state-lock.vo';
import type { StateLockId } from '@configuration/domain/value-objects/state-lock-id.vo';
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
  readonly versions: readonly StateVersion[];
  readonly deleted: boolean;
  readonly version: number;
}

const KEPT_VERSIONS = 100;

const keptFrom = (latest: number): number =>
  latest > KEPT_VERSIONS ? latest - KEPT_VERSIONS + 1 : 1;

export class TerraformState extends EventRecorder {
  private constructor(private readonly state: Props) {
    super();
  }

  static open(input: {
    id: TerraformStateId;
    workspaceId: WorkspaceId;
    name: StateName;
  }): TerraformState {
    return new TerraformState({
      ...input,
      lock: null,
      versions: [],
      deleted: false,
      version: 0,
    });
  }

  static rehydrate(input: Omit<Props, 'deleted'>): TerraformState {
    if (!Number.isInteger(input.version) || input.version < 1) {
      throw new InconsistentStateError(
        'Terraform state',
        `has an impossible version (${input.version})`,
      );
    }

    const impossible = input.versions.find(
      (each, at, all) =>
        each.number < 1 ||
        (at > 0 && each.number <= (all[at - 1]?.number ?? 0)),
    );

    if (impossible) {
      throw new InconsistentStateError(
        'Terraform state',
        `points at an impossible state version (${impossible.number})`,
      );
    }

    return new TerraformState({ ...input, deleted: false });
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
    return this.state.versions[this.state.versions.length - 1] ?? null;
  }

  get versions(): readonly StateVersion[] {
    return this.state.versions;
  }

  get version(): number {
    return this.state.version;
  }

  get isNew(): boolean {
    return this.state.version === 0;
  }

  get isDeleted(): boolean {
    return this.state.deleted;
  }

  lockAs(lock: StateLock): TerraformState {
    const held = this.state.lock;

    if (held?.sameAs(lock)) {
      return this;
    }

    if (held) {
      throw new TerraformStateLockedError(this.state.name.value, held);
    }

    return this.with({ lock });
  }

  unlock(
    id: StateLockId,
    by: {
      readonly principal: PrincipalRef;
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

    if (held.heldBy(by.principal)) {
      return this.with({ lock: null });
    }

    if (!by.mayForce) {
      throw new TerraformStateLockNotYoursError(
        this.state.name.value,
        held.id.value,
      );
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
    lockId: StateLockId | null;
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
        input.lockId.value,
      );
    }

    this.assertFollows(input.snapshot);

    const number = (this.latest?.number ?? 0) + 1;
    const written = StateVersion.of({
      id: input.id,
      number,
      snapshot: input.snapshot,
      writtenBy: input.by.actor
        ? PrincipalRef.of(input.by.actor.principal)
        : PrincipalRef.spotlight(),
      writtenAt: input.at,
    });
    const kept = keptFrom(number);
    const next = this.with({
      versions: [
        ...this.state.versions.filter((each) => each.number >= kept),
        written,
      ],
    });

    next.record(
      new TerraformStateWritten(
        this.state.id,
        this.state.workspaceId,
        this.state.name,
        this.changed(
          this.latest ? 'updated' : 'created',
          input.by,
          StateChangeDetail.written(written),
        ),
        written,
        this.state.versions
          .filter((each) => each.number < kept)
          .map((each) => each.id),
      ),
    );

    return { state: next, version: written };
  }

  deleteWithWorkspace(by: ChangeActor): TerraformState {
    if (this.state.deleted) {
      return this;
    }

    const deleted = this.with({ deleted: true });

    deleted.record(
      new TerraformStateDeleted(
        this.state.id,
        this.state.workspaceId,
        this.state.name,
        ConfigurationChange.deleted(this.whatChanged, by),
      ),
    );

    return deleted;
  }

  private assertFollows(snapshot: StateSnapshot): void {
    const kept = this.latest?.snapshot;

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

  private get whatChanged() {
    return {
      resource: 'terraform-state' as const,
      id: this.state.id.value,
      key: this.state.name.value,
    };
  }

  private changed(
    action: 'created' | 'updated',
    by: ChangeActor,
    detail: ChangeDetail,
  ): ConfigurationChange {
    return action === 'created'
      ? ConfigurationChange.created(this.whatChanged, by, detail)
      : ConfigurationChange.updated(this.whatChanged, by, detail);
  }

  private with(part: Partial<Props>): TerraformState {
    const next = new TerraformState({ ...this.state, ...part });

    next.inheritEvents(this);

    return next;
  }
}

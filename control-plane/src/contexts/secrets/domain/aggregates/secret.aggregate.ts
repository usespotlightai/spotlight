import { SecretCreated } from '@secrets/domain/events/secret-created.event';
import { SecretDeleted } from '@secrets/domain/events/secret-deleted.event';
import { SecretUpdated } from '@secrets/domain/events/secret-updated.event';
import { InvalidSecretError } from '@secrets/domain/exceptions/invalid-secret.error';
import { ReservedSecretValueError } from '@secrets/domain/exceptions/reserved-secret-value.error';
import { SecretAwaitingValueError } from '@secrets/domain/exceptions/secret-awaiting-value.error';
import { SecretInUseError } from '@secrets/domain/exceptions/secret-in-use.error';
import { SecretNotBoundError } from '@secrets/domain/exceptions/secret-not-bound.error';
import { SecretNotInjectableError } from '@secrets/domain/exceptions/secret-not-injectable.error';
import { SecretVersionConflictError } from '@secrets/domain/exceptions/secret-version-conflict.error';
import { isReservedSecretName } from '@secrets/domain/value-objects/reserved-secret-name';
import type {
  InjectedSecret,
  SecretBinding,
} from '@secrets/domain/value-objects/secret-binding.vo';
import type { SecretBindings } from '@secrets/domain/value-objects/secret-bindings.vo';
import {
  type SecretValueChange,
  SecretChangeDetail,
} from '@secrets/domain/value-objects/secret-change-detail.vo';
import { SecretGrant } from '@secrets/domain/value-objects/secret-grant.vo';
import type { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
import type { SecretUses } from '@secrets/domain/value-objects/secret-uses.vo';
import { SecretValueOrigin } from '@secrets/domain/value-objects/secret-value-origin.vo';
import type { SecretValue } from '@secrets/domain/value-objects/secret-value.vo';
import { ValueVersion } from '@secrets/domain/value-objects/value-version.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface SecretDefinition {
  readonly name: SecretName;
  readonly bindings: SecretBindings;
  readonly value: SecretValue | null;
  readonly valueVersion: ValueVersion | null;
}

interface Props {
  readonly id: SecretId;
  readonly workspaceId: WorkspaceId;
  readonly name: SecretName;
  readonly bindings: SecretBindings;
  readonly valueVersion: ValueVersion | null;
  readonly holdsValue: boolean;
  readonly rotatedAt: Date;
  readonly version: number;
}

interface State extends Props {
  readonly stored: boolean;
  readonly deleted: boolean;
  readonly valueToStore: SecretValue | null;
}

const VALUE_FIELD = 'valueWo';

const assertVersionedValue = (definition: SecretDefinition): void => {
  if (definition.value && !definition.valueVersion) {
    throw new InvalidSecretError(
      VALUE_FIELD,
      'is set only together with valueWoVersion. Leave both out to set the value outside Terraform',
    );
  }
};

const valueFor = (definition: SecretDefinition, because: string) => {
  if (!definition.value) {
    throw new InvalidSecretError(VALUE_FIELD, because);
  }

  return definition.value;
};

const versionedValueOf = (definition: SecretDefinition): SecretValue | null =>
  definition.valueVersion
    ? valueFor(definition, 'is required when valueWoVersion is set')
    : null;

const assertSendable = (
  name: SecretName,
  bindings: SecretBindings,
  value: SecretValue | null,
  field: string,
): void => {
  if (value && !bindings.isEmpty && !value.fitsOneLine) {
    throw new InvalidSecretError(
      field,
      `must be one line, since Spotlight sends ${name.value} in a request header or query parameter`,
    );
  }
};

export interface SecretValueWrites<T> {
  store(value: SecretValue): T;
  delete(): T;
  keep(): T;
}

export class Secret extends EventRecorder {
  private constructor(private readonly state: State) {
    super();
  }

  static create(
    definition: SecretDefinition,
    input: {
      id: SecretId;
      workspaceId: WorkspaceId;
      by: ChangeActor;
      at: Date;
    },
  ): Secret {
    assertVersionedValue(definition);

    const valueToStore = versionedValueOf(definition);

    assertSendable(
      definition.name,
      definition.bindings,
      valueToStore,
      VALUE_FIELD,
    );

    const created = new Secret({
      id: input.id,
      workspaceId: input.workspaceId,
      name: definition.name,
      bindings: definition.bindings,
      valueVersion: definition.valueVersion,
      holdsValue: valueToStore !== null,
      rotatedAt: input.at,
      version: 0,
      stored: false,
      deleted: false,
      valueToStore,
    });

    created.record(
      new SecretCreated(
        created.workspaceId,
        created.id,
        created.name,
        ConfigurationChange.created(
          created.whatChanged,
          input.by,
          SecretChangeDetail.created({
            origin: created.valueOrigin,
            valueVersion: created.valueVersion?.value ?? null,
            targets: created.bindings.hosts,
          }),
        ),
      ),
    );

    return created;
  }

  static rehydrate(input: Props): Secret {
    if (!Number.isInteger(input.version) || input.version < 0) {
      throw new InconsistentStateError(
        'secret',
        `has an impossible version (${input.version})`,
      );
    }

    if (input.valueVersion !== null && !input.holdsValue) {
      throw new InconsistentStateError(
        'secret',
        `has value_wo_version ${input.valueVersion.value} but no stored value`,
      );
    }

    return new Secret({
      ...input,
      stored: true,
      deleted: false,
      valueToStore: null,
    });
  }

  assertVersion(version: number): void {
    if (version !== this.version) {
      throw new SecretVersionConflictError(this.name.value);
    }
  }

  update(definition: SecretDefinition, by: ChangeActor, at: Date): Secret {
    this.assertNotDeleted();

    if (!definition.name.equals(this.name)) {
      const because = `cannot be renamed to ${definition.name.value}`;

      throw new ImmutableFieldError(
        'name',
        because,
        `Secret ${this.name.value} ${because}.`,
      );
    }

    const rotating =
      definition.valueVersion !== null &&
      !ValueVersion.same(definition.valueVersion, this.valueVersion);
    const handedOver =
      definition.valueVersion === null && this.valueVersion !== null;

    assertVersionedValue(definition);

    const valueToStore = rotating
      ? valueFor(definition, 'is required when valueWoVersion changes')
      : null;
    const rebound = !definition.bindings.equals(this.bindings);

    assertSendable(this.name, definition.bindings, valueToStore, VALUE_FIELD);

    if (!rotating && !rebound && !handedOver) {
      return this;
    }

    const updated = this.with({
      bindings: definition.bindings,
      valueVersion: definition.valueVersion,
      holdsValue: valueToStore !== null || this.state.holdsValue,
      rotatedAt: valueToStore ? at : this.rotatedAt,
      valueToStore,
    });

    const valueChange: SecretValueChange | null = valueToStore
      ? 'stored'
      : handedOver
        ? 'handed-over'
        : null;
    const moved = SecretChangeDetail.updated({
      valueChange,
      origin: updated.valueOrigin,
      valueVersion: definition.valueVersion?.value ?? null,
      rebound,
      targets: definition.bindings.hosts,
    });

    updated.record(
      new SecretUpdated(
        this.workspaceId,
        this.id,
        this.name,
        ConfigurationChange.updated(this.whatChanged, by, moved),
      ),
    );

    return updated;
  }

  setValue(value: SecretValue, by: ChangeActor, at: Date): Secret {
    this.assertNotDeleted();

    if (isReservedSecretName(this.name.value)) {
      throw new ReservedSecretValueError(this.name.value);
    }

    this.valueOrigin.assertSettable(this.name.value);
    assertSendable(this.name, this.bindings, value, 'value');

    const updated = this.with({
      valueToStore: value,
      holdsValue: true,
      rotatedAt: at,
    });

    updated.record(
      new SecretUpdated(
        this.workspaceId,
        this.id,
        this.name,
        ConfigurationChange.updated(
          this.whatChanged,
          by,
          SecretChangeDetail.updated({
            valueChange: 'stored',
            origin: updated.valueOrigin,
            valueVersion: null,
            rebound: false,
            targets: this.bindings.hosts,
          }),
        ),
      ),
    );

    return updated;
  }

  delete(uses: SecretUses, by: ChangeActor): Secret {
    this.assertNotDeleted();

    if (!uses.isEmpty) {
      throw new SecretInUseError(this.name.value, uses);
    }

    return this.deleted(by);
  }

  deleteWithWorkspace(deletedWorkspace: WorkspaceId): Secret {
    this.assertNotDeleted();

    if (!deletedWorkspace.equals(this.workspaceId)) {
      throw new InconsistentStateError(
        'secret',
        'was deleted with a workspace it is not in',
      );
    }

    return this.deleted(ChangeActor.spotlight(this.workspaceId));
  }

  private deleted(by: ChangeActor): Secret {
    const deleted = this.removed();

    deleted.record(
      new SecretDeleted(
        this.workspaceId,
        this.id,
        this.name,
        ConfigurationChange.deleted(this.whatChanged, by),
      ),
    );

    return deleted;
  }

  bindingForUrl(url: string): SecretBinding {
    const address = parsed(url);
    const binding = address ? this.bindings.forUrl(address) : null;

    if (!address || !binding) {
      throw new SecretNotBoundError(
        this.name.value,
        address ? `${address.protocol}//${address.host}` : 'that address',
      );
    }

    return binding;
  }

  assertHoldsValue(): void {
    this.assertNotDeleted();

    if (!this.state.holdsValue) {
      throw new SecretAwaitingValueError(this.name.value);
    }
  }

  injectedFor(url: string, value: SecretValue): InjectedSecret {
    return this.bindingForUrl(url).inject(this.injectable(value));
  }

  standInFor(url: string): InjectedSecret {
    return this.bindingForUrl(url).standIn(this.name);
  }

  injectable(value: SecretValue): SecretValue {
    if (!value.fitsOneLine) {
      throw new SecretNotInjectableError(this.name.value);
    }

    return value;
  }

  grantForUrl(runId: RunId, url: string): SecretGrant {
    return SecretGrant.of({
      runId,
      workspaceId: this.workspaceId,
      secretId: this.id,
      host: this.bindingForUrl(url).host,
    });
  }

  bindingFor(grant: SecretGrant): SecretBinding {
    if (!grant.secretId.equals(this.id)) {
      throw new InconsistentStateError(
        'secret',
        'received a grant for another secret',
      );
    }

    const binding = this.bindings.on(grant.host);

    if (!binding) {
      throw new SecretNotBoundError(this.name.value, grant.host.value);
    }

    return binding;
  }

  grantTo(runId: RunId): readonly SecretGrant[] {
    return this.injectedBindings().map(({ host }) =>
      SecretGrant.of({
        runId,
        workspaceId: this.workspaceId,
        secretId: this.id,
        host,
      }),
    );
  }

  injectedBindings(): readonly SecretBinding[] {
    this.assertNotDeleted();

    if (this.bindings.isEmpty) {
      throw new SecretNotBoundError(this.name.value, 'any host');
    }

    return this.bindings.all;
  }

  get id(): SecretId {
    return this.state.id;
  }

  get workspaceId(): WorkspaceId {
    return this.state.workspaceId;
  }

  get name(): SecretName {
    return this.state.name;
  }

  get bindings(): SecretBindings {
    return this.state.bindings;
  }

  get valueVersion(): ValueVersion | null {
    return this.state.valueVersion;
  }

  get holdsValue(): boolean {
    return this.state.holdsValue;
  }

  get valueOrigin(): SecretValueOrigin {
    return SecretValueOrigin.of({
      valueVersion: this.valueVersion?.value ?? null,
      holdsValue: this.state.holdsValue,
    });
  }

  get rotatedAt(): Date {
    return this.state.rotatedAt;
  }

  get version(): number {
    return this.state.version;
  }

  get isNew(): boolean {
    return !this.state.stored;
  }

  get isDeleted(): boolean {
    return this.state.deleted;
  }

  valueWrite<T>(writes: SecretValueWrites<T>): T {
    if (this.state.valueToStore) {
      return writes.store(this.state.valueToStore);
    }

    return this.state.deleted && this.state.holdsValue
      ? writes.delete()
      : writes.keep();
  }

  private get whatChanged() {
    return {
      resource: 'secret' as const,
      id: this.id.value,
      key: this.name.value,
    };
  }

  private with(change: Partial<State>): Secret {
    const next = new Secret({ ...this.state, ...change });

    next.inheritEvents(this);

    return next;
  }

  private removed(): Secret {
    return this.with({
      deleted: true,
      valueToStore: null,
    });
  }

  private assertNotDeleted(): void {
    if (this.isDeleted) {
      throw new InconsistentStateError(
        'secret',
        'was changed after it was deleted',
      );
    }
  }
}

const parsed = (url: string): URL | null => {
  try {
    return new URL(url);
  } catch {
    return null;
  }
};

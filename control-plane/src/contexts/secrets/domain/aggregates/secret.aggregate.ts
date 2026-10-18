import { SecretCreated } from '@secrets/domain/events/secret-created.event';
import { SecretDeleted } from '@secrets/domain/events/secret-deleted.event';
import { SecretUpdated } from '@secrets/domain/events/secret-updated.event';
import { InvalidSecretError } from '@secrets/domain/exceptions/invalid-secret.error';
import { SecretInUseError } from '@secrets/domain/exceptions/secret-in-use.error';
import { SecretNotBoundError } from '@secrets/domain/exceptions/secret-not-bound.error';
import { SecretNotInjectableError } from '@secrets/domain/exceptions/secret-not-injectable.error';
import { SecretVersionConflictError } from '@secrets/domain/exceptions/secret-version-conflict.error';
import type {
  InjectedSecret,
  SecretBinding,
} from '@secrets/domain/value-objects/secret-binding.vo';
import type { SecretBindings } from '@secrets/domain/value-objects/secret-bindings.vo';
import { SecretChangeDetail } from '@secrets/domain/value-objects/secret-change-detail.vo';
import { SecretGrant } from '@secrets/domain/value-objects/secret-grant.vo';
import type { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
import type { SecretSource } from '@secrets/domain/value-objects/secret-source.vo';
import type { SecretUses } from '@secrets/domain/value-objects/secret-uses.vo';
import type { SecretValue } from '@secrets/domain/value-objects/secret-value.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface SecretDefinition {
  readonly name: SecretName;
  readonly source: SecretSource;
  readonly bindings: SecretBindings;
  readonly value: SecretValue | null;
  readonly valueVersion: number | null;
}

interface Props {
  readonly id: SecretId;
  readonly workspaceId: WorkspaceId;
  readonly name: SecretName;
  readonly source: SecretSource;
  readonly bindings: SecretBindings;
  readonly valueVersion: number | null;
  readonly rotatedAt: Date;
  readonly version: number;
}

interface State extends Props {
  readonly deleted: boolean;
  readonly valueToStore: SecretValue | null;
  readonly deletingValue: boolean;
}

const VALUE_FIELD = 'valueWo';

const assertValueAllowedFor = (source: SecretSource): void => {
  if (!source.isBuiltIn) {
    throw new InvalidSecretError(
      VALUE_FIELD,
      'cannot be set on a secret read from AWS Secrets Manager',
    );
  }
};

const valueFor = (definition: SecretDefinition, because: string) => {
  if (!definition.value) {
    throw new InvalidSecretError(VALUE_FIELD, because);
  }

  return definition.value;
};

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
    const valueToStore = definition.source.isBuiltIn
      ? valueFor(definition, 'is required for a secret stored by Spotlight')
      : null;

    if (definition.value && !valueToStore) {
      assertValueAllowedFor(definition.source);
    }

    const created = new Secret({
      id: input.id,
      workspaceId: input.workspaceId,
      name: definition.name,
      source: definition.source,
      bindings: definition.bindings,
      valueVersion: definition.valueVersion,
      rotatedAt: input.at,
      version: 0,
      deleted: false,
      valueToStore,
      deletingValue: false,
    });

    created.record(
      new SecretCreated(
        created.workspaceId,
        created.id,
        created.name,
        ConfigurationChange.created(
          created.whatChanged,
          input.by,
          SecretChangeDetail.created(
            created.valueVersion,
            created.bindings.hosts,
          ),
        ),
      ),
    );

    return created;
  }

  static rehydrate(input: Props): Secret {
    if (input.version < 1) {
      throw new InconsistentStateError(
        'secret',
        'was stored without a version',
      );
    }

    return new Secret({
      ...input,
      deleted: false,
      valueToStore: null,
      deletingValue: false,
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

    const rotating = definition.valueVersion !== this.valueVersion;
    const becomingBuiltIn =
      definition.source.isBuiltIn && !this.source.isBuiltIn;

    if (!definition.source.isBuiltIn && definition.value) {
      assertValueAllowedFor(definition.source);
    }

    const valueToStore =
      definition.source.isBuiltIn && (rotating || becomingBuiltIn)
        ? valueFor(
            definition,
            rotating
              ? 'is required when valueWoVersion changes'
              : 'is required once Spotlight stores the secret',
          )
        : null;

    const rebound =
      !definition.source.equals(this.source) ||
      !definition.bindings.equals(this.bindings);

    const updated = this.with({
      source: definition.source,
      bindings: definition.bindings,
      valueVersion: definition.valueVersion,
      rotatedAt: valueToStore || rotating ? at : this.rotatedAt,
      valueToStore,
      deletingValue: this.source.isBuiltIn && !definition.source.isBuiltIn,
    });

    const moved = SecretChangeDetail.updated({
      valueMoved: valueToStore !== null || rotating,
      valueVersion: definition.valueVersion,
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

  delete(uses: SecretUses, by: ChangeActor): Secret {
    this.assertNotDeleted();

    if (!uses.isEmpty) {
      throw new SecretInUseError(this.name.value, uses);
    }

    return this.cascadeDelete(by);
  }

  cascadeDelete(by: ChangeActor): Secret {
    this.assertNotDeleted();

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

  injectedFor(url: string, value: SecretValue): InjectedSecret {
    return this.bindingForUrl(url).inject(this.injectable(value));
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
      throw new SecretNotBoundError(this.name.value, grant.host);
    }

    return binding;
  }

  grantTo(runId: RunId): readonly SecretGrant[] {
    this.assertNotDeleted();

    if (this.bindings.isEmpty) {
      throw new SecretNotBoundError(this.name.value, 'any host');
    }

    return this.bindings.hosts.map((host) =>
      SecretGrant.of({
        runId,
        workspaceId: this.workspaceId,
        secretId: this.id,
        host,
      }),
    );
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

  get source(): SecretSource {
    return this.state.source;
  }

  get bindings(): SecretBindings {
    return this.state.bindings;
  }

  get valueVersion(): number | null {
    return this.state.valueVersion;
  }

  get rotatedAt(): Date {
    return this.state.rotatedAt;
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

  get valueToStore(): SecretValue | null {
    return this.state.valueToStore;
  }

  get deletesValue(): boolean {
    return this.state.deletingValue;
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
      deletingValue: this.source.isBuiltIn,
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

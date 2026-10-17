import { SecretAbandoned } from '@secrets/domain/events/secret-abandoned.event';
import { SecretDeleted } from '@secrets/domain/events/secret-deleted.event';
import { SecretRedefined } from '@secrets/domain/events/secret-redefined.event';
import { SecretSet } from '@secrets/domain/events/secret-set.event';
import { InvalidSecretError } from '@secrets/domain/exceptions/invalid-secret.error';
import { SecretInUseError } from '@secrets/domain/exceptions/secret-in-use.error';
import { SecretNameFixedError } from '@secrets/domain/exceptions/secret-name-fixed.error';
import { SecretNotBoundError } from '@secrets/domain/exceptions/secret-not-bound.error';
import { SecretUnwearableError } from '@secrets/domain/exceptions/secret-unwearable.error';
import { SecretVersionConflictError } from '@secrets/domain/exceptions/secret-version-conflict.error';
import type {
  SecretBinding,
  WornSecret,
} from '@secrets/domain/value-objects/secret-binding.vo';
import type { SecretBindings } from '@secrets/domain/value-objects/secret-bindings.vo';
import { SecretChangeDetail } from '@secrets/domain/value-objects/secret-change-detail.vo';
import { SecretGrant } from '@secrets/domain/value-objects/secret-grant.vo';
import type { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
import type { SecretSource } from '@secrets/domain/value-objects/secret-source.vo';
import type { SecretUses } from '@secrets/domain/value-objects/secret-uses.vo';
import type { SecretValue } from '@secrets/domain/value-objects/secret-value.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
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
  readonly keeping: SecretValue | null;
  readonly forgetting: boolean;
}

const VALUE_FIELD = 'valueWo';

const refuseValueFor = (source: SecretSource): void => {
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

  static set(
    definition: SecretDefinition,
    input: {
      id: SecretId;
      workspaceId: WorkspaceId;
      by: Attribution;
      at: Date;
    },
  ): Secret {
    const keeping = definition.source.isBuiltIn
      ? valueFor(definition, 'is required for a secret kept by Spotlight')
      : null;

    if (definition.value && !keeping) {
      refuseValueFor(definition.source);
    }

    const set = new Secret({
      id: input.id,
      workspaceId: input.workspaceId,
      name: definition.name,
      source: definition.source,
      bindings: definition.bindings,
      valueVersion: definition.valueVersion,
      rotatedAt: input.at,
      version: 0,
      deleted: false,
      keeping,
      forgetting: false,
    });

    set.record(
      new SecretSet(
        set.workspaceId,
        set.id,
        set.name,
        ConfigurationChange.created(
          set.whatChanged,
          input.by,
          SecretChangeDetail.set(set.valueVersion, set.bindings.hosts),
        ),
      ),
    );

    return set;
  }

  static rehydrate(input: Props): Secret {
    if (input.version < 1) {
      throw new InconsistentStateError('secret', 'was kept without a version');
    }

    return new Secret({
      ...input,
      deleted: false,
      keeping: null,
      forgetting: false,
    });
  }

  assertVersion(version: number): void {
    if (version !== this.version) {
      throw new SecretVersionConflictError(this.name.value);
    }
  }

  redefinedAs(definition: SecretDefinition, by: Attribution, at: Date): Secret {
    this.assertNotDeleted();

    if (!definition.name.equals(this.name)) {
      throw new SecretNameFixedError(
        this.name.value,
        `cannot be renamed to ${definition.name.value}`,
      );
    }

    const rotating = definition.valueVersion !== this.valueVersion;
    const becomingBuiltIn =
      definition.source.isBuiltIn && !this.source.isBuiltIn;

    if (!definition.source.isBuiltIn && definition.value) {
      refuseValueFor(definition.source);
    }

    const keeping =
      definition.source.isBuiltIn && (rotating || becomingBuiltIn)
        ? valueFor(
            definition,
            rotating
              ? 'is required when valueWoVersion changes'
              : 'is required once Spotlight keeps the secret',
          )
        : null;

    const rebound =
      !definition.source.equals(this.source) ||
      !definition.bindings.equals(this.bindings);

    const redefined = this.with({
      source: definition.source,
      bindings: definition.bindings,
      valueVersion: definition.valueVersion,
      rotatedAt: keeping || rotating ? at : this.rotatedAt,
      keeping,
      forgetting: this.source.isBuiltIn && !definition.source.isBuiltIn,
    });

    const moved = SecretChangeDetail.redefined({
      valueMoved: keeping !== null || rotating,
      valueVersion: definition.valueVersion,
      rebound,
      boundTo: definition.bindings.hosts,
    });

    redefined.record(
      new SecretRedefined(
        this.workspaceId,
        this.id,
        this.name,
        ConfigurationChange.updated(this.whatChanged, by, moved),
      ),
    );

    return redefined;
  }

  deleted(uses: SecretUses, by: Attribution): Secret {
    this.assertNotDeleted();

    if (!uses.isEmpty) {
      throw new SecretInUseError(this.name.value, uses);
    }

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

  abandon(by: Attribution): Secret {
    this.assertNotDeleted();

    const abandoned = this.removed();

    abandoned.record(
      new SecretAbandoned(
        this.workspaceId,
        this.id,
        this.name,
        ConfigurationChange.deleted(this.whatChanged, by),
      ),
    );

    return abandoned;
  }

  bindingToward(url: string): SecretBinding {
    const toward = parsed(url);
    const binding = toward ? this.bindings.toward(toward) : null;

    if (!toward || !binding) {
      throw new SecretNotBoundError(
        this.name.value,
        toward ? `${toward.protocol}//${toward.host}` : 'that address',
      );
    }

    return binding;
  }

  wornToward(url: string, value: SecretValue): WornSecret {
    return this.bindingToward(url).wear(this.wearable(value));
  }

  wearable(value: SecretValue): SecretValue {
    if (!value.fitsOneLine) {
      throw new SecretUnwearableError(this.name.value);
    }

    return value;
  }

  grantToward(runId: RunId, url: string): SecretGrant {
    return SecretGrant.of({
      runId,
      workspaceId: this.workspaceId,
      secretId: this.id,
      host: this.bindingToward(url).host,
    });
  }

  bindingFor(grant: SecretGrant): SecretBinding {
    if (!grant.secretId.equals(this.id)) {
      throw new InconsistentStateError(
        'secret',
        'was asked to honour a grant of another secret',
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

  get keeping(): SecretValue | null {
    return this.state.keeping;
  }

  get forgetsValue(): boolean {
    return this.state.forgetting;
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
      keeping: null,
      forgetting: this.source.isBuiltIn,
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

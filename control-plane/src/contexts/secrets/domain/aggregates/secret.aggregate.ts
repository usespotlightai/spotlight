import { SecretAbandoned } from '@secrets/domain/events/secret-abandoned.event';
import { SecretDeleted } from '@secrets/domain/events/secret-deleted.event';
import { SecretRedefined } from '@secrets/domain/events/secret-redefined.event';
import { SecretRotated } from '@secrets/domain/events/secret-rotated.event';
import { SecretSet } from '@secrets/domain/events/secret-set.event';
import { InvalidSecretError } from '@secrets/domain/exceptions/invalid-secret.error';
import { SecretInUseError } from '@secrets/domain/exceptions/secret-in-use.error';
import { SecretMovedOnError } from '@secrets/domain/exceptions/secret-moved-on.error';
import { SecretNameFixedError } from '@secrets/domain/exceptions/secret-name-fixed.error';
import { SecretNotBoundError } from '@secrets/domain/exceptions/secret-not-bound.error';
import { SecretUnwearableError } from '@secrets/domain/exceptions/secret-unwearable.error';
import type {
  SecretBinding,
  WornHeader,
} from '@secrets/domain/value-objects/secret-binding.vo';
import type { SecretBindings } from '@secrets/domain/value-objects/secret-bindings.vo';
import { SecretGrant } from '@secrets/domain/value-objects/secret-grant.vo';
import type { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
import type { SecretSource } from '@secrets/domain/value-objects/secret-source.vo';
import type { SecretUses } from '@secrets/domain/value-objects/secret-uses.vo';
import type { SecretValue } from '@secrets/domain/value-objects/secret-value.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface SecretDefinition {
  readonly name: SecretName;
  readonly source: SecretSource;
  readonly bindings: SecretBindings;
  readonly value: SecretValue | null;
  readonly valueVersion: number | null;
}

interface Kept {
  readonly id: SecretId;
  readonly workspaceId: WorkspaceId;
  readonly name: SecretName;
  readonly source: SecretSource;
  readonly bindings: SecretBindings;
  readonly valueVersion: number | null;
  readonly rotatedAt: Date;
  readonly version: number;
}

interface State extends Kept {
  readonly deleted: boolean;
  readonly keeping: SecretValue | null;
  readonly forgetting: boolean;
}

const VALUE_FIELD = 'valueWo';

const refuseValueFor = (source: SecretSource): void => {
  if (!source.isBuiltIn) {
    throw new InvalidSecretError(
      VALUE_FIELD,
      'is kept only by Spotlight; a secret read from AWS Secrets Manager is set there',
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
    input: { id: SecretId; workspaceId: WorkspaceId; by: UserId; at: Date },
  ): Secret {
    const keeping = definition.source.isBuiltIn
      ? valueFor(
          definition,
          'is the value Spotlight keeps; it is written once and never read back',
        )
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
        input.by,
        set.valueVersion,
      ),
    );

    return set;
  }

  static rehydrate(input: Kept): Secret {
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

  expecting(version: number): void {
    if (version !== this.version) {
      throw new SecretMovedOnError(this.name.value);
    }
  }

  redefinedAs(definition: SecretDefinition, by: UserId, at: Date): Secret {
    this.guardStanding();

    if (!definition.name.equals(this.name)) {
      throw new SecretNameFixedError(
        this.name.value,
        `keeps its name for its whole life, since integrations name it; replace it to name a secret ${definition.name.value}`,
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
              ? 'carries the new value whenever valueWoVersion changes'
              : 'is needed once the secret is kept by Spotlight',
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

    if (rebound) {
      redefined.record(
        new SecretRedefined(
          this.workspaceId,
          this.id,
          this.name,
          by,
          definition.bindings.hosts,
        ),
      );
    }

    if (keeping || rotating) {
      redefined.record(
        new SecretRotated(
          this.workspaceId,
          this.id,
          this.name,
          by,
          definition.valueVersion,
        ),
      );
    }

    return redefined;
  }

  deleted(by: UserId, uses: SecretUses): Secret {
    this.guardStanding();

    if (!uses.isEmpty) {
      throw new SecretInUseError(this.name.value, uses);
    }

    const deleted = this.removed();

    deleted.record(new SecretDeleted(this.workspaceId, this.id, this.name, by));

    return deleted;
  }

  abandoned(): Secret {
    this.guardStanding();

    const abandoned = this.removed();

    abandoned.record(new SecretAbandoned(this.workspaceId, this.id, this.name));

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

  wornToward(url: string, value: SecretValue): WornHeader {
    if (!value.fitsOneLine) {
      throw new SecretUnwearableError(this.name.value);
    }

    return this.bindingToward(url).wear(value);
  }

  grantToward(runId: RunId, url: string): SecretGrant {
    return SecretGrant.of({
      runId,
      workspaceId: this.workspaceId,
      secretId: this.id,
      host: this.bindingToward(url).host,
    });
  }

  grantedTo(runId: RunId): readonly SecretGrant[] {
    this.guardStanding();

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

  private guardStanding(): void {
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

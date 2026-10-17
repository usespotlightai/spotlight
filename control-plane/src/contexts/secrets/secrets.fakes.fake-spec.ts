import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type {
  SecretReference,
  SecretSourcePort,
} from '@secrets/application/ports/secret-source.port';
import { RunGrants } from '@secrets/domain/aggregates/run-grants.aggregate';
import {
  Secret,
  type SecretDefinition,
} from '@secrets/domain/aggregates/secret.aggregate';
import { RunGrantsVersionConflictError } from '@secrets/domain/exceptions/run-grants-version-conflict.error';
import { SecretAlreadyDefinedError } from '@secrets/domain/exceptions/secret-already-defined.error';
import { SecretVersionConflictError } from '@secrets/domain/exceptions/secret-version-conflict.error';
import { UnreadableSecretError } from '@secrets/domain/exceptions/unreadable-secret.error';
import type { RunGrantsRepository } from '@secrets/domain/repositories/run-grants.repository';
import type { SecretRepository } from '@secrets/domain/repositories/secret.repository';
import { SecretBindings } from '@secrets/domain/value-objects/secret-bindings.vo';
import type { SecretGrant } from '@secrets/domain/value-objects/secret-grant.vo';
import type { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
import { SecretSource } from '@secrets/domain/value-objects/secret-source.vo';
import { SecretValue } from '@secrets/domain/value-objects/secret-value.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type {
  IdempotentClaim,
  IdempotentCreate,
  IdempotentCreatesPort,
} from '@shared-kernel/application/ports/idempotent-creates.port';
import type {
  LogFields,
  LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { actorFor } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const ADMIN = actorFor('user_admin');

export const WORKSPACE = WorkspaceId.of('ws_1');

export const BY = Attribution.of(ADMIN, WORKSPACE);

export const accessFor = (managesSecrets: () => boolean): WorkspaceAccessPort =>
  ({
    permissionsIn: async (workspaceId: WorkspaceId) =>
      workspaceId.equals(WORKSPACE)
        ? {
            workspaceId,
            slug: 'acme',
            configures: true,
            managesSecrets: managesSecrets(),
            managesRunners: false,
            managesTokenTrusts: false,
            administers: false,
          }
        : null,
  }) as unknown as WorkspaceAccessPort;

export const transaction: TransactionPort = { inTransaction: (work) => work() };

export class InMemoryCreates implements IdempotentCreatesPort {
  readonly #made = new Map<string, { request: string; id: string | null }>();

  async claim(create: IdempotentCreate): Promise<IdempotentClaim> {
    const key = `${create.by}:${create.key.value}`;
    const request = JSON.stringify(create.request);
    const held = this.#made.get(key);

    if (!held) {
      this.#made.set(key, { request, id: null });
      return { kind: 'fresh' };
    }

    return held.request === request && held.id
      ? { kind: 'replay', createdId: held.id }
      : { kind: 'reused' };
  }

  async created(create: IdempotentCreate, id: string): Promise<void> {
    const key = `${create.by}:${create.key.value}`;
    const held = this.#made.get(key);

    if (held) {
      this.#made.set(key, { ...held, id });
    }
  }

  get requests(): readonly string[] {
    return [...this.#made.values()].map((each) => each.request);
  }
}

export const NOW = new Date('2026-09-23T12:00:00.000Z');

export class RecordingLogger implements LoggerPort {
  readonly warned: LogFields[] = [];

  debug(): void {}

  info(): void {}

  warn(fields: LogFields): void {
    this.warned.push(fields);
  }

  error(fields: LogFields): void {
    this.warned.push(fields);
  }
}

export const clockAt = (now: () => Date = () => NOW): ClockPort => ({
  now,
  sleep: async () => {},
});

export const definition = (
  over: Partial<{
    name: string;
    source: SecretSource;
    bindings: {
      host: string;
      carrier?: string;
      name?: string;
      prefix?: string;
    }[];
    value: string | null;
    valueVersion: number | null;
  }> = {},
): SecretDefinition => ({
  name: SecretName.of(over.name ?? 'LINEAR_API_KEY'),
  source: over.source ?? SecretSource.builtIn(),
  bindings: SecretBindings.of(
    over.bindings ?? [{ host: 'api.linear.app', prefix: 'Bearer ' }],
  ),
  value: over.value === null ? null : SecretValue.of(over.value ?? 'lin_api_1'),
  valueVersion: over.valueVersion === undefined ? 1 : over.valueVersion,
});

interface StoredSecret {
  readonly secret: Secret;
  readonly version: number;
}

export class InMemorySecrets implements SecretRepository {
  readonly events: DomainEvent[] = [];
  readonly #kept = new Map<string, StoredSecret>();

  constructor(private readonly values = new InMemoryStore()) {}

  async withId(id: SecretId): Promise<Secret | null> {
    const kept = this.#kept.get(id.value);

    return kept ? this.rehydrated(kept) : null;
  }

  async named(
    workspaceId: WorkspaceId,
    name: SecretName,
  ): Promise<Secret | null> {
    const kept = [...this.#kept.values()].find(
      (each) =>
        each.secret.workspaceId.equals(workspaceId) &&
        each.secret.name.equals(name),
    );

    return kept ? this.rehydrated(kept) : null;
  }

  async inWorkspace(workspaceId: WorkspaceId): Promise<readonly Secret[]> {
    return [...this.#kept.values()]
      .filter((each) => each.secret.workspaceId.equals(workspaceId))
      .map((each) => this.rehydrated(each));
  }

  async save(secret: Secret): Promise<void> {
    const kept = this.#kept.get(secret.id.value);

    if (secret.isNew) {
      if ((await this.named(secret.workspaceId, secret.name)) !== null) {
        throw new SecretAlreadyDefinedError(secret.name.value);
      }
    } else if (!kept || kept.version !== secret.version) {
      throw new SecretVersionConflictError(secret.name.value);
    }

    this.events.push(...secret.pullEvents());

    if (secret.keeping) {
      await this.values.keep(secret, secret.keeping);
    } else if (secret.forgetsValue) {
      await this.values.forget(secret);
    }

    if (secret.isDeleted) {
      this.#kept.delete(secret.id.value);
      return;
    }

    this.#kept.set(secret.id.value, {
      secret,
      version: secret.version + 1,
    });
  }

  private rehydrated(kept: StoredSecret): Secret {
    return Secret.rehydrate({
      id: kept.secret.id,
      workspaceId: kept.secret.workspaceId,
      name: kept.secret.name,
      source: kept.secret.source,
      bindings: kept.secret.bindings,
      valueVersion: kept.secret.valueVersion,
      rotatedAt: kept.secret.rotatedAt,
      version: kept.version,
    });
  }
}

const keptCopy = (grants: RunGrants, version: number): RunGrants =>
  RunGrants.rehydrate({
    hold: grants.hold,
    workspaceId: grants.workspaceId,
    grants: grants.grants,
    redeemer: grants.redeemer,
    holdLost: grants.isHoldLost,
    endedAt: grants.endedAt,
    version,
  });

export class InMemoryGrants implements RunGrantsRepository {
  readonly #kept = new Map<string, RunGrants>();

  async find(runId: RunId): Promise<RunGrants | null> {
    const kept = this.#kept.get(runId.value);

    return kept ? keptCopy(kept, kept.version) : null;
  }

  async runsIn(workspaceId: WorkspaceId): Promise<readonly RunId[]> {
    return [...this.#kept.values()]
      .filter((each) => each.workspaceId.equals(workspaceId))
      .map((each) => each.runId);
  }

  async endedBy(
    at: Date,
    after: RunId | null,
    max: number,
  ): Promise<readonly RunId[]> {
    return [...this.#kept.values()]
      .filter(
        (each) =>
          each.endedAt !== null &&
          each.endedAt.getTime() <= at.getTime() &&
          (after === null || each.runId.value > after.value),
      )
      .map((each) => each.runId)
      .sort((one, other) => (one.value < other.value ? -1 : 1))
      .slice(0, max);
  }

  async save(grants: RunGrants): Promise<void> {
    const kept = this.#kept.get(grants.runId.value);

    if (grants.isNew ? kept : kept?.version !== grants.version) {
      throw new RunGrantsVersionConflictError(grants.runId.value);
    }

    if (grants.isDiscarded) {
      this.#kept.delete(grants.runId.value);
      return;
    }

    this.#kept.set(grants.runId.value, keptCopy(grants, grants.version + 1));
  }

  of(runId: string): RunGrants | null {
    return this.#kept.get(runId) ?? null;
  }

  get all(): readonly SecretGrant[] {
    return [...this.#kept.values()].flatMap((each) => each.grants);
  }
}

export class InMemoryStore implements SecretSourcePort {
  readonly #values = new Map<string, string>();

  async keep(secret: SecretReference, value: SecretValue): Promise<void> {
    this.#values.set(secret.id.value, value.revealed());
  }

  async read(secret: SecretReference): Promise<SecretValue> {
    const held = this.#values.get(secret.id.value);

    if (held === undefined) {
      throw new UnreadableSecretError(secret.name.value, 'no value is kept');
    }

    return SecretValue.of(held);
  }

  async forget(secret: SecretReference): Promise<void> {
    this.#values.delete(secret.id.value);
  }

  holds(secretId: SecretId): boolean {
    return this.#values.has(secretId.value);
  }
}

export const readingFrom = (
  values: Readonly<Record<string, string>>,
): SecretSourcePort => ({
  read: async (secret) => {
    const held = values[secret.source.secretId ?? ''];

    if (held === undefined) {
      throw new UnreadableSecretError(secret.name.value, 'AWS holds nothing');
    }

    return SecretValue.of(held);
  },
});

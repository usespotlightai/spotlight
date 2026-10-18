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
import { SecretAlreadyExistsError } from '@secrets/domain/exceptions/secret-already-exists.error';
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
  IdempotentCreate,
  IdempotentCreatesPort,
  IdempotentReservation,
} from '@shared-kernel/application/ports/idempotent-creates.port';
import type {
  LogFields,
  LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { actorFor } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const ADMIN = actorFor('user_admin');

export const WORKSPACE = WorkspaceId.of('ws_1');

export const BY = ChangeActor.of(ADMIN, WORKSPACE);

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
            isAdmin: false,
          }
        : null,
  }) as unknown as WorkspaceAccessPort;

export const transaction: TransactionPort = { inTransaction: (work) => work() };

export class InMemoryCreates implements IdempotentCreatesPort {
  readonly #made = new Map<string, { request: string; id: string | null }>();

  async reserve(create: IdempotentCreate): Promise<IdempotentReservation> {
    const key = `${create.by}:${create.key.value}`;
    const request = JSON.stringify(create.request);
    const stored = this.#made.get(key);

    if (!stored) {
      this.#made.set(key, { request, id: null });
      return { kind: 'new' };
    }

    return stored.request === request && stored.id
      ? { kind: 'already-created', createdId: stored.id }
      : { kind: 'key-reused' };
  }

  async recordCreated(create: IdempotentCreate, id: string): Promise<void> {
    const key = `${create.by}:${create.key.value}`;
    const stored = this.#made.get(key);

    if (stored) {
      this.#made.set(key, { ...stored, id });
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
      location?: string;
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
  readonly #records = new Map<string, StoredSecret>();

  constructor(private readonly values = new InMemoryStore()) {}

  async withId(id: SecretId): Promise<Secret | null> {
    const record = this.#records.get(id.value);

    return record ? this.rehydrated(record) : null;
  }

  async named(
    workspaceId: WorkspaceId,
    name: SecretName,
  ): Promise<Secret | null> {
    const record = [...this.#records.values()].find(
      (each) =>
        each.secret.workspaceId.equals(workspaceId) &&
        each.secret.name.equals(name),
    );

    return record ? this.rehydrated(record) : null;
  }

  async inWorkspace(workspaceId: WorkspaceId): Promise<readonly Secret[]> {
    return [...this.#records.values()]
      .filter((each) => each.secret.workspaceId.equals(workspaceId))
      .map((each) => this.rehydrated(each));
  }

  async save(secret: Secret): Promise<void> {
    const record = this.#records.get(secret.id.value);

    if (secret.isNew) {
      if ((await this.named(secret.workspaceId, secret.name)) !== null) {
        throw new SecretAlreadyExistsError(secret.name.value);
      }
    } else if (!record || record.version !== secret.version) {
      throw new SecretVersionConflictError(secret.name.value);
    }

    this.events.push(...secret.pullEvents());

    if (secret.valueToStore) {
      await this.values.store(secret, secret.valueToStore);
    } else if (secret.deletesValue) {
      await this.values.delete(secret);
    }

    if (secret.isDeleted) {
      this.#records.delete(secret.id.value);
      return;
    }

    this.#records.set(secret.id.value, {
      secret,
      version: secret.version + 1,
    });
  }

  private rehydrated(record: StoredSecret): Secret {
    return Secret.rehydrate({
      id: record.secret.id,
      workspaceId: record.secret.workspaceId,
      name: record.secret.name,
      source: record.secret.source,
      bindings: record.secret.bindings,
      valueVersion: record.secret.valueVersion,
      rotatedAt: record.secret.rotatedAt,
      version: record.version,
    });
  }
}

const copyOf = (grants: RunGrants, version: number): RunGrants =>
  RunGrants.rehydrate({
    lease: grants.lease,
    workspaceId: grants.workspaceId,
    grants: grants.grants,
    fetcher: grants.fetcher,
    leaseLost: grants.isLeaseLost,
    endedAt: grants.endedAt,
    version,
  });

export class InMemoryGrants implements RunGrantsRepository {
  readonly #records = new Map<string, RunGrants>();

  async find(runId: RunId): Promise<RunGrants | null> {
    const record = this.#records.get(runId.value);

    return record ? copyOf(record, record.version) : null;
  }

  async runsIn(workspaceId: WorkspaceId): Promise<readonly RunId[]> {
    return [...this.#records.values()]
      .filter((each) => each.workspaceId.equals(workspaceId))
      .map((each) => each.runId);
  }

  async endedBy(
    at: Date,
    after: RunId | null,
    max: number,
  ): Promise<readonly RunId[]> {
    return [...this.#records.values()]
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
    const record = this.#records.get(grants.runId.value);

    if (grants.isNew ? record : record?.version !== grants.version) {
      throw new RunGrantsVersionConflictError(grants.runId.value);
    }

    if (grants.isDiscarded) {
      this.#records.delete(grants.runId.value);
      return;
    }

    this.#records.set(grants.runId.value, copyOf(grants, grants.version + 1));
  }

  of(runId: string): RunGrants | null {
    return this.#records.get(runId) ?? null;
  }

  get all(): readonly SecretGrant[] {
    return [...this.#records.values()].flatMap((each) => each.grants);
  }
}

export class InMemoryStore implements SecretSourcePort {
  readonly #values = new Map<string, string>();

  async store(secret: SecretReference, value: SecretValue): Promise<void> {
    this.#values.set(secret.id.value, value.revealed());
  }

  async read(secret: SecretReference): Promise<SecretValue> {
    const stored = this.#values.get(secret.id.value);

    if (stored === undefined) {
      throw new UnreadableSecretError(secret.name.value, 'no value is stored');
    }

    return SecretValue.of(stored);
  }

  async delete(secret: SecretReference): Promise<void> {
    this.#values.delete(secret.id.value);
  }

  has(secretId: SecretId): boolean {
    return this.#values.has(secretId.value);
  }
}

export const readingFrom = (
  values: Readonly<Record<string, string>>,
): SecretSourcePort => ({
  read: async (secret) => {
    const stored = values[secret.source.secretId ?? ''];

    if (stored === undefined) {
      throw new UnreadableSecretError(secret.name.value, 'AWS has nothing');
    }

    return SecretValue.of(stored);
  },
});

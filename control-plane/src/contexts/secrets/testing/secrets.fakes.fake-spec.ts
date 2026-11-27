import type {
  WorkspaceAccessPort,
  WorkspacePermissions,
} from '@identity/application/ports/workspace-access.port';
import { UnreadableSecretError } from '@secrets/application/errors/unreadable-secret.error';
import type {
  SecretReference,
  SecretStorePort,
} from '@secrets/application/ports/secret-store.port';
import { RunGrants } from '@secrets/domain/aggregates/run-grants.aggregate';
import {
  Secret,
  type SecretDefinition,
} from '@secrets/domain/aggregates/secret.aggregate';
import { RunGrantsVersionConflictError } from '@secrets/domain/exceptions/run-grants-version-conflict.error';
import { SecretAlreadyExistsError } from '@secrets/domain/exceptions/secret-already-exists.error';
import { SecretVersionConflictError } from '@secrets/domain/exceptions/secret-version-conflict.error';
import type { RunGrantsRepository } from '@secrets/domain/repositories/run-grants.repository';
import type { SecretRepository } from '@secrets/domain/repositories/secret.repository';
import { SecretBindings } from '@secrets/domain/value-objects/secret-bindings.vo';
import type { SecretGrant } from '@secrets/domain/value-objects/secret-grant.vo';
import { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
import type { SecretSandbox } from '@secrets/domain/value-objects/secret-sandbox.vo';
import { SecretUses } from '@secrets/domain/value-objects/secret-uses.vo';
import { SecretValue } from '@secrets/domain/value-objects/secret-value.vo';
import { ValueVersion } from '@secrets/domain/value-objects/value-version.vo';
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
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { actorFor } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const ADMIN = actorFor('user_admin');

export const WORKSPACE = WorkspaceId.of('ws_1');

export const BY = ChangeActor.of(ADMIN, WORKSPACE);

export const SLUG = 'acme';

export const accessFor = (
  managesSecrets: () => boolean,
): WorkspaceAccessPort => {
  const permissions = (): WorkspacePermissions => ({
    workspaceId: WORKSPACE,
    slug: SLUG,
    plans: false,
    configures: true,
    scopes: new Set(managesSecrets() ? (['secrets'] as const) : []),
    isAdmin: false,
  });

  return partial<WorkspaceAccessPort>({
    permissionsIn: (workspaceId: WorkspaceId) =>
      Promise.resolve(workspaceId.equals(WORKSPACE) ? permissions() : null),
    permissionsInSlug: (slug: string) =>
      Promise.resolve(slug === SLUG ? permissions() : null),
  });
};

export const transaction: TransactionPort = { inTransaction: (work) => work() };

export class InMemoryCreates implements IdempotentCreatesPort {
  readonly #made = new Map<string, { request: string; id: string | null }>();

  reserve(create: IdempotentCreate): Promise<IdempotentReservation> {
    const key = `${create.by}:${create.key.value}`;
    const request = JSON.stringify(create.request);
    const stored = this.#made.get(key);

    if (!stored) {
      this.#made.set(key, { request, id: null });
      return Promise.resolve({ kind: 'new' });
    }

    return Promise.resolve(
      stored.request === request && stored.id !== null && stored.id !== ''
        ? { kind: 'already-created', createdId: stored.id }
        : { kind: 'key-reused' },
    );
  }

  recordCreated(create: IdempotentCreate, id: string): Promise<void> {
    const key = `${create.by}:${create.key.value}`;
    const stored = this.#made.get(key);

    if (stored) {
      this.#made.set(key, { ...stored, id });
    }

    return Promise.resolve();
  }

  get requests(): readonly string[] {
    return [...this.#made.values()].map((each) => each.request);
  }
}

export const NOW = new Date('2026-09-23T12:00:00.000Z');

export class RecordingLogger implements LoggerPort {
  readonly warned: LogFields[] = [];

  readonly informed: LogFields[] = [];

  debug(): void {}

  info(fields: LogFields): void {
    this.informed.push(fields);
  }

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
    bindings: {
      host: string;
      location?: string;
      name?: string;
      prefix?: string;
    }[];
    value: string | null;
    valueVersion: number | null;
    sandbox: SecretSandbox;
  }> = {},
): SecretDefinition => ({
  name: SecretName.of(over.name ?? 'LINEAR_API_KEY'),
  bindings: SecretBindings.of(
    over.bindings ?? [{ host: 'api.linear.app', prefix: 'Bearer ' }],
  ),
  value: over.value === null ? null : SecretValue.of(over.value ?? 'lin_api_1'),
  valueVersion:
    over.valueVersion === null ? null : ValueVersion.of(over.valueVersion ?? 1),
  sandbox: over.sandbox ?? 'stand-in',
});

interface StoredSecret {
  readonly secret: Secret;
  readonly version: number;
}

export class InMemorySecrets implements SecretRepository {
  readonly events: DomainEvent[] = [];
  readonly #records = new Map<string, StoredSecret>();

  constructor(private readonly values = new InMemoryStore()) {}

  withId(id: SecretId): Promise<Secret | null> {
    const record = this.#records.get(id.value);

    return Promise.resolve(record ? this.rehydrated(record) : null);
  }

  named(workspaceId: WorkspaceId, name: SecretName): Promise<Secret | null> {
    const record = [...this.#records.values()].find(
      (each) =>
        each.secret.workspaceId.equals(workspaceId) &&
        each.secret.name.equals(name),
    );

    return Promise.resolve(record ? this.rehydrated(record) : null);
  }

  inWorkspace(workspaceId: WorkspaceId): Promise<readonly Secret[]> {
    return Promise.resolve(
      [...this.#records.values()]
        .filter((each) => each.secret.workspaceId.equals(workspaceId))
        .map((each) => this.rehydrated(each)),
    );
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

    await secret.valueWrite({
      store: (value) => this.values.store(secret, value),
      delete: () => this.values.delete(secret),
      keep: async () => {},
    });

    if (secret.isDeleted) {
      this.#records.delete(secret.id.value);
      return;
    }

    this.#records.set(secret.id.value, {
      secret,
      version: secret.isNew ? secret.version : secret.version + 1,
    });
  }

  private rehydrated(record: StoredSecret): Secret {
    return Secret.rehydrate({
      id: record.secret.id,
      workspaceId: record.secret.workspaceId,
      name: record.secret.name,
      bindings: record.secret.bindings,
      sandbox: record.secret.sandbox,
      valueVersion: record.secret.valueVersion,
      holdsValue: this.values.has(record.secret.id),
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

export const saveSecret = (
  secrets: InMemorySecrets,
  id: string,
  over: Parameters<typeof definition>[0],
): Promise<void> =>
  secrets.save(
    Secret.create(definition(over), {
      id: SecretId.of(id),
      workspaceId: WORKSPACE,
      by: BY,
      at: NOW,
    }),
  );

export const bindStored = async (
  secrets: InMemorySecrets,
  id: string,
  over: Parameters<typeof definition>[0],
): Promise<void> => {
  await saveSecret(secrets, id, { ...over, bindings: [] });
  const stored = await secrets.withId(SecretId.of(id));

  if (!stored) {
    throw new Error(`Secret ${id} was not saved`);
  }

  await secrets.save(
    stored.update(definition(over), BY, NOW, SecretUses.none()),
  );
};

export class InMemoryGrants implements RunGrantsRepository {
  readonly #records = new Map<string, RunGrants>();

  find(runId: RunId): Promise<RunGrants | null> {
    const record = this.#records.get(runId.value);

    return Promise.resolve(record ? copyOf(record, record.version) : null);
  }

  runsIn(workspaceId: WorkspaceId): Promise<readonly RunId[]> {
    return Promise.resolve(
      [...this.#records.values()]
        .filter((each) => each.workspaceId.equals(workspaceId))
        .map((each) => each.runId),
    );
  }

  endedBy(
    at: Date,
    after: RunId | null,
    max: number,
  ): Promise<readonly RunId[]> {
    return Promise.resolve(
      [...this.#records.values()]
        .filter(
          (each) =>
            each.endedAt !== null &&
            each.endedAt.getTime() <= at.getTime() &&
            (after === null || each.runId.value > after.value),
        )
        .map((each) => each.runId)
        .sort((one, other) => (one.value < other.value ? -1 : 1))
        .slice(0, max),
    );
  }

  save(grants: RunGrants): Promise<void> {
    const record = this.#records.get(grants.runId.value);

    if (
      grants.isNew ? record !== undefined : record?.version !== grants.version
    ) {
      return Promise.reject(
        new RunGrantsVersionConflictError(grants.runId.value),
      );
    }

    if (grants.isDiscarded) {
      this.#records.delete(grants.runId.value);
      return Promise.resolve();
    }

    this.#records.set(
      grants.runId.value,
      copyOf(grants, grants.isNew ? grants.version : grants.version + 1),
    );

    return Promise.resolve();
  }

  of(runId: string): RunGrants | null {
    return this.#records.get(runId) ?? null;
  }

  get all(): readonly SecretGrant[] {
    return [...this.#records.values()].flatMap((each) => each.grants);
  }
}

export class InMemoryStore implements SecretStorePort {
  readonly #values = new Map<string, string>();

  store(secret: SecretReference, value: SecretValue): Promise<void> {
    this.#values.set(secret.id.value, value.revealed());

    return Promise.resolve();
  }

  read(secret: SecretReference): Promise<SecretValue> {
    const stored = this.#values.get(secret.id.value);

    if (stored === undefined) {
      return Promise.reject(
        new UnreadableSecretError(secret.name.value, 'no value is stored'),
      );
    }

    return Promise.resolve(SecretValue.of(stored));
  }

  delete(secret: SecretReference): Promise<void> {
    this.#values.delete(secret.id.value);

    return Promise.resolve();
  }

  has(secretId: SecretId): boolean {
    return this.#values.has(secretId.value);
  }
}

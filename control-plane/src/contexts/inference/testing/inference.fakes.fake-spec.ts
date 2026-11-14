import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type {
  InferenceTransportPort,
  ProbedEndpoint,
} from '@inference/application/ports/inference-transport.port';
import { InferenceEndpoint } from '@inference/domain/aggregates/inference-endpoint.aggregate';
import { InferenceEndpointAlreadyExistsError } from '@inference/domain/exceptions/inference-endpoint-already-exists.error';
import { InferenceEndpointVersionConflictError } from '@inference/domain/exceptions/inference-endpoint-version-conflict.error';
import type { InferenceEndpointRepository } from '@inference/domain/repositories/inference-endpoint.repository';
import type { InferenceEndpointId } from '@inference/domain/value-objects/inference-endpoint-id.vo';
import type {
  WorkspaceSecretsPort,
  WorkspaceSecretStore,
} from '@secrets/application/ports/workspace-secrets.port';
import type {
  IdempotentCreate,
  IdempotentCreatesPort,
  IdempotentReservation,
} from '@shared-kernel/application/ports/idempotent-creates.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { actorFor } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const WORKSPACE = WorkspaceId.of('ws_1');

export const ADMIN = actorFor('user_admin');

export const transaction: TransactionPort = { inTransaction: (work) => work() };

export const accessFor = (managesSecrets: () => boolean): WorkspaceAccessPort =>
  ({
    permissionsIn: async (workspaceId: WorkspaceId) =>
      workspaceId.equals(WORKSPACE)
        ? {
            workspaceId,
            slug: 'acme',
            configures: true,
            scopes: new Set(managesSecrets() ? (['secrets'] as const) : []),
            isAdmin: false,
          }
        : null,
  }) as unknown as WorkspaceAccessPort;

export class InMemoryInferenceEndpoints implements InferenceEndpointRepository {
  readonly #records = new Map<string, InferenceEndpoint>();

  async add(endpoint: InferenceEndpoint): Promise<void> {
    if (await this.ofWorkspace(endpoint.workspaceId)) {
      throw new InferenceEndpointAlreadyExistsError(endpoint.workspaceId.value);
    }

    this.#records.set(endpoint.id.value, endpoint);
  }

  async save(endpoint: InferenceEndpoint): Promise<void> {
    const current = this.#records.get(endpoint.id.value);

    if (!current || current.version !== endpoint.version) {
      throw new InferenceEndpointVersionConflictError(endpoint.id.value);
    }

    if (endpoint.isDeleted) {
      this.#records.delete(endpoint.id.value);
      return;
    }

    this.#records.set(
      endpoint.id.value,
      InferenceEndpoint.rehydrate({
        id: endpoint.id,
        workspaceId: endpoint.workspaceId,
        definition: endpoint.definition,
        version: endpoint.version + 1,
      }),
    );
  }

  async find(id: InferenceEndpointId): Promise<InferenceEndpoint | null> {
    return this.#records.get(id.value) ?? null;
  }

  async ofWorkspace(
    workspaceId: WorkspaceId,
  ): Promise<InferenceEndpoint | null> {
    return (
      [...this.#records.values()].find((each) =>
        each.workspaceId.equals(workspaceId),
      ) ?? null
    );
  }
}

export class InMemoryWorkspaceSecrets implements WorkspaceSecretsPort {
  readonly values = new Map<string, string>();

  async store(secret: WorkspaceSecretStore): Promise<void> {
    if (secret.value !== null) {
      this.values.set(`${secret.workspaceId}/${secret.name}`, secret.value);
    }
  }

  async reveal(workspaceId: string, name: string): Promise<string | null> {
    return this.values.get(`${workspaceId}/${name}`) ?? null;
  }

  async remove(workspaceId: string, name: string): Promise<void> {
    this.values.delete(`${workspaceId}/${name}`);
  }
}

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

export class RecordingTransport implements InferenceTransportPort {
  readonly probed: { workspaceId: string; endpoint: ProbedEndpoint }[] = [];
  refusal: string | null = null;

  async refusalOf(): Promise<string | null> {
    return this.refusal;
  }

  async probe(workspaceId: string, endpoint: ProbedEndpoint) {
    this.probed.push({ workspaceId, endpoint });

    return { ok: true, message: 'The endpoint answered.' };
  }
}

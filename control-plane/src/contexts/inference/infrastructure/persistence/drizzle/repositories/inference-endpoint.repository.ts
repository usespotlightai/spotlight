import {
  InferenceEndpoint,
  type InferenceEndpointDefinition,
} from '@inference/domain/aggregates/inference-endpoint.aggregate';
import { InferenceEndpointAlreadyExistsError } from '@inference/domain/exceptions/inference-endpoint-already-exists.error';
import { InferenceEndpointVersionConflictError } from '@inference/domain/exceptions/inference-endpoint-version-conflict.error';
import type { InferenceEndpointRepository } from '@inference/domain/repositories/inference-endpoint.repository';
import { BaseUrl } from '@inference/domain/value-objects/base-url.vo';
import { InferenceEndpointId } from '@inference/domain/value-objects/inference-endpoint-id.vo';
import { ModelName } from '@inference/domain/value-objects/model-name.vo';
import { inferenceEndpoint } from '@inference/infrastructure/persistence/drizzle/schemas/inference.schema';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  UNIQUE_VIOLATION,
  violates,
} from '@platform/persistence/drizzle/violations';
import type { DomainEventDispatcher } from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, type SQL } from 'drizzle-orm';

const columnsOf = (definition: InferenceEndpointDefinition) => ({
  baseUrl: definition.baseUrl.value,
  model: definition.model.value,
  apiKeyVersion: definition.apiKeyVersion,
});

export class DrizzleInferenceEndpoints implements InferenceEndpointRepository {
  constructor(
    private readonly context: DrizzleContext,
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: InferenceEndpoint): Promise<void> {
    try {
      await this.context.db.insert(inferenceEndpoint).values({
        id: added.id.value,
        workspaceId: added.workspaceId.value,
        ...columnsOf(added.definition),
        version: added.version,
      });
      await this.events.dispatch(added.pullEvents());
    } catch (error) {
      if (violates(error, UNIQUE_VIOLATION, 'inference_endpoint_workspace')) {
        throw new InferenceEndpointAlreadyExistsError(added.workspaceId.value);
      }

      throw error;
    }
  }

  async save(saved: InferenceEndpoint): Promise<void> {
    const matching = and(
      eq(inferenceEndpoint.id, saved.id.value),
      eq(inferenceEndpoint.version, saved.version),
    );
    const written = saved.isDeleted
      ? await this.context.db
          .delete(inferenceEndpoint)
          .where(matching)
          .returning({ id: inferenceEndpoint.id })
      : await this.context.db
          .update(inferenceEndpoint)
          .set({ ...columnsOf(saved.definition), version: saved.version + 1 })
          .where(matching)
          .returning({ id: inferenceEndpoint.id });

    if (written.length === 0) {
      throw new InferenceEndpointVersionConflictError(saved.id.value);
    }

    await this.events.dispatch(saved.pullEvents());
  }

  find(id: InferenceEndpointId): Promise<InferenceEndpoint | null> {
    return this.first(eq(inferenceEndpoint.id, id.value));
  }

  ofWorkspace(workspaceId: WorkspaceId): Promise<InferenceEndpoint | null> {
    return this.first(eq(inferenceEndpoint.workspaceId, workspaceId.value));
  }

  private async first(where: SQL): Promise<InferenceEndpoint | null> {
    const [found] = await this.context.db
      .select()
      .from(inferenceEndpoint)
      .where(where)
      .limit(1);

    return found
      ? InferenceEndpoint.rehydrate({
          id: InferenceEndpointId.of(found.id),
          workspaceId: WorkspaceId.of(found.workspaceId),
          definition: {
            baseUrl: BaseUrl.of(found.baseUrl),
            model: ModelName.of(found.model),
            apiKeyVersion: found.apiKeyVersion,
          },
          version: found.version,
        })
      : null;
  }
}

import { InferenceEndpointCreated } from '@inference/domain/events/inference-endpoint-created.event';
import { InferenceEndpointDeleted } from '@inference/domain/events/inference-endpoint-deleted.event';
import { InferenceEndpointUpdated } from '@inference/domain/events/inference-endpoint-updated.event';
import { InferenceEndpointVersionConflictError } from '@inference/domain/exceptions/inference-endpoint-version-conflict.error';
import { InvalidInferenceEndpointError } from '@inference/domain/exceptions/invalid-inference-endpoint.error';
import type { BaseUrl } from '@inference/domain/value-objects/base-url.vo';
import type { InferenceEndpointId } from '@inference/domain/value-objects/inference-endpoint-id.vo';
import type { ModelName } from '@inference/domain/value-objects/model-name.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface InferenceEndpointDefinition {
  readonly baseUrl: BaseUrl;
  readonly model: ModelName;
  readonly apiKeyVersion: number | null;
}

interface Identity {
  readonly id: InferenceEndpointId;
  readonly workspaceId: WorkspaceId;
}

export type ApiKeyWrite = 'store' | 'remove' | 'keep';

const KEY = 'apiKeyWo';

const KEY_VERSION = 'apiKeyWoVersion';

const assertVersionedKey = (
  definition: InferenceEndpointDefinition,
  apiKeySent: boolean,
): void => {
  if (apiKeySent && definition.apiKeyVersion === null) {
    throw new InvalidInferenceEndpointError(
      KEY_VERSION,
      `is required with ${KEY}`,
    );
  }
};

export class InferenceEndpoint extends EventRecorder {
  private constructor(
    readonly id: InferenceEndpointId,
    readonly workspaceId: WorkspaceId,
    readonly definition: InferenceEndpointDefinition,
    readonly version: number,
    readonly isDeleted: boolean,
    readonly apiKeyWrite: ApiKeyWrite,
  ) {
    super();
  }

  static create(
    input: Identity & {
      definition: InferenceEndpointDefinition;
      apiKeySent: boolean;
      by: ChangeActor;
    },
  ): InferenceEndpoint {
    assertVersionedKey(input.definition, input.apiKeySent);

    if (!input.apiKeySent && input.definition.apiKeyVersion !== null) {
      throw new InvalidInferenceEndpointError(
        KEY,
        `is required when ${KEY_VERSION} is set`,
      );
    }

    const created = new InferenceEndpoint(
      input.id,
      input.workspaceId,
      input.definition,
      0,
      false,
      input.apiKeySent ? 'store' : 'keep',
    );

    created.record(
      new InferenceEndpointCreated(
        input.id,
        input.workspaceId,
        ConfigurationChange.created(created.whatChanged, input.by),
      ),
    );

    return created;
  }

  static rehydrate(
    input: Identity & {
      definition: InferenceEndpointDefinition;
      version: number;
    },
  ): InferenceEndpoint {
    if (!Number.isInteger(input.version) || input.version < 0) {
      throw new InconsistentStateError(
        'inference endpoint',
        `has an impossible version (${input.version})`,
      );
    }

    return new InferenceEndpoint(
      input.id,
      input.workspaceId,
      input.definition,
      input.version,
      false,
      'keep',
    );
  }

  assertVersion(version: number): void {
    if (version !== this.version) {
      throw new InferenceEndpointVersionConflictError(this.id.value);
    }
  }

  update(
    definition: InferenceEndpointDefinition,
    apiKeySent: boolean,
    by: ChangeActor,
  ): InferenceEndpoint {
    this.assertNotDeleted();
    assertVersionedKey(definition, apiKeySent);

    const updated = this.with(
      definition,
      false,
      this.apiKeyWriteFor(definition, apiKeySent),
    );

    updated.record(
      new InferenceEndpointUpdated(
        this.id,
        this.workspaceId,
        ConfigurationChange.updated(this.whatChanged, by),
      ),
    );

    return updated;
  }

  delete(by: ChangeActor): InferenceEndpoint {
    this.assertNotDeleted();

    const deleted = this.with(this.definition, true, 'remove');

    deleted.record(
      new InferenceEndpointDeleted(
        this.id,
        this.workspaceId,
        ConfigurationChange.deleted(this.whatChanged, by),
      ),
    );

    return deleted;
  }

  get hasApiKey(): boolean {
    return this.definition.apiKeyVersion !== null;
  }

  private apiKeyWriteFor(
    definition: InferenceEndpointDefinition,
    apiKeySent: boolean,
  ): ApiKeyWrite {
    if (definition.apiKeyVersion === this.definition.apiKeyVersion) {
      if (
        this.hasApiKey &&
        !definition.baseUrl.equals(this.definition.baseUrl)
      ) {
        throw new InvalidInferenceEndpointError(
          KEY,
          `is required, with a changed ${KEY_VERSION}, when baseUrl changes`,
        );
      }

      return 'keep';
    }

    if (definition.apiKeyVersion === null) {
      return 'remove';
    }

    if (!apiKeySent) {
      throw new InvalidInferenceEndpointError(
        KEY,
        `is required when ${KEY_VERSION} changes`,
      );
    }

    return 'store';
  }

  private assertNotDeleted(): void {
    if (this.isDeleted) {
      throw new InconsistentStateError(
        'inference endpoint',
        'was changed after it was deleted',
      );
    }
  }

  private get whatChanged() {
    return {
      resource: 'inference-endpoint' as const,
      id: this.id.value,
      key: 'inference',
    };
  }

  private with(
    definition: InferenceEndpointDefinition,
    deleted: boolean,
    apiKeyWrite: ApiKeyWrite,
  ): InferenceEndpoint {
    const next = new InferenceEndpoint(
      this.id,
      this.workspaceId,
      definition,
      this.version,
      deleted,
      apiKeyWrite,
    );

    next.inheritEvents(this);

    return next;
  }
}

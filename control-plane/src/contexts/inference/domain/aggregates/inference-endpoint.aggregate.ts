import { InferenceEndpointVersionConflictError } from '@inference/domain/exceptions/inference-endpoint-version-conflict.error';
import type { BaseUrl } from '@inference/domain/value-objects/base-url.vo';
import type { InferenceEndpointId } from '@inference/domain/value-objects/inference-endpoint-id.vo';
import type { ModelName } from '@inference/domain/value-objects/model-name.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface InferenceEndpointDefinition {
  readonly baseUrl: BaseUrl;
  readonly model: ModelName;
  readonly supportsReasoningEffort: boolean;
  readonly apiKeyVersion: number | null;
}

interface Identity {
  readonly id: InferenceEndpointId;
  readonly workspaceId: WorkspaceId;
}

export class InferenceEndpoint {
  private constructor(
    readonly id: InferenceEndpointId,
    readonly workspaceId: WorkspaceId,
    readonly definition: InferenceEndpointDefinition,
    readonly version: number,
    readonly isDeleted: boolean,
  ) {}

  static create(
    input: Identity & { definition: InferenceEndpointDefinition },
  ): InferenceEndpoint {
    return new InferenceEndpoint(
      input.id,
      input.workspaceId,
      input.definition,
      0,
      false,
    );
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
    );
  }

  assertVersion(version: number): void {
    if (version !== this.version) {
      throw new InferenceEndpointVersionConflictError(this.id.value);
    }
  }

  update(definition: InferenceEndpointDefinition): InferenceEndpoint {
    this.assertNotDeleted();

    return new InferenceEndpoint(
      this.id,
      this.workspaceId,
      definition,
      this.version,
      false,
    );
  }

  delete(): InferenceEndpoint {
    this.assertNotDeleted();

    return new InferenceEndpoint(
      this.id,
      this.workspaceId,
      this.definition,
      this.version,
      true,
    );
  }

  get hasApiKey(): boolean {
    return this.definition.apiKeyVersion !== null;
  }

  private assertNotDeleted(): void {
    if (this.isDeleted) {
      throw new InconsistentStateError(
        'inference endpoint',
        'was changed after it was deleted',
      );
    }
  }
}

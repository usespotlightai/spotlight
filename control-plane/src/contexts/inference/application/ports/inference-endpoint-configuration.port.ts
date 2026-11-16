import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const INFERENCE_ENDPOINT_CONFIGURATION = Symbol(
  'INFERENCE_ENDPOINT_CONFIGURATION',
);

export interface InferenceEndpointView {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly baseUrl: string;
  readonly model: string;
  readonly apiKeySet: boolean;
  readonly apiKeyVersion: number | null;
}

export interface InferenceEndpointConfigurationPort {
  in(workspaceId: WorkspaceId): Promise<InferenceEndpointView | null>;

  withId(id: string): Promise<InferenceEndpointView | null>;
}

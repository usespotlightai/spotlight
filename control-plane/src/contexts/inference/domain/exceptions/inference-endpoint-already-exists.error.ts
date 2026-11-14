import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InferenceEndpointAlreadyExistsError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(workspaceId: string) {
    super(`Workspace ${workspaceId} already has an inference endpoint.`);
    this.name = 'InferenceEndpointAlreadyExistsError';
  }
}

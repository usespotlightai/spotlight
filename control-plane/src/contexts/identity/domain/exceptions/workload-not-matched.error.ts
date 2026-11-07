import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class WorkloadNotMatchedError extends DomainError {
  readonly kind = 'not-allowed' as const;

  constructor(key: string) {
    super(`OIDC trust ${key} does not match this workload.`);
    this.name = 'WorkloadNotMatchedError';
  }
}

import type { WorkloadClaims } from '@runners/domain/value-objects/trusted-workload.vo';

export const WORKLOAD_TOKENS = Symbol('WORKLOAD_TOKENS');

export interface ExpectedWorkload {
  readonly issuer: string;
  readonly audience: string;
}

export interface WorkloadTokensPort {
  verify(
    token: string,
    expected: ExpectedWorkload,
  ): Promise<WorkloadClaims | null>;
}

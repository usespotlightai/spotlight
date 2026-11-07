import type { RunRequester } from '@runs/domain/value-objects/run-requester.vo';

export const EXCLUSIVE_CLAIM_LOCKS = Symbol('EXCLUSIVE_CLAIM_LOCKS');

export interface ExclusiveClaimLocksPort {
  claimingFor<T>(requester: RunRequester, work: () => Promise<T>): Promise<T>;
}

import type { IdempotencyKey } from '@shared-kernel/domain/value-objects/idempotency-key.vo';

export const IDEMPOTENT_CREATES = Symbol('IDEMPOTENT_CREATES');

export interface IdempotentCreate {
  readonly by: string;
  readonly key: IdempotencyKey;
  readonly request: unknown;
}

export type IdempotentClaim =
  | { readonly kind: 'fresh' }
  | { readonly kind: 'replay'; readonly createdId: string }
  | { readonly kind: 'reused' };

export interface IdempotentCreatesPort {
  claim(create: IdempotentCreate): Promise<IdempotentClaim>;

  created(create: IdempotentCreate, id: string): Promise<void>;
}

import type { IdempotencyKey } from '@shared-kernel/domain/value-objects/idempotency-key.vo';

export const IDEMPOTENT_CREATES = Symbol('IDEMPOTENT_CREATES');

export interface IdempotentCreate {
  readonly by: string;
  readonly key: IdempotencyKey;
  readonly request: unknown;
}

export type IdempotentReservation =
  | { readonly kind: 'new' }
  | { readonly kind: 'already-created'; readonly createdId: string }
  | { readonly kind: 'key-reused' };

export interface IdempotentCreatesPort {
  reserve(create: IdempotentCreate): Promise<IdempotentReservation>;

  recordCreated(create: IdempotentCreate, id: string): Promise<void>;
}

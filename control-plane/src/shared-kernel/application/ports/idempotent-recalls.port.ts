import type { IdempotentCreate } from '@shared-kernel/application/ports/idempotent-creates.port';

export const IDEMPOTENT_RECALLS = Symbol('IDEMPOTENT_RECALLS');

export type IdempotentRecall =
  | { readonly kind: 'unseen' }
  | { readonly kind: 'replay'; readonly createdId: string }
  | { readonly kind: 'reused' };

export interface IdempotentRecallsPort {
  recall(create: IdempotentCreate): Promise<IdempotentRecall>;
}

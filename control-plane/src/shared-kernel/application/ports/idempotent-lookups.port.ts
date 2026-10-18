import type { IdempotentCreate } from '@shared-kernel/application/ports/idempotent-creates.port';

export const IDEMPOTENT_LOOKUPS = Symbol('IDEMPOTENT_LOOKUPS');

export type IdempotentLookup =
  | { readonly kind: 'new' }
  | { readonly kind: 'already-created'; readonly createdId: string }
  | { readonly kind: 'key-reused' };

export interface IdempotentLookupsPort {
  lookup(create: IdempotentCreate): Promise<IdempotentLookup>;
}

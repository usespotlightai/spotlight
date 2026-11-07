import type { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';

export interface ScopedRemoval<A> {
  ofScope(scope: DeletionScope, max: number): Promise<readonly A[]>;

  remove(aggregate: A): Promise<void>;
}

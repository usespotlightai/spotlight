import type { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import type { Erased } from '@shared-kernel/domain/erased';

export interface ScopedRemoval<A> {
  ofScope(scope: DeletionScope, max: number): Promise<readonly A[]>;

  remove(aggregate: Erased<A>): Promise<void>;
}

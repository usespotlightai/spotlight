import type { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import type { FactOwner } from '@insights/domain/value-objects/fact-owner.vo';
import type { Tombstones } from '@insights/domain/value-objects/tombstones.vo';

export interface DeletionsPort {
  // Both hold their locks until the surrounding transaction ends, so a fact and a deletion never interleave.
  markDeleted(scope: DeletionScope): Promise<void>;

  tombstonesOf(owner: FactOwner): Promise<Tombstones>;
}

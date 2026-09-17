import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { Harness } from '@work/domain/value-objects/harness.vo';

export interface HarnessCatalog {
  all(): readonly Harness[];

  named(id: HarnessId): Harness | null;
}

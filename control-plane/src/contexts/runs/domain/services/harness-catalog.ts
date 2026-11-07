import type { Harness } from '@runs/domain/value-objects/harness.vo';
import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';

export interface HarnessCatalog {
  all(): readonly Harness[];

  named(id: HarnessId): Harness | null;
}

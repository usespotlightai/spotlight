import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';

export interface HarnessCatalog {
  knows(id: HarnessId): boolean;
}

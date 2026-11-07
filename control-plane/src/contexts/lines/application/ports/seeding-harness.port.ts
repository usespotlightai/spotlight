import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';

export const SEEDING_HARNESS = Symbol('SEEDING_HARNESS');

export interface SeedingHarnessPort {
  readonly harness: HarnessId;
}

import type { Harness } from '@domain/entities/harness.entity';
import type { HarnessId } from '@domain/value-objects/harness-id.vo';

export interface HarnessRepository {
  all(): readonly Harness[];

  named(id: HarnessId): Harness | null;
}

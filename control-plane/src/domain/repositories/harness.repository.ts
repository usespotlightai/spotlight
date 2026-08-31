import type { Harness } from '@domain/entities/harness.entity';
import type { HarnessId } from '@domain/value-objects/harness-id.vo';

/**
 * The harnesses this Spotlight can work with. Which they are, and what has to
 * be run to start one, is the machine's business rather than the domain's:
 * the domain only asks for the one a station names.
 */
export interface HarnessRepository {
  all(): readonly Harness[];

  named(id: HarnessId): Harness | null;
}

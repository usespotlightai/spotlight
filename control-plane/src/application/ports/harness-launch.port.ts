import type { Effort } from '@domain/value-objects/effort.vo';
import type { HarnessCommand } from '@domain/value-objects/harness-command.vo';
import type { HarnessId } from '@domain/value-objects/harness-id.vo';
import type { HarnessModel } from '@domain/value-objects/harness-model.vo';

export const HARNESS_LAUNCH = Symbol('HARNESS_LAUNCH');

export interface HarnessCatalogueEntry {
  readonly id: string;
  readonly name: string;
  /** What a runner looks for on its PATH. */
  readonly executable: string;
  readonly efforts: readonly string[];
  /** What a runner runs to list its models, argv-style. Empty where it cannot. */
  readonly discovery: readonly string[];
}

/**
 * How a harness is started. The vendor specifics — executable, environment, how
 * a model or effort is passed — live behind this, out of the domain.
 */
export interface HarnessLaunchPort {
  /** Null where no such harness is known. An unset model or effort is not imposed. */
  commandFor(
    id: HarnessId,
    chosen: { model: HarnessModel | null; effort: Effort | null },
  ): HarnessCommand | null;

  catalogue(): readonly HarnessCatalogueEntry[];
}

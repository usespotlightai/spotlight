import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import type { Effort } from '@work/domain/value-objects/effort.vo';
import type { HarnessCommand } from '@work/domain/value-objects/harness-command.vo';

export const HARNESS_LAUNCH = Symbol('HARNESS_LAUNCH');

export interface HarnessCatalogueEntry {
  readonly id: string;
  readonly name: string;
  readonly executable: string;
  readonly efforts: readonly string[];
  readonly discovery: readonly string[];
}

export interface SkillsHome {
  readonly directory: string;
  readonly readByHarness: boolean;
}

export interface HarnessLaunchPort {
  commandFor(
    id: HarnessId,
    chosen: { model: HarnessModel | null; effort: Effort | null },
  ): HarnessCommand | null;

  skillsFor(id: HarnessId): SkillsHome | null;

  catalogue(): readonly HarnessCatalogueEntry[];
}

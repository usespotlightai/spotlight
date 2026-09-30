import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import type { HarnessSetupShape } from '@work/application/contracts/run-spec.contract';
import type { Effort } from '@work/domain/value-objects/effort.vo';
import type { HarnessCommand } from '@work/domain/value-objects/harness-command.vo';
import type { ReadyProfile } from '@work/domain/value-objects/ready-profile';

export const HARNESS_LAUNCH = Symbol('HARNESS_LAUNCH');

export interface HarnessCatalogueEntry {
  readonly id: string;
  readonly name: string;
  readonly executable: string;
  readonly efforts: readonly string[];
  readonly discovery: readonly string[];
  readonly versionProbe: readonly string[];
}

export interface SkillsHome {
  readonly directory: string;
  readonly readByHarness: boolean;
}

export interface Chosen {
  readonly model: HarnessModel | null;
  readonly effort: Effort | null;
}

export interface PreparedHarness {
  readonly command: HarnessCommand;
  readonly setup: HarnessSetupShape | null;
}

export interface HarnessLaunchPort {
  commandFor(id: HarnessId, chosen: Chosen): HarnessCommand | null;

  preparedFor(
    id: HarnessId,
    chosen: Chosen & { readonly profile: ReadyProfile | null },
  ): PreparedHarness | null;

  skillsFor(id: HarnessId): SkillsHome | null;

  skillHomes(): readonly string[];

  settingFiles(): readonly string[];

  catalogue(): readonly HarnessCatalogueEntry[];
}

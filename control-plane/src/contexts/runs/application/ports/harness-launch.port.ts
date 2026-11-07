import type {
  HarnessProfileShape,
  ReadyProfileShape,
} from '@runs/application/contracts/harness-profile.contract';
import type {
  HarnessSetupShape,
  RunCommandShape,
} from '@runs/application/contracts/run-spec.contract';
import type { Effort } from '@shared-kernel/domain/value-objects/effort.vo';
import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';

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
  readonly command: RunCommandShape;
  readonly setup: HarnessSetupShape | null;
}

export interface HarnessLaunchPort {
  commandFor(id: HarnessId, chosen: Chosen): RunCommandShape | null;

  preparedFor(
    id: HarnessId,
    chosen: Chosen & { readonly profile: ReadyProfileShape | null },
  ): PreparedHarness | null;

  readyProfile(shape: HarnessProfileShape): ReadyProfileShape;

  skillsFor(id: HarnessId): SkillsHome | null;

  skillHomes(): readonly string[];

  settingFiles(): readonly string[];

  catalogue(): readonly HarnessCatalogueEntry[];

  defaultHarness(): HarnessId;
}

import type { ReadProfile } from '@configuration/domain/aggregates/harness-profile.aggregate';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export const HARNESS_PROFILE_COMPILER = Symbol('HARNESS_PROFILE_COMPILER');

export type CompiledProfile =
  | ({ readonly ok: true } & ReadProfile)
  | { readonly ok: false; readonly problems: readonly ConfigurationProblem[] };

export interface HarnessProfileCompilerPort {
  compile(held: unknown): CompiledProfile;
  read(held: unknown): CompiledProfile;
  warningsOf(read: ReadProfile): readonly ConfigurationProblem[];
}

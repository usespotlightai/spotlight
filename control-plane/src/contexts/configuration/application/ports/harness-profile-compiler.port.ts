import type { ReadProfile } from '@configuration/domain/aggregates/harness-profile.aggregate';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export const HARNESS_PROFILE_COMPILER = Symbol('HARNESS_PROFILE_COMPILER');

export type ParsedProfile =
  | ({ readonly ok: true } & ReadProfile)
  | { readonly ok: false; readonly problems: readonly ConfigurationProblem[] };

export interface HarnessProfileCompilerPort {
  compile(input: unknown): ParsedProfile;
  read(input: unknown): ParsedProfile;
  warningsOf(read: ReadProfile): readonly ConfigurationProblem[];
}

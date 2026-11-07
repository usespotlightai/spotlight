import type { ParsedProfile } from '@configuration/domain/aggregates/harness-profile.aggregate';
import type { HarnessCompatibility } from '@configuration/domain/value-objects/harness-compatibility.vo';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export const HARNESS_PROFILE_COMPILER = Symbol('HARNESS_PROFILE_COMPILER');

export type ProfileParseResult =
  | ({ readonly ok: true } & ParsedProfile)
  | { readonly ok: false; readonly problems: readonly ConfigurationProblem[] };

export interface HarnessProfileCompilerPort {
  parse(input: unknown): ProfileParseResult;
  compatibilityOf(parsed: ParsedProfile): HarnessCompatibility;
  warningsOf(parsed: ParsedProfile): readonly ConfigurationProblem[];
}

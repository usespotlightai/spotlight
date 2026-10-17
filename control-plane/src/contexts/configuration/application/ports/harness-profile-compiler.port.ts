import type { ParsedProfile } from '@configuration/domain/aggregates/harness-profile.aggregate';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export const HARNESS_PROFILE_COMPILER = Symbol('HARNESS_PROFILE_COMPILER');

export type ProfileParseResult =
  | ({ readonly ok: true } & ParsedProfile)
  | { readonly ok: false; readonly problems: readonly ConfigurationProblem[] };

export interface HarnessProfileCompilerPort {
  compile(input: unknown): ProfileParseResult;
  parse(input: unknown): ProfileParseResult;
  warningsOf(parsed: ParsedProfile): readonly ConfigurationProblem[];
}

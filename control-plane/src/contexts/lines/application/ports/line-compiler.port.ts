import type { LinePlan } from '@lines/domain/value-objects/line-plan.vo';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export const LINE_COMPILER = Symbol('LINE_COMPILER');

export type ParsedLine =
  | { readonly ok: true; readonly line: LinePlan }
  | { readonly ok: false; readonly problems: readonly ConfigurationProblem[] };

export interface LineCompilerPort {
  compile(input: unknown): ParsedLine;
}

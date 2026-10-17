import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import type { LinePlan } from '@work/domain/value-objects/line-plan.vo';

export const LINE_COMPILER = Symbol('LINE_COMPILER');

export type ParsedLine =
  | { readonly ok: true; readonly line: LinePlan }
  | { readonly ok: false; readonly problems: readonly ConfigurationProblem[] };

export interface LineCompilerPort {
  compile(held: unknown): ParsedLine;
}

import type { ReadSkill } from '@configuration/domain/aggregates/skill-definition.aggregate';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export const SKILL_COMPILER = Symbol('SKILL_COMPILER');

export type CompiledSkill =
  | ({ readonly ok: true } & ReadSkill)
  | { readonly ok: false; readonly problems: readonly ConfigurationProblem[] };

export interface SkillCompilerPort {
  compile(held: unknown): CompiledSkill;
}

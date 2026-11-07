import type { SkillFolder } from '@configuration/domain/aggregates/skill-definition.aggregate';
import type { SkillFolderReading } from '@configuration/domain/services/skill-folder-reading';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export const SKILL_COMPILER = Symbol('SKILL_COMPILER');

export type SkillParseResult =
  | ({ readonly ok: true } & SkillFolder)
  | { readonly ok: false; readonly problems: readonly ConfigurationProblem[] };

export interface SkillCompilerPort extends SkillFolderReading {
  compile(input: unknown): SkillParseResult;
}

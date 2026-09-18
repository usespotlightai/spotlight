import type { SkillKey } from '@work/domain/value-objects/skill-key.vo';
import type { Tool } from '@work/domain/value-objects/tool.vo';

export interface ReadySkill {
  readonly key: SkillKey;
  readonly tools: readonly Tool[];
}

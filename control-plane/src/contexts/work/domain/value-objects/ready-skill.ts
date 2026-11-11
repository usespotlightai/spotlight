import type { SkillKey } from '@shared-kernel/domain/value-objects/skill-key.vo';
import type { Tool } from '@shared-kernel/domain/value-objects/tool.vo';

export interface ReadySkill {
  readonly key: SkillKey;
  readonly tools: readonly Tool[];
}

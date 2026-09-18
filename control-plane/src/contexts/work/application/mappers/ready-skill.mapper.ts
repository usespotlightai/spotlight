import type { ReadySkillFolder } from '@work/application/dto/ready-skill.dto';
import type { ReadySkill } from '@work/domain/value-objects/ready-skill';
import { SkillKey } from '@work/domain/value-objects/skill-key.vo';
import { Tool } from '@work/domain/value-objects/tool.vo';

export const ReadySkillMapper = {
  toReady(folder: ReadySkillFolder): ReadySkill {
    return {
      key: SkillKey.of(folder.skill.key),
      tools: folder.skill.tools.map((each) => Tool.of(each)),
    };
  },
};

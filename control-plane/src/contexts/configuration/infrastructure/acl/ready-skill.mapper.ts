import type { SkillFolder } from '@configuration/application/ports/skill-reader.port';
import type { ReadySkillFolder } from '@work/application/dto/ready-skill.dto';

export const ReadySkillMapper = {
  toReady(folder: SkillFolder): ReadySkillFolder {
    return {
      skill: {
        key: folder.skill.key.value,
        description: folder.skill.description,
        tools: folder.skill.tools.map((each) => each.value),
      },
      files: folder.files,
    };
  },
};

import type { ReadSkillFolder } from '@configuration/application/ports/skill-folders.port';
import type { ReadySkillFolder } from '@work/application/dto/ready-skill.dto';

export const ReadySkillMapper = {
  toReady(folder: ReadSkillFolder): ReadySkillFolder {
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

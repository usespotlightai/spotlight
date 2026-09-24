import type { SkillFileShape } from '@work/application/contracts/run-spec.contract';
import type { ReadySkillFolder } from '@work/application/dto/ready-skill.dto';
import type { SkillsHome } from '@work/application/ports/harness-launch.port';
import { SkillKey } from '@work/domain/value-objects/skill-key.vo';

export const skillFilesOf = (
  folders: readonly ReadySkillFolder[],
  home: SkillsHome,
): SkillFileShape[] =>
  folders.flatMap((folder) =>
    folder.files.map((file) => ({
      path: `${home.directory}/${SkillKey.of(folder.skill.key).folder}/${file.path}`,
      text: file.text,
    })),
  );

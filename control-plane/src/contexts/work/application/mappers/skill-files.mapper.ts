import type { SkillFileShape } from '@work/application/contracts/run-spec.contract';
import type { ReadySkillFolder } from '@work/application/dto/ready-skill.dto';
import type { SkillsHome } from '@work/application/ports/harness-launch.port';

export const skillFilesOf = (
  folders: readonly ReadySkillFolder[],
  home: SkillsHome,
): SkillFileShape[] =>
  folders.flatMap((folder) =>
    folder.files.map((file) => ({
      path: `${home.directory}/${folder.skill.key}/${file.path}`,
      text: file.text,
    })),
  );

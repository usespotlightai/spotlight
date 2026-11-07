import { SkillKey } from '@shared-kernel/domain/value-objects/skill-key.vo';
import type { SkillFileShape } from '@work/application/contracts/run-spec.contract';
import type { ReadySkillFolder } from '@work/application/dto/ready-skill.dto';
import type { SkillsHome } from '@work/application/ports/harness-launch.port';
import { skillFolderOf } from '@work/domain/services/skill-folder';

export const skillFilesOf = (
  folders: readonly ReadySkillFolder[],
  home: SkillsHome,
): SkillFileShape[] =>
  folders.flatMap((folder) =>
    folder.files.map((file) => ({
      path: `${home.directory}/${skillFolderOf(SkillKey.of(folder.skill.key))}/${file.path}`,
      text: file.text,
    })),
  );

import type { SkillFileShape } from '@application/contracts/run-spec.contract';
import type { SkillsHome } from '@application/ports/harness-launch.port';
import type { SkillFolder } from '@application/ports/skill-reader.port';

export const skillFilesOf = (
  folders: readonly SkillFolder[],
  home: SkillsHome,
): SkillFileShape[] =>
  folders.flatMap((folder) =>
    folder.files.map((file) => ({
      path: `${home.directory}/${folder.skill.key.value}/${file.path}`,
      text: file.text,
    })),
  );

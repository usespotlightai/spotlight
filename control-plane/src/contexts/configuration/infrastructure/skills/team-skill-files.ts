import { SKILLS_UNDER } from '@configuration/application/contracts/configuration-layout.contract';
import type {
  ReadSkills,
  SkillFolder,
  SkillOrigin,
  SkillReaderPort,
} from '@configuration/application/ports/skill-reader.port';
import { InvalidSkillError } from '@configuration/domain/exceptions/invalid-skill.error';
import { readSkillFolder } from '@configuration/infrastructure/skills/skill-file';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import type { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { SKILL_FILE } from '@work/application/contracts/run-spec.contract';
import { type SkillFile } from '@work/application/dto/ready-skill.dto';

interface Read {
  readonly folder?: SkillFolder;
  readonly problem?: ConfigurationProblem;
}

const readFolder = (
  name: string,
  files: readonly ConfigurationFile[],
): Read => {
  const within = `${SKILLS_UNDER}/${name}/`;
  const main = files.find((each) => each.path === `${within}${SKILL_FILE}`);
  const refused = (reason: string): Read => ({
    problem: ConfigurationProblem.of({
      path: main?.path ?? (files[0] as ConfigurationFile).path,
      at: 'the file',
      reason,
    }),
  });

  try {
    return {
      folder: readSkillFolder(
        name,
        files.map((each) => ({
          path: each.path.slice(within.length),
          text: each.text,
        })),
        'defined',
      ),
    };
  } catch (error) {
    if (error instanceof InvalidIdentifierError) {
      return refused(
        `is defined in a folder named ${JSON.stringify(name)}: name the folder in lowercase words joined by dashes, as in our-migrations`,
      );
    }
    if (error instanceof InvalidSkillError) {
      return refused(error.message);
    }
    throw error;
  }
};

export class TeamSkillFiles implements SkillReaderPort {
  folder(
    name: string,
    files: readonly SkillFile[],
    origin: SkillOrigin,
  ): SkillFolder {
    return readSkillFolder(name, files, origin);
  }

  read(files: readonly ConfigurationFile[]): ReadSkills {
    const folders = new Map<string, ConfigurationFile[]>();
    const problems: ConfigurationProblem[] = [];

    for (const file of files.filter((each) => each.isUnder(SKILLS_UNDER))) {
      const within = file.path.slice(SKILLS_UNDER.length + 1);
      const cut = within.indexOf('/');

      if (cut < 0) {
        problems.push(
          ConfigurationProblem.of({
            path: file.path,
            at: 'the file',
            reason: `sits in ${SKILLS_UNDER} itself, where no skill reads it: put it in the folder of the skill it belongs to`,
            severity: 'warning',
          }),
        );
        continue;
      }

      const name = within.slice(0, cut);
      folders.set(name, [...(folders.get(name) ?? []), file]);
    }

    const skills: SkillFolder[] = [];

    for (const name of [...folders.keys()].sort()) {
      const read = readFolder(name, folders.get(name) ?? []);

      if (read.folder) {
        skills.push(read.folder);
      }
      if (read.problem) {
        problems.push(read.problem);
      }
    }

    return { skills, problems };
  }
}

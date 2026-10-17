import type {
  ParsedSkills,
  SkillFile,
  SkillFolder,
  SkillOrigin,
  SkillReaderPort,
} from '@configuration/application/ports/skill-reader.port';
import { InvalidSkillError } from '@configuration/domain/exceptions/invalid-skill.error';
import type { ConfigurationFile } from '@configuration/domain/value-objects/configuration-file.vo';
import { SKILLS_UNDER } from '@configuration/infrastructure/configuration-files';
import { readSkillFolder } from '@configuration/infrastructure/skills/skill-file';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { SKILL_FILE } from '@work/application/contracts/run-spec.contract';

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
  const invalid = (reason: string): Read => ({
    problem: ConfigurationProblem.of({
      path: main?.path ?? (files[0] as ConfigurationFile).path,
      at: FieldPath.root(),
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
      return invalid(
        `is defined in a folder named ${JSON.stringify(name)}. Please name the folder in lowercase words joined by dashes, as in our-migrations`,
      );
    }
    if (error instanceof InvalidSkillError) {
      return invalid(error.message);
    }
    throw error;
  }
};

export class SkillFileParser implements SkillReaderPort {
  folder(
    name: string,
    files: readonly SkillFile[],
    origin: SkillOrigin,
  ): SkillFolder {
    return readSkillFolder(name, files, origin);
  }

  parse(files: readonly ConfigurationFile[]): ParsedSkills {
    const folders = new Map<string, ConfigurationFile[]>();
    const problems: ConfigurationProblem[] = [];

    for (const file of files.filter((each) => each.isUnder(SKILLS_UNDER))) {
      const within = file.path.slice(SKILLS_UNDER.length + 1);
      const cut = within.indexOf('/');

      if (cut < 0) {
        problems.push(
          ConfigurationProblem.of({
            path: file.path,
            at: FieldPath.root(),
            reason: `is outside any skill folder. Please move it into its skill's folder under ${SKILLS_UNDER}`,
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

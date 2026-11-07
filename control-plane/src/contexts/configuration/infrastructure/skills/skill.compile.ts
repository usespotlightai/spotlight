import type {
  SkillCompilerPort,
  SkillParseResult,
} from '@configuration/application/ports/skill-compiler.port';
import { SKILLS } from '@configuration/application/rendering/skill-problems';
import { SkillMainFileMissingError } from '@configuration/domain/exceptions/skill-main-file-missing.error';
import type { Skill } from '@configuration/domain/value-objects/skill.vo';
import {
  SkillFiles,
  skillFileProblem,
} from '@configuration/domain/value-objects/skill-files.vo';
import { SkillKey } from '@configuration/domain/value-objects/skill-key.vo';
import { readSkillFolder } from '@configuration/infrastructure/skills/skill-file';
import { madeBy, problemsIn } from '@platform/definitions/definition-schema';
import { SKILL_FILE } from '@work/application/contracts/run-spec.contract';
import { z } from 'zod';

const filePath = z.string().superRefine((path, context) => {
  const problem = skillFileProblem(path);

  if (problem) {
    context.addIssue({ code: 'custom', message: problem });
  }
});

const skillSchema = z.object({
  key: madeBy(SkillKey.of),
  files: z.record(filePath, z.string()),
});

const compileSkill = (input: unknown): SkillParseResult => {
  const read = skillSchema.safeParse(input);

  if (!read.success) {
    return { ok: false, problems: problemsIn(SKILLS, read.error) };
  }

  return {
    ok: true,
    key: SkillKey.of(read.data.key),
    files: SkillFiles.of(read.data.files),
  };
};

export class SkillCompiler implements SkillCompilerPort {
  compile(input: unknown): SkillParseResult {
    return compileSkill(input);
  }

  skillIn(key: SkillKey, files: SkillFiles): Skill {
    if (!(SKILL_FILE in files.fields)) {
      throw new SkillMainFileMissingError(key.value, SKILL_FILE);
    }

    return readSkillFolder(key.value, files.entries, 'defined').skill;
  }
}

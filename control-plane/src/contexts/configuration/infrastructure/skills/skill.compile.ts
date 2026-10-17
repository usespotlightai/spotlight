import type {
  SkillCompilerPort,
  SkillParseResult,
} from '@configuration/application/ports/skill-compiler.port';
import {
  SKILLS,
  skillAt,
} from '@configuration/application/rendering/skill-problems';
import { InvalidSkillError } from '@configuration/domain/exceptions/invalid-skill.error';
import { SkillKeyReservedError } from '@configuration/domain/exceptions/skill-key-reserved.error';
import {
  SkillFiles,
  skillFileProblem,
} from '@configuration/domain/value-objects/skill-files.vo';
import { SkillKey } from '@configuration/domain/value-objects/skill-key.vo';
import { readSkillFolder } from '@configuration/infrastructure/skills/skill-file';
import { madeBy, problemsIn } from '@platform/definitions/definition-schema';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
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

export const compileSkill = (input: unknown): SkillParseResult => {
  const read = skillSchema.safeParse(input);

  if (!read.success) {
    return { ok: false, problems: problemsIn(SKILLS, read.error) };
  }

  const { key, files } = read.data;
  const invalid = (at: FieldPath, reason: string): SkillParseResult => ({
    ok: false,
    problems: [ConfigurationProblem.of({ path: skillAt(key), at, reason })],
  });

  if (!(SKILL_FILE in files)) {
    return invalid(
      FieldPath.of(['files']),
      `has no ${SKILL_FILE}. Spotlight reads each skill from its ${SKILL_FILE}`,
    );
  }

  const folder = SkillFiles.of(files);

  try {
    return {
      ok: true,
      skill: readSkillFolder(key, folder.entries, 'defined').skill,
      files: folder,
    };
  } catch (error) {
    if (error instanceof SkillKeyReservedError) {
      return invalid(FieldPath.of([error.field]), error.because);
    }

    if (error instanceof InvalidSkillError) {
      return invalid(FieldPath.of(['files', SKILL_FILE]), error.because);
    }

    throw error;
  }
};

export class SkillCompiler implements SkillCompilerPort {
  compile(input: unknown): SkillParseResult {
    return compileSkill(input);
  }
}

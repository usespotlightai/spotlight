import type {
  CompiledSkill,
  SkillCompilerPort,
} from '@configuration/application/ports/skill-compiler.port';
import {
  SKILLS,
  skillAt,
} from '@configuration/application/rendering/skill-problems';
import { InvalidSkillError } from '@configuration/domain/exceptions/invalid-skill.error';
import { SkillKeyReservedError } from '@configuration/domain/exceptions/skill-key-reserved.error';
import {
  SkillFiles,
  skillFileRefusal,
} from '@configuration/domain/value-objects/skill-files.vo';
import { SkillKey } from '@configuration/domain/value-objects/skill-key.vo';
import { readSkillFolder } from '@configuration/infrastructure/skills/skill-file';
import { madeBy, problemsIn } from '@platform/definitions/definition-schema';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { SKILL_FILE } from '@work/application/contracts/run-spec.contract';
import { z } from 'zod';

const filePath = z.string().superRefine((path, context) => {
  const refused = skillFileRefusal(path);

  if (refused) {
    context.addIssue({ code: 'custom', message: refused });
  }
});

const skillSchema = z.object({
  key: madeBy(SkillKey.of),
  files: z.record(filePath, z.string()),
});

export const compileSkill = (held: unknown): CompiledSkill => {
  const read = skillSchema.safeParse(held);

  if (!read.success) {
    return { ok: false, problems: problemsIn(SKILLS, read.error) };
  }

  const { key, files } = read.data;
  const refused = (at: FieldPath, reason: string): CompiledSkill => ({
    ok: false,
    problems: [ConfigurationProblem.of({ path: skillAt(key), at, reason })],
  });

  if (!(SKILL_FILE in files)) {
    return refused(
      FieldPath.of(['files']),
      `holds no ${SKILL_FILE}. Spotlight reads each skill from its ${SKILL_FILE}`,
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
      return refused(FieldPath.of([error.field]), error.because);
    }

    if (error instanceof InvalidSkillError) {
      return refused(FieldPath.of(['files', SKILL_FILE]), error.because);
    }

    throw error;
  }
};

export class SkillCompiler implements SkillCompilerPort {
  compile(held: unknown): CompiledSkill {
    return compileSkill(held);
  }
}

import type {
  SkillFolder,
  SkillOrigin,
} from '@configuration/application/ports/skill-reader.port';
import {
  Skill,
  type SkillSecret,
} from '@configuration/domain/entities/skill.entity';
import { InvalidSkillError } from '@configuration/domain/exceptions/invalid-skill.error';
import { SkillKey } from '@configuration/domain/value-objects/skill-key.vo';
import { ToolName } from '@configuration/domain/value-objects/tool-name.vo';
import { splitFrontmatter } from '@platform/markdown/frontmatter';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import {
  SKILL_FILE,
  SKILL_FOLDER_LIMITS,
} from '@work/application/contracts/run-spec.contract';
import { type SkillFile } from '@work/application/dto/ready-skill.dto';
import { parse as parseYaml } from 'yaml';

const toolsIn = (key: SkillKey, raw: unknown): ToolName[] => {
  if (raw === undefined || raw === null) {
    return [];
  }

  if (!Array.isArray(raw)) {
    throw new InvalidSkillError(
      key.value,
      'lists its tools as something other than a list: write each as its integration and name, as in [grafana.search]',
    );
  }

  return raw.map((each) => {
    try {
      return ToolName.of(String(each));
    } catch {
      throw new InvalidSkillError(
        key.value,
        `lists a tool named ${JSON.stringify(each)}: name a tool as its integration and name, as in grafana.search`,
      );
    }
  });
};

const secretsIn = (key: SkillKey, raw: unknown): SkillSecret[] => {
  if (raw === undefined || raw === null) {
    return [];
  }

  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new InvalidSkillError(
      key.value,
      'lists its secrets as something other than a map: write each name with what it is for, as in GRAFANA_TOKEN: A read-only token its tools use',
    );
  }

  return Object.entries(raw).map(([name, description]) => {
    try {
      return {
        name: SecretName.of(name),
        description: typeof description === 'string' ? description.trim() : '',
      };
    } catch {
      throw new InvalidSkillError(
        key.value,
        `asks for a secret named ${JSON.stringify(name)}: name secrets in capitals, digits and underscores, as in GRAFANA_TOKEN`,
      );
    }
  });
};

const readSkill = (
  key: SkillKey,
  text: string,
  origin: SkillOrigin,
  files: readonly SkillFile[],
): Skill => {
  const matched = splitFrontmatter(text);

  if (!matched) {
    throw new InvalidSkillError(
      key.value,
      `opens with no frontmatter: start ${SKILL_FILE} with a --- line, its name and description, and another --- line`,
    );
  }

  let front: unknown;

  try {
    front = parseYaml(matched.front);
  } catch (error) {
    throw new InvalidSkillError(
      key.value,
      `has frontmatter that is not YAML: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const { name, description, secrets, tools } = (front ?? {}) as Record<
    string,
    unknown
  >;

  const input = {
    key,
    named: name,
    folder: {
      files: files.length,
      characters: files.reduce((sum, each) => sum + each.text.length, 0),
      limits: SKILL_FOLDER_LIMITS,
    },
    description: typeof description === 'string' ? description : '',
    instructions: matched.body,
    secrets: secretsIn(key, secrets),
    tools: toolsIn(key, tools),
  };

  return origin === 'defined' ? Skill.defined(input) : Skill.shipped(input);
};

export const readSkillFolder = (
  folder: string,
  files: readonly SkillFile[],
  origin: SkillOrigin,
): SkillFolder => {
  const key = SkillKey.of(folder);
  const main = files.find((each) => each.path === SKILL_FILE);

  if (!main) {
    throw new InvalidSkillError(
      folder,
      `has no ${SKILL_FILE} in ${folder}, which is what a skill is read from`,
    );
  }

  return { skill: readSkill(key, main.text, origin, files), files };
};

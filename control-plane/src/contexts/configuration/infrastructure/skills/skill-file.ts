import type {
  ReadSkillFolder,
  SkillFile,
  SkillOrigin,
} from '@configuration/application/ports/skill-folders.port';
import { InvalidSkillError } from '@configuration/domain/exceptions/invalid-skill.error';
import { DefinedSkillKey } from '@configuration/domain/value-objects/defined-skill-key.vo';
import {
  Skill,
  type SkillSecret,
} from '@configuration/domain/value-objects/skill.vo';
import { splitFrontmatter } from '@platform/markdown/frontmatter';
import {
  SKILL_FILE,
  SKILL_FOLDER_LIMITS,
} from '@runs/application/contracts/run-spec.contract';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { parse as parseYaml } from 'yaml';

const toolsIn = (key: DefinedSkillKey, raw: unknown): Tool[] => {
  if (raw === undefined || raw === null) {
    return [];
  }

  if (!Array.isArray(raw)) {
    throw new InvalidSkillError(
      key.value,
      'tools must be a list, as in [grafana.search]',
    );
  }

  return raw.map((each) => {
    try {
      return Tool.of(String(each));
    } catch {
      throw new InvalidSkillError(
        key.value,
        `tool ${JSON.stringify(each)} must be named integration.tool, as in grafana.search`,
      );
    }
  });
};

const secretsIn = (key: DefinedSkillKey, raw: unknown): SkillSecret[] => {
  if (raw === undefined || raw === null) {
    return [];
  }

  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new InvalidSkillError(
      key.value,
      'secrets must map each name to its purpose, as in GRAFANA_TOKEN: A read-only token',
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
        `secret ${JSON.stringify(name)} must use capitals, digits and underscores, as in GRAFANA_TOKEN`,
      );
    }
  });
};

const readSkill = (
  key: DefinedSkillKey,
  text: string,
  origin: SkillOrigin,
  files: readonly SkillFile[],
): Skill => {
  const matched = splitFrontmatter(text);

  if (!matched) {
    throw new InvalidSkillError(
      key.value,
      `needs a name and description between --- lines at the top of ${SKILL_FILE}`,
    );
  }

  let front: unknown;

  try {
    front = parseYaml(matched.front);
  } catch (error) {
    throw new InvalidSkillError(
      key.value,
      `has frontmatter that is not valid YAML (${error instanceof Error ? error.message : String(error)})`,
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

  return origin === 'defined' ? Skill.define(input) : Skill.builtIn(input);
};

export const readSkillFolder = (
  folder: string,
  files: readonly SkillFile[],
  origin: SkillOrigin,
): ReadSkillFolder => {
  const key = DefinedSkillKey.of(folder);
  const main = files.find((each) => each.path === SKILL_FILE);

  if (!main) {
    throw new InvalidSkillError(folder, `has no ${SKILL_FILE} in ${folder}`);
  }

  return { skill: readSkill(key, main.text, origin, files), files };
};

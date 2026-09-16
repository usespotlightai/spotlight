import { SKILL_FOLDER_LIMITS } from '@application/contracts/run-spec.contract';
import type {
  SkillFile,
  SkillFolder,
} from '@application/ports/skill-reader.port';
import { SKILL_FILE } from '@domain/aggregates/team-configuration.aggregate';
import { Skill, type SkillSecret } from '@domain/entities/skill.entity';
import { InvalidSkillError } from '@domain/exceptions/invalid-skill.error';
import { SecretName } from '@domain/value-objects/secret-name.vo';
import { SkillKey } from '@domain/value-objects/skill-key.vo';
import { Tool } from '@domain/value-objects/tool.vo';
import { splitFrontmatter } from '@infrastructure/markdown/frontmatter';
import { parse as parseYaml } from 'yaml';

type SkillOrigin = 'defined' | 'shipped';

const toolsIn = (key: SkillKey, raw: unknown): Tool[] => {
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
      return Tool.of(String(each));
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

const readSkill = (key: SkillKey, text: string, origin: SkillOrigin): Skill => {
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

  if (name !== key.value) {
    throw new InvalidSkillError(
      key.value,
      `is named ${JSON.stringify(name ?? null)} in its frontmatter, and must be named for its folder, ${key.value}`,
    );
  }

  const input = {
    key,
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

  if (files.length > SKILL_FOLDER_LIMITS.files) {
    throw new InvalidSkillError(
      folder,
      `holds more than ${SKILL_FOLDER_LIMITS.files} files in its folder, which is more than is given to a run`,
    );
  }

  if (
    files.reduce((sum, each) => sum + each.text.length, 0) >
    SKILL_FOLDER_LIMITS.characters
  ) {
    throw new InvalidSkillError(
      folder,
      `holds more than ${SKILL_FOLDER_LIMITS.characters} characters in its folder, which is more than is given to a run`,
    );
  }

  return { skill: readSkill(key, main.text, origin), files };
};

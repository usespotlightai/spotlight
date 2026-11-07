import { InvalidSkillError } from '@configuration/domain/exceptions/invalid-skill.error';
import { SkillKeyReservedError } from '@configuration/domain/exceptions/skill-key-reserved.error';
import type { DefinedSkillKey } from '@configuration/domain/value-objects/defined-skill-key.vo';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import type { Tool } from '@shared-kernel/domain/value-objects/tool.vo';

export interface SkillSecret {
  readonly name: SecretName;
  readonly description: string;
}

const SKILL_FOLDER_LIMITS = {
  files: 50,
  characters: 512 * 1024,
} as const;

interface SkillFolderSize {
  readonly files: number;
  readonly characters: number;
}

interface SkillInput {
  readonly key: DefinedSkillKey;
  readonly named?: unknown;
  readonly folder?: SkillFolderSize;
  readonly description: string;
  readonly instructions: string;
  readonly secrets: readonly SkillSecret[];
  readonly tools: readonly Tool[];
}

export class Skill {
  private constructor(
    readonly key: DefinedSkillKey,
    readonly description: string,
    readonly instructions: string,
    readonly secrets: readonly SkillSecret[],
    readonly tools: readonly Tool[],
    readonly isBuiltIn: boolean,
  ) {}

  static define(input: SkillInput): Skill {
    if (input.key.isReserved) {
      throw new SkillKeyReservedError(input.key.value);
    }

    return Skill.make(input, false);
  }

  static builtIn(input: SkillInput): Skill {
    if (!input.key.isReserved) {
      throw new InvalidSkillError(
        input.key.value,
        'is built in and must start with spotlight-',
      );
    }

    return Skill.make(input, true);
  }

  private static make(input: SkillInput, isBuiltIn: boolean): Skill {
    const description = input.description.trim();
    const instructions = input.instructions.trim();
    const folder = input.folder;
    const catalogued = input.tools.find((each) => each.origin === 'catalog');

    if (catalogued) {
      throw new InvalidSkillError(
        input.key.value,
        `tool ${JSON.stringify(catalogued.value)} must be named integration.tool, as in grafana.search`,
      );
    }

    if (folder && folder.files > SKILL_FOLDER_LIMITS.files) {
      throw new InvalidSkillError(
        input.key.value,
        `has more than ${SKILL_FOLDER_LIMITS.files} files in its folder`,
      );
    }

    if (folder && folder.characters > SKILL_FOLDER_LIMITS.characters) {
      throw new InvalidSkillError(
        input.key.value,
        `has more than ${SKILL_FOLDER_LIMITS.characters} characters in its folder`,
      );
    }

    if ('named' in input && input.named !== input.key.value) {
      throw new InvalidSkillError(
        input.key.value,
        `must be named ${input.key.value} in its frontmatter, not ${JSON.stringify(input.named ?? null)}`,
      );
    }

    if (description.length === 0) {
      throw new InvalidSkillError(input.key.value, 'needs a description');
    }

    if (instructions.length === 0) {
      throw new InvalidSkillError(
        input.key.value,
        'needs instructions below its frontmatter',
      );
    }

    return new Skill(
      input.key,
      description,
      instructions,
      input.secrets,
      input.tools,
      isBuiltIn,
    );
  }

  missingFrom(existing: readonly SecretName[]): readonly SkillSecret[] {
    return this.secrets.filter(
      (needed) => !existing.some((each) => each.equals(needed.name)),
    );
  }

  isReadyWith(existing: readonly SecretName[]): boolean {
    return this.missingFrom(existing).length === 0;
  }

  equals(other: Skill): boolean {
    return this.key.equals(other.key);
  }
}

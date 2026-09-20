import { InvalidSkillError } from '@configuration/domain/exceptions/invalid-skill.error';
import type { SkillKey } from '@configuration/domain/value-objects/skill-key.vo';
import type { ToolName } from '@configuration/domain/value-objects/tool-name.vo';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

export interface SkillSecret {
  readonly name: SecretName;
  readonly description: string;
}

interface SkillFolderLimits {
  readonly files: number;
  readonly characters: number;
}

interface SkillFolderSize {
  readonly files: number;
  readonly characters: number;
  readonly limits: SkillFolderLimits;
}

interface SkillInput {
  readonly key: SkillKey;
  readonly named?: unknown;
  readonly folder?: SkillFolderSize;
  readonly description: string;
  readonly instructions: string;
  readonly secrets?: readonly SkillSecret[];
  readonly tools?: readonly ToolName[];
}

export class Skill {
  private constructor(
    readonly key: SkillKey,
    readonly description: string,
    readonly instructions: string,
    readonly secrets: readonly SkillSecret[],
    readonly tools: readonly ToolName[],
  ) {}

  static defined(input: SkillInput): Skill {
    if (input.key.isSpotlights) {
      throw new InvalidSkillError(
        input.key.value,
        "is named as Spotlight names its own, and a name starting spotlight- is Spotlight's own: name it without spotlight-",
      );
    }

    return Skill.made(input);
  }

  static shipped(input: SkillInput): Skill {
    if (!input.key.isSpotlights) {
      throw new InvalidSkillError(
        input.key.value,
        'ships with Spotlight, so its name starts spotlight-',
      );
    }

    return Skill.made(input);
  }

  private static made(input: SkillInput): Skill {
    const description = input.description.trim();
    const instructions = input.instructions.trim();
    const folder = input.folder;

    if (folder && folder.files > folder.limits.files) {
      throw new InvalidSkillError(
        input.key.value,
        `holds more than ${folder.limits.files} files in its folder, which is more than is given to a run`,
      );
    }

    if (folder && folder.characters > folder.limits.characters) {
      throw new InvalidSkillError(
        input.key.value,
        `holds more than ${folder.limits.characters} characters in its folder, which is more than is given to a run`,
      );
    }

    if ('named' in input && input.named !== input.key.value) {
      throw new InvalidSkillError(
        input.key.value,
        `is named ${JSON.stringify(input.named ?? null)} in its frontmatter, and must be named for its folder, ${input.key.value}`,
      );
    }

    if (description.length === 0) {
      throw new InvalidSkillError(
        input.key.value,
        'says nothing about when to use it: give it a description',
      );
    }

    if (instructions.length === 0) {
      throw new InvalidSkillError(
        input.key.value,
        'has nothing to say: write its instructions below the frontmatter',
      );
    }

    return new Skill(
      input.key,
      description,
      instructions,
      input.secrets ?? [],
      input.tools ?? [],
    );
  }

  missingFrom(held: readonly SecretName[]): readonly SkillSecret[] {
    return this.secrets.filter(
      (needed) => !held.some((each) => each.equals(needed.name)),
    );
  }

  isReadyWith(held: readonly SecretName[]): boolean {
    return this.missingFrom(held).length === 0;
  }

  equals(other: Skill): boolean {
    return this.key.equals(other.key);
  }
}

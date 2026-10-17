import { InvalidSkillError } from '@configuration/domain/exceptions/invalid-skill.error';
import { SkillKeyReservedError } from '@configuration/domain/exceptions/skill-key-reserved.error';
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
  readonly secrets: readonly SkillSecret[];
  readonly tools: readonly ToolName[];
}

export class Skill {
  private constructor(
    readonly key: SkillKey,
    readonly description: string,
    readonly instructions: string,
    readonly secrets: readonly SkillSecret[],
    readonly tools: readonly ToolName[],
    readonly isShipped: boolean,
  ) {}

  static define(input: SkillInput): Skill {
    if (input.key.isSpotlights) {
      throw new SkillKeyReservedError(input.key.value);
    }

    return Skill.make(input, false);
  }

  static ship(input: SkillInput): Skill {
    if (!input.key.isSpotlights) {
      throw new InvalidSkillError(
        input.key.value,
        'is built in and must start with spotlight-',
      );
    }

    return Skill.make(input, true);
  }

  private static make(input: SkillInput, isShipped: boolean): Skill {
    const description = input.description.trim();
    const instructions = input.instructions.trim();
    const folder = input.folder;

    if (folder && folder.files > folder.limits.files) {
      throw new InvalidSkillError(
        input.key.value,
        `has more than ${folder.limits.files} files in its folder`,
      );
    }

    if (folder && folder.characters > folder.limits.characters) {
      throw new InvalidSkillError(
        input.key.value,
        `has more than ${folder.limits.characters} characters in its folder`,
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
      isShipped,
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

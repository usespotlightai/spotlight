import { InvalidSkillError } from '@domain/exceptions/invalid-skill.error';
import type { SecretName } from '@domain/value-objects/secret-name.vo';
import type { SkillKey } from '@domain/value-objects/skill-key.vo';
import type { Tool } from '@domain/value-objects/tool.vo';

export interface SkillSecret {
  readonly name: SecretName;
  readonly description: string;
}

interface SkillInput {
  readonly key: SkillKey;
  readonly description: string;
  readonly instructions: string;
  readonly secrets?: readonly SkillSecret[];
  readonly tools?: readonly Tool[];
}

export class Skill {
  private constructor(
    readonly key: SkillKey,
    readonly description: string,
    readonly instructions: string,
    readonly secrets: readonly SkillSecret[],
    readonly tools: readonly Tool[],
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

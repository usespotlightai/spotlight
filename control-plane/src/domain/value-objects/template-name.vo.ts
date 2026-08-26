import { InvalidTemplateNameError } from '@domain/exceptions/invalid-template-name.error';

const MAX_LENGTH = 100;

export class TemplateName {
  private constructor(readonly value: string) {}

  static of(raw: string): TemplateName {
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      throw new InvalidTemplateNameError('must not be empty');
    }
    if (trimmed.length > MAX_LENGTH) {
      throw new InvalidTemplateNameError(
        `must be at most ${MAX_LENGTH} characters`,
      );
    }

    return new TemplateName(trimmed);
  }

  equals(other: TemplateName): boolean {
    return this.value === other.value;
  }
}

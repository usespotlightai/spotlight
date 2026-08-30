import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';

export class TemplateId {
  private readonly kind = 'template';

  private constructor(readonly value: string) {}

  static of(value: string): TemplateId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('template');
    }
    return new TemplateId(value);
  }

  equals(other: TemplateId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

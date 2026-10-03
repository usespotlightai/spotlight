import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class NoticeId {
  private readonly kind = 'notice';

  private constructor(readonly value: string) {}

  static of(value: string): NoticeId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('notice');
    }
    return new NoticeId(value);
  }

  equals(other: NoticeId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

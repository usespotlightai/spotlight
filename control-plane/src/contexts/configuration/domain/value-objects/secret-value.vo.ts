import {
  SECRET,
  type Secret,
} from '@shared-kernel/domain/value-objects/secret';

export class SecretValue implements Secret {
  get [SECRET](): true {
    return true;
  }

  private constructor(readonly value: string) {}

  static maybe(raw: string): SecretValue | null {
    return raw.trim().length === 0 ? null : new SecretValue(raw);
  }

  toString(): string {
    return '[secret]';
  }

  toJSON(): string {
    return '[secret]';
  }
}

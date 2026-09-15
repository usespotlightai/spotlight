export class SecretValue {
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

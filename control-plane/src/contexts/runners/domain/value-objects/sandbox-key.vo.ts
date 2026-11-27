import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class SandboxKey {
  private readonly kind = 'sandbox-key';

  private constructor(readonly value: string) {}

  static of(raw: string): SandboxKey {
    const key = raw.trim();

    if (key.length === 0) {
      throw new InvalidIdentifierError('sandbox key');
    }

    return new SandboxKey(key);
  }

  equals(other: SandboxKey): boolean {
    return other instanceof SandboxKey && this.value === other.value;
  }
}

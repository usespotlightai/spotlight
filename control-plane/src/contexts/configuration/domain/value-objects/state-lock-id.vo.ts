import { InvalidTerraformStateError } from '@configuration/domain/exceptions/invalid-terraform-state.error';

const MAX_LENGTH = 256;

export class StateLockId {
  private readonly kind = 'state-lock-id';

  private constructor(readonly value: string) {}

  static of(raw: unknown): StateLockId {
    if (
      typeof raw !== 'string' ||
      raw.trim().length === 0 ||
      raw.length > MAX_LENGTH
    ) {
      throw new InvalidTerraformStateError(
        `lock must have an ID of 1 to ${MAX_LENGTH} characters`,
      );
    }

    return new StateLockId(raw);
  }

  static in(info: unknown): StateLockId {
    if (typeof info !== 'object' || info === null || Array.isArray(info)) {
      throw new InvalidTerraformStateError('lock must be a JSON object');
    }

    return StateLockId.of((info as Readonly<Record<string, unknown>>).ID);
  }

  equals(other: StateLockId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export class AvatarImageId {
  private readonly kind = 'avatar-image-id' as const;

  private constructor(readonly value: string) {}

  static of(value: string): AvatarImageId {
    if (!UUID.test(value)) {
      throw new InconsistentStateError(
        'avatar image',
        `has an impossible id (${value})`,
      );
    }

    return new AvatarImageId(value);
  }

  equals(other: AvatarImageId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }
}

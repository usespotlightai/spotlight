import { AvatarImageId } from '@identity/domain/value-objects/avatar-image-id.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { describe, expect, it } from 'vitest';

describe('AvatarImageId', () => {
  it('takes a UUID', () => {
    const id = '6f1d2c3b-4a59-4e8d-9c7b-1a2b3c4d5e6f';

    expect(AvatarImageId.of(id).equals(AvatarImageId.of(id))).toBe(true);
  });

  it.each(['', 'not-a-uuid', '../6f1d2c3b-4a59-4e8d-9c7b-1a2b3c4d5e6f'])(
    'refuses %j',
    (value) => {
      expect(() => AvatarImageId.of(value)).toThrow(InconsistentStateError);
    },
  );
});

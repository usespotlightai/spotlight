import { InvalidAvatarError } from '@identity/domain/exceptions/invalid-avatar.error';
import {
  AvatarImage,
  MAX_AVATAR_BYTES,
} from '@identity/domain/value-objects/avatar-image.vo';
import { describe, expect, it } from 'vitest';

const PNG = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0);
const WEBP = new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ');

describe('AvatarImage', () => {
  it('takes a PNG or WebP image', () => {
    expect(AvatarImage.of(PNG, 'image/png').contentType).toBe('image/png');
    expect(AvatarImage.of(WEBP, 'image/webp').contentType).toBe('image/webp');
  });

  it('refuses SVG, which could carry script', () => {
    expect(() =>
      AvatarImage.of(new TextEncoder().encode('<svg/>'), 'image/svg+xml'),
    ).toThrow(InvalidAvatarError);
  });

  it('refuses bytes that are not the image they claim to be', () => {
    expect(() => AvatarImage.of(PNG, 'image/jpeg')).toThrow(
      'Avatar is not an image of type image/jpeg.',
    );
  });

  it('refuses an empty or too large image', () => {
    expect(() => AvatarImage.of(new Uint8Array(), 'image/png')).toThrow(
      'Avatar must not be empty.',
    );

    const large = new Uint8Array(MAX_AVATAR_BYTES + 1);
    large.set(PNG);

    expect(() => AvatarImage.of(large, 'image/png')).toThrow(
      'Avatar must be at most 512 KB.',
    );
  });
});

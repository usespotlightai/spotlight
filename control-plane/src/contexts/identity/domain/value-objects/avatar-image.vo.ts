import { InvalidAvatarError } from '@identity/domain/exceptions/invalid-avatar.error';

export const AVATAR_CONTENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const;

export type AvatarContentType = (typeof AVATAR_CONTENT_TYPES)[number];

export const MAX_AVATAR_BYTES = 512 * 1024;

const startsWith = (bytes: Uint8Array, signature: readonly number[], at = 0) =>
  signature.every((byte, index) => bytes[at + index] === byte);

const ascii = (text: string): number[] =>
  Array.from({ length: text.length }, (_, index) => text.charCodeAt(index));

const SIGNATURES: Record<AvatarContentType, (bytes: Uint8Array) => boolean> = {
  'image/png': (bytes) =>
    startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  'image/jpeg': (bytes) => startsWith(bytes, [0xff, 0xd8, 0xff]),
  'image/webp': (bytes) =>
    startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8),
  'image/gif': (bytes) =>
    startsWith(bytes, ascii('GIF87a')) || startsWith(bytes, ascii('GIF89a')),
};

export const isAvatarContentType = (raw: string): raw is AvatarContentType =>
  (AVATAR_CONTENT_TYPES as readonly string[]).includes(raw);

export class AvatarImage {
  private constructor(
    readonly bytes: Uint8Array,
    readonly contentType: AvatarContentType,
  ) {}

  static of(bytes: Uint8Array, contentType: string): AvatarImage {
    if (!isAvatarContentType(contentType)) {
      throw new InvalidAvatarError(
        `must be one of ${AVATAR_CONTENT_TYPES.join(', ')}, not ${contentType || 'an unnamed type'}`,
      );
    }
    if (bytes.length === 0) {
      throw new InvalidAvatarError('must not be empty');
    }
    if (bytes.length > MAX_AVATAR_BYTES) {
      throw new InvalidAvatarError(
        `must be at most ${MAX_AVATAR_BYTES / 1024} KB`,
      );
    }
    if (!SIGNATURES[contentType](bytes)) {
      throw new InvalidAvatarError(`is not an image of type ${contentType}`);
    }

    return new AvatarImage(bytes, contentType);
  }
}

import type { AvatarContentType } from '@identity/domain/value-objects/avatar-image.vo';

export interface AvatarImageDto {
  readonly bytes: Uint8Array;
  readonly contentType: AvatarContentType;
}

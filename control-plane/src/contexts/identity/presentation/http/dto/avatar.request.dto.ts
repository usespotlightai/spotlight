import {
  AVATAR_CONTENT_TYPES,
  MAX_AVATAR_BYTES,
} from '@identity/domain/value-objects/avatar-image.vo';
import { ApiProperty } from '@nestjs/swagger';

export class SetAvatarRequestDto {
  @ApiProperty({
    description: 'What kind of image the bytes are.',
    enum: AVATAR_CONTENT_TYPES,
    example: 'image/webp',
  })
  readonly contentType!: string;

  @ApiProperty({
    description: `The image, base64-encoded, at most ${MAX_AVATAR_BYTES / 1024} KB once decoded.`,
    format: 'byte',
  })
  readonly data!: string;
}

import type { AvatarImageDto } from '@identity/application/dto/avatar-image.dto';
import { StreamableFile } from '@nestjs/common';
import { ProblemException } from '@platform/http/resources/problem.exception';

export const AVATAR = 'avatar';

export const AVATAR_CACHE = 'private, max-age=31536000, immutable';

export const avatarImageResponse = (
  content: AvatarImageDto | null,
): StreamableFile => {
  if (!content) {
    throw ProblemException.notFound(AVATAR);
  }

  return new StreamableFile(content.bytes, {
    type: content.contentType,
    length: content.bytes.byteLength,
  });
};

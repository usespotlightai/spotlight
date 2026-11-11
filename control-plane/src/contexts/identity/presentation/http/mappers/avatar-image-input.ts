import type { AvatarImageInput } from '@identity/application/commands/avatar.commands';
import type { SetAvatarRequestDto } from '@identity/presentation/http/dto/avatar.request.dto';
import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '@platform/http/resources/problem.exception';

const BASE64 =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

const decoded = (data: unknown): Uint8Array => {
  if (typeof data !== 'string' || !BASE64.test(data)) {
    throw ProblemException.withStatus(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'data: must be base64',
    );
  }

  return Buffer.from(data, 'base64');
};

export const avatarImageInput = (
  body: SetAvatarRequestDto,
): AvatarImageInput => ({
  bytes: decoded(body.data),
  contentType: typeof body.contentType === 'string' ? body.contentType : '',
});

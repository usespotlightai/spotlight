import type { AvatarImageInput } from '@identity/application/commands/avatar.commands';
import type { SetAvatarRequestDto } from '@identity/presentation/http/dto/avatar.request.dto';

export const avatarImageInput = (
  body: SetAvatarRequestDto,
): AvatarImageInput => ({
  bytes: Buffer.from(typeof body.data === 'string' ? body.data : '', 'base64'),
  contentType: typeof body.contentType === 'string' ? body.contentType : '',
});

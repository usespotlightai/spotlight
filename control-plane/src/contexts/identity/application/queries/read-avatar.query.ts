import type { AvatarOf } from '@identity/application/dto/avatar-of.dto';

export class ReadAvatarQuery {
  constructor(
    readonly of: AvatarOf,
    readonly digest: string,
    readonly viewerId: string,
  ) {}
}

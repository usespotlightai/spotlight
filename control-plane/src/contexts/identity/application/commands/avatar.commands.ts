import type { AvatarOf } from '@identity/application/dto/avatar-of.dto';
import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

export interface AvatarImageInput {
  readonly bytes: Uint8Array;
  readonly contentType: string;
}

export class SetAvatarCommand {
  constructor(
    readonly of: AvatarOf,
    readonly image: AvatarImageInput,
    readonly actor: Actor,
  ) {}
}

export class RemoveAvatarCommand {
  constructor(
    readonly of: AvatarOf,
    readonly actor: Actor,
  ) {}
}

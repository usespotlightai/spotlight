import type { AvatarDigest } from '@identity/domain/value-objects/avatar-digest.vo';
import type { AvatarImageId } from '@identity/domain/value-objects/avatar-image-id.vo';
import type { AvatarOwner } from '@identity/domain/value-objects/avatar-owner.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';

export class AvatarRemoved implements DomainEvent {
  readonly kind = 'avatar.removed';

  constructor(
    readonly owner: AvatarOwner,
    readonly previous: AvatarDigest,
    readonly previousImage: AvatarImageId,
  ) {}
}

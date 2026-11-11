import type { AvatarDigest } from '@identity/domain/value-objects/avatar-digest.vo';
import type { AvatarOwner } from '@identity/domain/value-objects/avatar-owner.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';

export class AvatarSet implements DomainEvent {
  readonly kind = 'avatar.set';

  constructor(
    readonly owner: AvatarOwner,
    readonly digest: AvatarDigest,
  ) {}
}

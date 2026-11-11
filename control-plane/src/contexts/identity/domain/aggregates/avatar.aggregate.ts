import { AvatarRemoved } from '@identity/domain/events/avatar-removed.event';
import { AvatarReplaced } from '@identity/domain/events/avatar-replaced.event';
import { AvatarSet } from '@identity/domain/events/avatar-set.event';
import type { AvatarDigest } from '@identity/domain/value-objects/avatar-digest.vo';
import type { AvatarImageId } from '@identity/domain/value-objects/avatar-image-id.vo';
import type { AvatarOwner } from '@identity/domain/value-objects/avatar-owner.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export class Avatar extends EventRecorder {
  private constructor(
    readonly owner: AvatarOwner,
    readonly digest: AvatarDigest,
    readonly image: AvatarImageId,
    readonly version: number,
    readonly isRemoved: boolean,
  ) {
    super();
  }

  static create(
    owner: AvatarOwner,
    digest: AvatarDigest,
    image: AvatarImageId,
  ): Avatar {
    const created = new Avatar(owner, digest, image, 0, false);
    created.record(new AvatarSet(owner, digest));

    return created;
  }

  static rehydrate(input: {
    owner: AvatarOwner;
    digest: AvatarDigest;
    image: AvatarImageId;
    version: number;
  }): Avatar {
    if (!Number.isInteger(input.version) || input.version < 0) {
      throw new InconsistentStateError(
        'avatar',
        `has an impossible version (${input.version})`,
      );
    }

    return new Avatar(
      input.owner,
      input.digest,
      input.image,
      input.version,
      false,
    );
  }

  shows(digest: AvatarDigest): boolean {
    return !this.isRemoved && this.digest.equals(digest);
  }

  replacedWith(digest: AvatarDigest, image: AvatarImageId): Avatar {
    this.assertNotRemoved();

    if (this.digest.equals(digest)) {
      throw new InconsistentStateError(
        'avatar',
        'was replaced with the image it shows',
      );
    }

    const replaced = new Avatar(this.owner, digest, image, this.version, false);
    replaced.inheritEvents(this);
    replaced.record(
      new AvatarReplaced(this.owner, digest, this.digest, this.image),
    );

    return replaced;
  }

  removed(): Avatar {
    this.assertNotRemoved();

    const removed = new Avatar(
      this.owner,
      this.digest,
      this.image,
      this.version,
      true,
    );
    removed.inheritEvents(this);
    removed.record(new AvatarRemoved(this.owner, this.digest, this.image));

    return removed;
  }

  private assertNotRemoved(): void {
    if (this.isRemoved) {
      throw new InconsistentStateError(
        'avatar',
        'was changed after it was removed',
      );
    }
  }
}

import type { AvatarImageDto } from '@identity/application/dto/avatar-image.dto';
import type { AvatarImagesPort } from '@identity/application/ports/avatar-images.port';
import type { ReadAvatarQuery } from '@identity/application/queries/read-avatar.query';
import type { AvatarOwners } from '@identity/application/services/avatar-owners.service';
import type { AvatarRepository } from '@identity/domain/repositories/avatar.repository';
import { AvatarDigest } from '@identity/domain/value-objects/avatar-digest.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { PersonPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class ReadAvatarHandler implements QueryHandlerPort<
  ReadAvatarQuery,
  AvatarImageDto | null
> {
  constructor(
    private readonly owners: AvatarOwners,
    private readonly avatars: AvatarRepository,
    private readonly images: AvatarImagesPort,
  ) {}

  async execute(query: ReadAvatarQuery): Promise<AvatarImageDto | null> {
    try {
      const digest = AvatarDigest.parsed(query.digest);
      const owned = digest
        ? await this.owners.of(
            query.of,
            PersonPrincipal.of(UserId.of(query.viewerId)),
          )
        : null;
      const avatar = owned ? await this.avatars.find(owned.owner) : null;

      return digest && avatar?.shows(digest)
        ? await this.images.read(avatar.owner, avatar.image)
        : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}

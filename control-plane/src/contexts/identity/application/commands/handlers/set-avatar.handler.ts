import type { SetAvatarCommand } from '@identity/application/commands/avatar.commands';
import type { AvatarSetDto } from '@identity/application/dto/avatar-set.dto';
import type { AvatarImagesPort } from '@identity/application/ports/avatar-images.port';
import type { ContentHashPort } from '@identity/application/ports/content-hash.port';
import type { AvatarOwners } from '@identity/application/services/avatar-owners.service';
import { Avatar } from '@identity/domain/aggregates/avatar.aggregate';
import type { AvatarRepository } from '@identity/domain/repositories/avatar.repository';
import { AvatarDigest } from '@identity/domain/value-objects/avatar-digest.vo';
import { AvatarImageId } from '@identity/domain/value-objects/avatar-image-id.vo';
import { AvatarImage } from '@identity/domain/value-objects/avatar-image.vo';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

export class SetAvatarHandler implements CommandHandlerPort<
  SetAvatarCommand,
  AvatarSetDto | null
> {
  constructor(
    private readonly owners: AvatarOwners,
    private readonly avatars: AvatarRepository,
    private readonly images: AvatarImagesPort,
    private readonly hash: ContentHashPort,
    private readonly ids: IdGeneratorPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: SetAvatarCommand): Promise<AvatarSetDto | null> {
    try {
      const owned = await this.owners.of(command.of, command.actor.principal);

      if (!owned) {
        return null;
      }

      if (!owned.permissions.configures) {
        return forbiddenTo('configure');
      }

      const image = AvatarImage.of(
        command.image.bytes,
        command.image.contentType,
      );
      const digest = AvatarDigest.of(this.hash.sha256(image.bytes));
      const existing = await this.avatars.find(owned.owner);

      if (existing?.shows(digest)) {
        return { outcome: 'set', digest: digest.value };
      }

      const imageId = AvatarImageId.of(this.ids.generate());
      const next = existing
        ? existing.replacedWith(digest, imageId)
        : Avatar.create(owned.owner, digest, imageId);

      await this.images.put(owned.owner, imageId, image);

      try {
        await this.transaction.inTransaction(() =>
          existing ? this.avatars.save(next) : this.avatars.add(next),
        );
      } catch (error) {
        await this.images.remove(owned.owner, imageId);
        throw error;
      }

      return { outcome: 'set', digest: digest.value };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}

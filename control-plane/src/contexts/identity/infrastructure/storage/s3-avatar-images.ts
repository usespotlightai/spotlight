import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import type { AvatarImageDto } from '@identity/application/dto/avatar-image.dto';
import type { AvatarImagesPort } from '@identity/application/ports/avatar-images.port';
import type { AvatarImageId } from '@identity/domain/value-objects/avatar-image-id.vo';
import {
  type AvatarImage,
  isAvatarContentType,
} from '@identity/domain/value-objects/avatar-image.vo';
import type { AvatarOwner } from '@identity/domain/value-objects/avatar-owner.vo';
import type { KeyOverlay } from '@platform/storage/key-overlay';
import type { S3Clients } from '@platform/storage/s3-clients';
import { missing } from '@platform/storage/s3-objects';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const prefixIn = (workspaceId: WorkspaceId): string =>
  `workspaces/${workspaceId.value}/avatars/`;

const prefixOfTeam = (workspaceId: WorkspaceId, teamId: TeamId): string =>
  `${prefixIn(workspaceId)}teams/${teamId.value}/`;

const prefixOf = (owner: AvatarOwner): string =>
  owner.teamId
    ? prefixOfTeam(owner.workspaceId, owner.teamId)
    : `${prefixIn(owner.workspaceId)}workspace/`;

const keyOf = (owner: AvatarOwner, id: AvatarImageId): string =>
  `${prefixOf(owner)}${id.value}`;

export class S3AvatarImages implements AvatarImagesPort {
  private readonly store: S3Client;
  private readonly bucket: string;
  private readonly keys: KeyOverlay;

  constructor(clients: S3Clients) {
    this.store = clients.store;
    this.bucket = clients.bucket;
    this.keys = clients.keys;
  }

  async put(
    owner: AvatarOwner,
    id: AvatarImageId,
    image: AvatarImage,
  ): Promise<void> {
    await this.store.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.keys.writeKey(keyOf(owner, id)),
        Body: image.bytes,
        ContentType: image.contentType,
      }),
    );
  }

  async read(
    owner: AvatarOwner,
    id: AvatarImageId,
  ): Promise<AvatarImageDto | null> {
    for (const key of this.keys.readKeys(keyOf(owner, id))) {
      const object = await this.store
        .send(new GetObjectCommand({ Bucket: this.bucket, Key: key }))
        .catch(missing);

      if (object?.Body) {
        const contentType = object.ContentType ?? '';

        if (!isAvatarContentType(contentType)) {
          throw new InconsistentStateError(
            'avatar image',
            `is stored as ${contentType || 'an unnamed type'}`,
          );
        }

        return {
          bytes: await object.Body.transformToByteArray(),
          contentType,
        };
      }
    }

    return null;
  }

  async remove(owner: AvatarOwner, id: AvatarImageId): Promise<void> {
    await this.store.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: this.keys.writeKey(keyOf(owner, id)),
      }),
    );
  }

  removeAllOfTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    return this.removeUnder(prefixOfTeam(workspaceId, teamId));
  }

  removeAllIn(workspaceId: WorkspaceId): Promise<void> {
    return this.removeUnder(prefixIn(workspaceId));
  }

  private async removeUnder(prefix: string): Promise<void> {
    let token: string | undefined;

    do {
      const listed = await this.store.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: this.keys.writeKey(prefix),
          ContinuationToken: token,
        }),
      );
      const keys = (listed.Contents ?? []).flatMap(({ Key }) =>
        Key ? [{ Key }] : [],
      );

      if (keys.length > 0) {
        await this.store.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: keys, Quiet: true },
          }),
        );
      }

      token = listed.IsTruncated ? listed.NextContinuationToken : undefined;
    } while (token);
  }
}

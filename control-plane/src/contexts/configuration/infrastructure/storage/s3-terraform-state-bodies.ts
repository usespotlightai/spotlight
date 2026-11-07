import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import type {
  StateBodyAt,
  TerraformStateBodiesPort,
} from '@configuration/application/ports/terraform-state-bodies.port';
import type { S3Clients } from '@platform/storage/s3-clients';
import { missing } from '@platform/storage/s3-clients';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const CONTENT_TYPE = 'application/json';

const prefixOf = (workspaceId: WorkspaceId): string =>
  `workspaces/${workspaceId.value}/terraform-states/`;

const keyOf = (at: StateBodyAt): string =>
  `${prefixOf(at.workspaceId)}${at.stateId.value}/${at.versionId.value}.tfstate`;

export class S3TerraformStateBodies implements TerraformStateBodiesPort {
  private readonly store: S3Client;
  private readonly bucket: string;

  constructor(clients: S3Clients) {
    this.store = clients.store;
    this.bucket = clients.bucket;
  }

  async put(at: StateBodyAt, body: Uint8Array, md5: string): Promise<void> {
    await this.store.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: keyOf(at),
        Body: body,
        ContentType: CONTENT_TYPE,
        ContentMD5: Buffer.from(md5, 'hex').toString('base64'),
      }),
    );
  }

  async read(at: StateBodyAt): Promise<Uint8Array | null> {
    const object = await this.store
      .send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: keyOf(at),
        }),
      )
      .catch(missing);

    return object?.Body ? object.Body.transformToByteArray() : null;
  }

  async remove(at: readonly StateBodyAt[]): Promise<void> {
    if (at.length === 0) {
      return;
    }

    await this.store.send(
      new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: {
          Objects: at.map((each) => ({ Key: keyOf(each) })),
          Quiet: true,
        },
      }),
    );
  }

  async removeForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    let token: string | undefined;

    do {
      const listed = await this.store.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefixOf(workspaceId),
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

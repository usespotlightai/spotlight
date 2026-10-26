import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import type { TerraformStateBodiesPort } from '@configuration/application/ports/terraform-state-bodies.port';
import type { TerraformState } from '@configuration/domain/aggregates/terraform-state.aggregate';
import type { StateVersion } from '@configuration/domain/value-objects/state-version.vo';
import type { S3Clients } from '@platform/storage/s3-clients';
import { missing } from '@platform/storage/s3-clients';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const CONTENT_TYPE = 'application/json';

const prefixOf = (workspaceId: WorkspaceId): string =>
  `workspaces/${workspaceId.value}/terraform-states/`;

const keyOf = (state: TerraformState, version: StateVersion): string =>
  `${prefixOf(state.workspaceId)}${state.id.value}/${version.id.value}.tfstate`;

export class S3TerraformStateBodies implements TerraformStateBodiesPort {
  private readonly store: S3Client;
  private readonly bucket: string;

  constructor(clients: S3Clients) {
    this.store = clients.store;
    this.bucket = clients.bucket;
  }

  async put(
    state: TerraformState,
    version: StateVersion,
    body: Uint8Array,
  ): Promise<void> {
    await this.store.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: keyOf(state, version),
        Body: body,
        ContentType: CONTENT_TYPE,
        ContentMD5: Buffer.from(version.snapshot.md5, 'hex').toString('base64'),
      }),
    );
  }

  async read(
    state: TerraformState,
    version: StateVersion,
  ): Promise<Uint8Array | null> {
    const object = await this.store
      .send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: keyOf(state, version),
        }),
      )
      .catch(missing);

    return object?.Body ? object.Body.transformToByteArray() : null;
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

import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { AvatarImageId } from '@identity/domain/value-objects/avatar-image-id.vo';
import { AvatarImage } from '@identity/domain/value-objects/avatar-image.vo';
import { AvatarOwner } from '@identity/domain/value-objects/avatar-owner.vo';
import { S3AvatarImages } from '@identity/infrastructure/storage/s3-avatar-images';
import { KeyOverlay } from '@platform/storage/key-overlay';
import type { S3Clients } from '@platform/storage/s3-clients';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const PAGE = 1000;
const WORKSPACE = WorkspaceId.of('ws_1');
const TEAM = TeamId.of('team_1');
const ID = AvatarImageId.of('6f1d2c3b-4a59-4e8d-9c7b-1a2b3c4d5e6f');
const PNG = AvatarImage.of(
  Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1),
  'image/png',
);

type Stored = { readonly body: Uint8Array; readonly contentType?: string };

const notThere = () =>
  Object.assign(new Error('NoSuchKey'), { $metadata: { httpStatusCode: 404 } });

const bucket = (prefix?: string) => {
  const objects = new Map<string, Stored>();
  const send = async (command: unknown): Promise<unknown> => {
    if (command instanceof PutObjectCommand) {
      objects.set(command.input.Key ?? '', {
        body: command.input.Body as Uint8Array,
        contentType: command.input.ContentType,
      });
      return {};
    }
    if (command instanceof GetObjectCommand) {
      const found = objects.get(command.input.Key ?? '');
      if (!found) {
        throw notThere();
      }
      return {
        ContentType: found.contentType,
        Body: { transformToByteArray: async () => found.body },
      };
    }
    if (command instanceof DeleteObjectCommand) {
      objects.delete(command.input.Key ?? '');
      return {};
    }
    if (command instanceof ListObjectsV2Command) {
      const keys = [...objects.keys()]
        .filter((key) => key.startsWith(command.input.Prefix ?? ''))
        .sort();
      const after = command.input.ContinuationToken;
      const rest = after ? keys.filter((key) => key > after) : keys;
      const page = rest.slice(0, PAGE);
      const truncated = rest.length > PAGE;
      return {
        Contents: page.map((Key) => ({ Key })),
        IsTruncated: truncated,
        NextContinuationToken: truncated ? page[page.length - 1] : undefined,
      };
    }
    if (command instanceof DeleteObjectsCommand) {
      for (const { Key } of command.input.Delete?.Objects ?? []) {
        objects.delete(Key ?? '');
      }
      return {};
    }
    throw new Error('Unexpected S3 command');
  };
  const store = { send } as unknown as S3Client;

  return {
    objects,
    images: new S3AvatarImages({
      bucket: 'files',
      store,
      signer: store,
      machineSigner: store,
      keys: KeyOverlay.of(prefix),
    } satisfies S3Clients),
  };
};

describe('S3AvatarImages', () => {
  it('keeps workspace and team images apart under the workspace', async () => {
    const { objects, images } = bucket();

    await images.put(AvatarOwner.workspace(WORKSPACE), ID, PNG);
    await images.put(AvatarOwner.team(WORKSPACE, TEAM), ID, PNG);

    expect([...objects.keys()].sort()).toEqual([
      `workspaces/ws_1/avatars/teams/team_1/${ID.value}`,
      `workspaces/ws_1/avatars/workspace/${ID.value}`,
    ]);
  });

  it('reads back what it stored, then nothing once it is removed', async () => {
    const { images } = bucket();
    const owner = AvatarOwner.team(WORKSPACE, TEAM);

    await images.put(owner, ID, PNG);
    await expect(images.read(owner, ID)).resolves.toEqual({
      bytes: PNG.bytes,
      contentType: 'image/png',
    });

    await images.remove(owner, ID);
    await expect(images.read(owner, ID)).resolves.toBeNull();
  });

  it('writes under the overlay and reads an image from before it', async () => {
    const { objects, images } = bucket('preview-42');
    const owner = AvatarOwner.workspace(WORKSPACE);
    const key = `workspaces/ws_1/avatars/workspace/${ID.value}`;
    objects.set(key, { body: PNG.bytes, contentType: 'image/png' });

    await expect(images.read(owner, ID)).resolves.toEqual({
      bytes: PNG.bytes,
      contentType: 'image/png',
    });

    await images.put(owner, ID, PNG);
    expect(objects.has(`preview-42/${key}`)).toBe(true);
  });

  it('refuses an object stored as something other than an image', async () => {
    const { objects, images } = bucket();
    objects.set(`workspaces/ws_1/avatars/workspace/${ID.value}`, {
      body: PNG.bytes,
      contentType: 'text/html',
    });

    await expect(
      images.read(AvatarOwner.workspace(WORKSPACE), ID),
    ).rejects.toThrow(InconsistentStateError);
  });

  it('removes every image of a team, page by page', async () => {
    const { objects, images } = bucket();
    const team = 'workspaces/ws_1/avatars/teams/team_1/';
    for (let index = 0; index < PAGE * 2 + 5; index += 1) {
      objects.set(`${team}${index}`, { body: PNG.bytes });
    }
    objects.set('workspaces/ws_1/avatars/teams/team_2/kept', {
      body: PNG.bytes,
    });

    await images.removeAllOfTeam(WORKSPACE, TEAM);

    expect([...objects.keys()]).toEqual([
      'workspaces/ws_1/avatars/teams/team_2/kept',
    ]);
  });

  it('removes every image in a workspace and nothing in another', async () => {
    const { objects, images } = bucket();
    objects.set('workspaces/ws_1/avatars/workspace/a', { body: PNG.bytes });
    objects.set('workspaces/ws_1/avatars/teams/team_1/b', { body: PNG.bytes });
    objects.set('workspaces/ws_10/avatars/workspace/c', { body: PNG.bytes });

    await images.removeAllIn(WORKSPACE);

    expect([...objects.keys()]).toEqual([
      'workspaces/ws_10/avatars/workspace/c',
    ]);
  });
});

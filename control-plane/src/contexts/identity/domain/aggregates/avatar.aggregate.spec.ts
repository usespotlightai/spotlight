import { Avatar } from '@identity/domain/aggregates/avatar.aggregate';
import { AvatarRemoved } from '@identity/domain/events/avatar-removed.event';
import { AvatarReplaced } from '@identity/domain/events/avatar-replaced.event';
import { AvatarSet } from '@identity/domain/events/avatar-set.event';
import { AvatarDigest } from '@identity/domain/value-objects/avatar-digest.vo';
import { AvatarImageId } from '@identity/domain/value-objects/avatar-image-id.vo';
import { AvatarOwner } from '@identity/domain/value-objects/avatar-owner.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const OWNER = AvatarOwner.workspace(WorkspaceId.of('ws_1'));
const FIRST = AvatarDigest.of('a'.repeat(64));
const SECOND = AvatarDigest.of('b'.repeat(64));
const FIRST_IMAGE = AvatarImageId.of('6f1d2c3b-4a59-4e8d-9c7b-1a2b3c4d5e6f');
const SECOND_IMAGE = AvatarImageId.of('7a2e3d4c-5b6a-4f9e-8d7c-2b3c4d5e6f70');

const stored = (version = 3) =>
  Avatar.rehydrate({
    owner: OWNER,
    digest: FIRST,
    image: FIRST_IMAGE,
    version,
  });

describe('Avatar', () => {
  it('is created at version zero and says so', () => {
    const avatar = Avatar.create(OWNER, FIRST, FIRST_IMAGE);

    expect(avatar.version).toBe(0);
    expect(avatar.shows(FIRST)).toBe(true);
    expect(avatar.pullEvents()).toEqual([new AvatarSet(OWNER, FIRST)]);
  });

  it('records what it shows now and what it showed when it is replaced', () => {
    const replaced = stored().replacedWith(SECOND, SECOND_IMAGE);

    expect(replaced.shows(SECOND)).toBe(true);
    expect(replaced.shows(FIRST)).toBe(false);
    expect(replaced.image).toBe(SECOND_IMAGE);
    expect(replaced.version).toBe(3);
    expect(replaced.pullEvents()).toEqual([
      new AvatarReplaced(OWNER, SECOND, FIRST, FIRST_IMAGE),
    ]);
  });

  it('refuses to be replaced with the image it shows', () => {
    expect(() => stored().replacedWith(FIRST, SECOND_IMAGE)).toThrow(
      InconsistentStateError,
    );
  });

  it('shows nothing once it is removed', () => {
    const removed = stored().removed();

    expect(removed.isRemoved).toBe(true);
    expect(removed.shows(FIRST)).toBe(false);
    expect(removed.pullEvents()).toEqual([
      new AvatarRemoved(OWNER, FIRST, FIRST_IMAGE),
    ]);
  });

  it('cannot change after it is removed', () => {
    const removed = stored().removed();

    expect(() => removed.replacedWith(SECOND, SECOND_IMAGE)).toThrow(
      InconsistentStateError,
    );
    expect(() => removed.removed()).toThrow(InconsistentStateError);
  });

  it('rejects an impossible version', () => {
    expect(() => stored(-1)).toThrow(InconsistentStateError);
  });
});

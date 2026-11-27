import { workspaceNamesSeenBy } from '@github/application/services/workspace-names';
import type { WorkspaceProfile } from '@identity/application/ports/workspace-reader.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const VIEWER = UserId.of('user_1');
const TIDEPOOL = WorkspaceId.of('ws_2');
const HIDDEN = WorkspaceId.of('ws_9');

const naming = () => {
  const viewableOf = vi.fn(
    async (_viewer: UserId, ids: readonly WorkspaceId[]) =>
      ids.filter((each) => each.equals(TIDEPOOL)),
  );
  const profileOf = vi.fn(async (id: WorkspaceId) =>
    partial<WorkspaceProfile>({ id: id.value, name: 'Tidepool Labs' }),
  );

  return {
    viewableOf,
    profileOf,
    names: (ids: readonly WorkspaceId[]) =>
      workspaceNamesSeenBy(
        { access: { viewableOf }, workspaces: { profileOf } },
        VIEWER,
        ids,
      ),
  };
};

describe('workspaceNamesSeenBy', () => {
  it('names only the workspaces the viewer may see', async () => {
    const { names, viewableOf, profileOf } = naming();

    expect(await names([TIDEPOOL, HIDDEN])).toEqual(
      new Map([['ws_2', 'Tidepool Labs']]),
    );
    expect(viewableOf).toHaveBeenCalledWith(VIEWER, [TIDEPOOL, HIDDEN]);
    expect(profileOf).not.toHaveBeenCalledWith(HIDDEN);
  });

  it('asks nothing where there is nothing to name', async () => {
    const { names, viewableOf } = naming();

    expect(await names([])).toEqual(new Map());
    expect(viewableOf).not.toHaveBeenCalled();
  });
});

import { WorkspaceRunners } from '@runners/domain/aggregates/workspace-runners.aggregate';
import { InvalidWorkspaceRunnersError } from '@runners/domain/exceptions/invalid-workspace-runners.error';
import { WorkspaceRunnersVersionConflictError } from '@runners/domain/exceptions/workspace-runners-version-conflict.error';
import { PoolKey } from '@runners/domain/value-objects/pool-key.vo';
import { TrustKey } from '@runners/domain/value-objects/trust-key.vo';
import { WorkspaceRunnersId } from '@runners/domain/value-objects/workspace-runners-id.vo';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const BY = attributedIn('ws_1');

const created = () =>
  WorkspaceRunners.create({
    id: WorkspaceRunnersId.of('declared_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    trusts: [TrustKey.of('production')],
    pools: [PoolKey.of('ephemeral')],
    by: BY,
  });

describe('WorkspaceRunners', () => {
  it('says it was created, updated, and deleted', () => {
    const made = created();
    const again = made.update({ trusts: [], pools: [] }, BY);
    const deleted = again.delete(BY);

    expect(deleted.pullEvents().map((each) => each.kind)).toEqual([
      'workspace-runners.created',
      'workspace-runners.updated',
      'workspace-runners.deleted',
    ]);
  });

  it('rejects a trust or a pool named twice, pointing at the second', () => {
    expect(() =>
      WorkspaceRunners.create({
        id: WorkspaceRunnersId.of('declared_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        trusts: [TrustKey.of('production'), TrustKey.of('production')],
        pools: [],
        by: BY,
      }),
    ).toThrow('trusts[1] names production twice');
    expect(() =>
      created().update(
        {
          trusts: [],
          pools: [
            PoolKey.of('ephemeral'),
            PoolKey.of('burst'),
            PoolKey.of('ephemeral'),
          ],
        },
        BY,
      ),
    ).toThrow(InvalidWorkspaceRunnersError);
  });

  it('rejects a change to a version no longer current', () => {
    expect(() => created().assertVersion(1)).toThrow(
      WorkspaceRunnersVersionConflictError,
    );
  });
});

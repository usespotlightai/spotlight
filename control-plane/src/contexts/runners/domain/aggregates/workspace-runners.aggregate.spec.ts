import { WorkspaceRunners } from '@runners/domain/aggregates/workspace-runners.aggregate';
import { WorkspaceRunnersMovedOnError } from '@runners/domain/exceptions/workspace-runners-moved-on.error';
import { RunnerName } from '@runners/domain/value-objects/runner-name.vo';
import { TrustKey } from '@runners/domain/value-objects/trust-key.vo';
import { WorkspaceRunnersId } from '@runners/domain/value-objects/workspace-runners-id.vo';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const BY = attributedIn('ws_1');

const declared = () =>
  WorkspaceRunners.declare({
    id: WorkspaceRunnersId.of('declared_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    runners: [RunnerName.of('build-1')],
    trusts: [TrustKey.of('production')],
    by: BY,
  });

describe('WorkspaceRunners', () => {
  it('says it was declared, declared again, and dropped', () => {
    const made = declared();
    const again = made.redeclaredAs({ runners: [], trusts: [] }, BY);
    const dropped = again.dropped(BY);

    expect(dropped.pullEvents().map((each) => each.kind)).toEqual([
      'workspace-runners.declared',
      'workspace-runners.redeclared',
      'workspace-runners.dropped',
    ]);
  });

  it('refuses a change to a version no longer current', () => {
    expect(() => declared().expecting(1)).toThrow(WorkspaceRunnersMovedOnError);
  });
});

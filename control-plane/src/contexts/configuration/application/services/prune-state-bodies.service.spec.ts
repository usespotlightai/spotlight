import type { TerraformStateBodiesPort } from '@configuration/application/ports/terraform-state-bodies.port';
import { PruneStateBodies } from '@configuration/application/services/prune-state-bodies.service';
import { TerraformState } from '@configuration/domain/aggregates/terraform-state.aggregate';
import type { TerraformStateWritten } from '@configuration/domain/events/terraform-state-written.event';
import { StateName } from '@configuration/domain/value-objects/state-name.vo';
import { StateSnapshot } from '@configuration/domain/value-objects/state-snapshot.vo';
import { StateVersionId } from '@configuration/domain/value-objects/state-version-id.vo';
import { TerraformStateId } from '@configuration/domain/value-objects/terraform-state-id.vo';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');

describe('PruneStateBodies', () => {
  it('removes the bodies of the versions a write dropped out of retention', async () => {
    let state = TerraformState.open({
      id: TerraformStateId.of('state_1'),
      workspaceId: WORKSPACE,
      name: StateName.of('default'),
    });

    for (let at = 1; at <= 102; at += 1) {
      state = state.write({
        id: StateVersionId.of(`version_${at}`),
        snapshot: StateSnapshot.of({
          serial: at,
          lineage: 'abc',
          md5: 'd41d8cd98f00b204e9800998ecf8427e',
          size: 10,
        }),
        lockId: null,
        by: ChangeActor.spotlight(WORKSPACE),
        at: new Date('2026-10-26T10:00:00Z'),
      }).state;
    }

    const written = state.pullEvents().slice(-1)[0] as TerraformStateWritten;
    const remove = vi.fn(async () => undefined);

    await new PruneStateBodies({
      remove,
    } as unknown as TerraformStateBodiesPort).onWritten(written);

    expect(remove).toHaveBeenCalledWith([
      {
        workspaceId: WORKSPACE,
        stateId: TerraformStateId.of('state_1'),
        versionId: StateVersionId.of('version_2'),
      },
    ]);
  });
});

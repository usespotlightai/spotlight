import { WriteTerraformStateHandler } from '@configuration/application/commands/handlers/write-terraform-state.handler';
import { WriteTerraformStateCommand } from '@configuration/application/commands/write-terraform-state.command';
import type { TerraformStateBodiesPort } from '@configuration/application/ports/terraform-state-bodies.port';
import type { TerraformStates } from '@configuration/application/services/terraform-states.service';
import { TerraformState } from '@configuration/domain/aggregates/terraform-state.aggregate';
import type { TerraformStateRepository } from '@configuration/domain/repositories/terraform-state.repository';
import { PrincipalRef } from '@configuration/domain/value-objects/principal-ref.vo';
import { StateName } from '@configuration/domain/value-objects/state-name.vo';
import { StateSnapshot } from '@configuration/domain/value-objects/state-snapshot.vo';
import { StateVersion } from '@configuration/domain/value-objects/state-version.vo';
import { StateVersionId } from '@configuration/domain/value-objects/state-version-id.vo';
import { TerraformStateId } from '@configuration/domain/value-objects/terraform-state-id.vo';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { Actor } from '@shared-kernel/domain/value-objects/actor.vo';
import { Client } from '@shared-kernel/domain/value-objects/client.vo';
import { PersonPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const AT = new Date('2026-10-26T10:00:00Z');
const WORKSPACE = WorkspaceId.of('ws_1');
const BODY = new TextEncoder().encode(
  JSON.stringify({ version: 4, serial: 101, lineage: 'abc' }),
);
const MD5 = '0123456789abcdef0123456789abcdef';

const at = (number: number) =>
  StateVersion.of({
    id: StateVersionId.of(`version_${number}`),
    number,
    snapshot: StateSnapshot.of({
      serial: number,
      lineage: 'abc',
      md5: MD5,
      size: 10,
    }),
    writtenBy: PrincipalRef.rehydrate('person:u1'),
    writtenAt: AT,
  });

const stored = (latest: number) =>
  TerraformState.rehydrate({
    id: TerraformStateId.of('state_1'),
    workspaceId: WORKSPACE,
    name: StateName.of('default'),
    lock: null,
    versions: [at(latest)],
    version: 1,
  });

const writing = (input: { latest: number; save?: () => Promise<void> }) => {
  const states = {
    save: vi.fn(input.save ?? (async () => undefined)),
  } as unknown as TerraformStateRepository;
  const bodies = {
    put: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
  } as unknown as TerraformStateBodiesPort;
  let next = 0;
  const handler = new WriteTerraformStateHandler(
    {
      permissionsInSlug: async () => ({
        workspaceId: WORKSPACE,
        slug: 'acme',
        plans: true,
        configures: true,
        allows: () => false,
        isAdmin: false,
      }),
    } as unknown as WorkspaceAccessPort,
    { named: async () => stored(input.latest) } as unknown as TerraformStates,
    states,
    bodies,
    { generate: () => `id_${++next}` },
    { now: () => AT, sleep: async () => undefined },
  );

  return { handler, states, bodies };
};

const command = new WriteTerraformStateCommand(
  'acme',
  'default',
  Actor.of(PersonPrincipal.of(UserId.of('u1')), Client.named(undefined)),
  null,
  BODY,
  MD5,
);

describe('WriteTerraformStateHandler', () => {
  it('removes the body it stored when the save fails', async () => {
    const { handler, bodies } = writing({
      latest: 1,
      save: async () => {
        throw new Error('database down');
      },
    });

    await expect(handler.execute(command)).rejects.toThrow('database down');
    expect(bodies.remove).toHaveBeenCalledWith([
      {
        workspaceId: WORKSPACE,
        stateId: TerraformStateId.of('state_1'),
        versionId: StateVersionId.of('id_1'),
      },
    ]);
  });

  it('stores the body under the new version, then saves the state', async () => {
    const { handler, states, bodies } = writing({ latest: 50 });

    expect(await handler.execute(command)).toEqual({ outcome: 'done' });
    expect(bodies.put).toHaveBeenCalledWith(
      {
        workspaceId: WORKSPACE,
        stateId: TerraformStateId.of('state_1'),
        versionId: StateVersionId.of('id_1'),
      },
      BODY,
      expect.any(String),
    );
    expect(states.save).toHaveBeenCalledTimes(1);
  });
});

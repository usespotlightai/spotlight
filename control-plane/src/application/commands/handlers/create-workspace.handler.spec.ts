import { CreateWorkspaceCommand } from '@application/commands/create-workspace.command';
import { CreateWorkspaceHandler } from '@application/commands/handlers/create-workspace.handler';
import { UseCaseFault } from '@application/errors/use-case.fault';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type { Workspace } from '@domain/aggregates/workspace.aggregate';
import { WorkspaceSlugTakenError } from '@domain/exceptions/workspace-slug-taken.error';
import type { WorkspaceRepository } from '@domain/repositories/workspace.repository';
import { UserId } from '@domain/value-objects/user-id.vo';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ids = (): IdGeneratorPort => {
  let next = 0;
  return { generate: () => `id_${++next}` };
};

let added: Workspace | undefined;
let repository: WorkspaceRepository;

const handle = (name = 'Acme Inc.', slug = 'acme-inc') =>
  new CreateWorkspaceHandler(repository, ids()).execute(
    new CreateWorkspaceCommand(name, slug, 'user_1'),
  );

beforeEach(() => {
  added = undefined;
  repository = {
    isTaken: vi.fn().mockResolvedValue(false),
    add: vi.fn(async (workspace: Workspace) => {
      added = workspace;
    }),
  };
});

describe('CreateWorkspaceHandler', () => {
  it('returns the workspace it created, first team included', async () => {
    await expect(handle()).resolves.toEqual({
      id: 'id_1',
      name: 'Acme Inc.',
      slug: 'acme-inc',
      teams: [{ id: 'id_2', name: 'Acme Inc.' }],
    });
  });

  it('hands the repository one whole aggregate', async () => {
    await handle();

    expect(added?.members).toEqual([
      { userId: UserId.of('user_1'), role: 'owner' },
    ]);
    expect(added?.teams).toHaveLength(1);
  });

  it('reports a taken slug as a conflict, without writing', async () => {
    repository.isTaken = vi.fn().mockResolvedValue(true);

    const fault = await handle().catch((error: unknown) => error);

    expect(fault).toBeInstanceOf(UseCaseFault);
    expect(fault).toMatchObject({ kind: 'conflict' });
    expect(repository.add).not.toHaveBeenCalled();
  });

  it('reports a slug lost to the insert race as a conflict too', async () => {
    repository.add = vi
      .fn()
      .mockRejectedValue(new WorkspaceSlugTakenError('acme-inc'));

    await expect(handle()).rejects.toMatchObject({ kind: 'conflict' });
  });

  it('reports an unusable slug as invalid input', async () => {
    await expect(handle('Acme', 'not a slug')).rejects.toMatchObject({
      kind: 'invalid-input',
    });
  });

  it('reports a blank name as invalid input', async () => {
    await expect(handle('   ')).rejects.toMatchObject({
      kind: 'invalid-input',
    });
  });
});

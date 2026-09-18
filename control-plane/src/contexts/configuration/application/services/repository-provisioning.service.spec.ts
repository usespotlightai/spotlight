import { RepositoryProvisioning } from '@configuration/application/services/repository-provisioning.service';
import type { RepositoryCatalogPort } from '@github/application/ports/repository-catalog.port';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const target = (name: string) => ({
  workspaceId: WorkspaceId.of('ws_1'),
  repository: Repository.of(name),
});

const provisioning = (
  over: { held?: { fullName: string }[]; made?: boolean } = {},
) => {
  const list = vi.fn(async () => over.held ?? [{ fullName: 'acme/api' }]);
  const create = vi.fn(async () => over.made ?? true);

  return {
    create,
    service: new RepositoryProvisioning({
      list,
      create,
    } as unknown as RepositoryCatalogPort),
  };
};

describe('RepositoryProvisioning', () => {
  it('makes a repository the installation does not have yet', async () => {
    const { service, create } = provisioning({ held: [] });

    expect(await service.ensure(target('acme/new'))).toBe('made');

    const [, made] = create.mock.calls[0] as never as [
      unknown,
      { value: string },
    ];
    expect(made.value).toBe('acme/new');
  });

  it('makes nothing where the installation already has it', async () => {
    const { service, create } = provisioning();

    expect(await service.ensure(target('acme/api'))).toBe('held');
    expect(create).not.toHaveBeenCalled();
  });

  it('says so where the host would not make it', async () => {
    const { service } = provisioning({ held: [], made: false });

    expect(await service.ensure(target('acme/new'))).toBe('refused');
  });
});

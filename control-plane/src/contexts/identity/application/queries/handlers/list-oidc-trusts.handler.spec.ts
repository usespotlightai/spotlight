import type { OidcTrustSummaryDto } from '@identity/application/dto/oidc-trust-summary.dto';
import type { OidcTrustReaderPort } from '@identity/application/ports/oidc-trust-reader.port';
import { ListOidcTrustsHandler } from '@identity/application/queries/handlers/list-oidc-trusts.handler';
import { ListOidcTrustsQuery } from '@identity/application/queries/list-oidc-trusts.query';
import type { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import { PersonPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const TRUSTS: OidcTrustSummaryDto[] = [
  {
    id: 'trust_1',
    key: 'github-main',
    issuer: 'https://token.actions.githubusercontent.com',
    audience: 'spotlight',
    subject: 'repo:acme/platform:ref:refs/heads/main',
    claims: {},
    scopes: ['configure'],
    lifetimeMinutes: 15,
    createdBy: { id: 'user_1', name: 'Ada' },
    createdAt: new Date('2026-09-01T09:00:00.000Z'),
    lastIssuedAt: null,
  },
];

const listing = (found: { admin: boolean } | null) => {
  const workspace = found && {
    id: WorkspaceId.of('ws_1'),
    permissionsFor: () => ({ seesOidcTrustUsage: found.admin }),
  };
  const trusts = {
    listIn: vi.fn().mockResolvedValue(TRUSTS),
  } satisfies OidcTrustReaderPort;
  const handler = new ListOidcTrustsHandler(
    {
      findBySlug: vi.fn().mockResolvedValue(workspace as unknown as Workspace),
    } as unknown as WorkspaceRepository,
    trusts,
  );

  return {
    trusts,
    read: () =>
      handler.execute(
        new ListOidcTrustsQuery(
          'acme',
          PersonPrincipal.of(UserId.of('user_1')),
        ),
      ),
  };
};

describe('ListOidcTrustsHandler', () => {
  it('lists the OIDC trusts of the workspace to an admin', async () => {
    const { read, trusts } = listing({ admin: true });

    await expect(read()).resolves.toEqual(TRUSTS);
    expect(trusts.listIn).toHaveBeenCalledWith(WorkspaceId.of('ws_1'));
  });

  it('answers nothing to anyone who does not administer the workspace', async () => {
    const { read, trusts } = listing({ admin: false });

    await expect(read()).resolves.toBeNull();
    expect(trusts.listIn).not.toHaveBeenCalled();
  });

  it('answers nothing for a workspace that does not exist', async () => {
    await expect(listing(null).read()).resolves.toBeNull();
  });
});

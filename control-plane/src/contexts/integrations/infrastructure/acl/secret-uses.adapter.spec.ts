import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import { IntegrationSecretUses } from '@integrations/infrastructure/acl/secret-uses.adapter';
import { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import { defined } from '@integrations/integrations.definitions.fake-spec';
import { operationsContaining } from '@integrations/integrations.documents.fake-spec';
import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const LINEAR = `
integration: linear
name: Linear
actions:
  comment:
    request:
      method: POST
      url: https://api.linear.app/graphql
      auth:
        secrets: [secret.LINEAR_API_KEY]
`;

const SENTRY = `
integration: sentry
name: Sentry
actions:
  resolve:
    request:
      method: POST
      url: https://sentry.io/api/0/issues/
`;

const teams: TeamDirectoryPort = {
  find: vi.fn(),
  inWorkspace: async (workspaceId) => [
    {
      id: TeamId.of('team_1'),
      workspaceId,
      key: 'core',
      name: 'Core',
      members: [],
    },
  ],
};

describe('IntegrationSecretUses', () => {
  const uses = new IntegrationSecretUses(
    teams,
    {
      ofTeam: async () => [defined(LINEAR), defined(SENTRY)],
      everywhere: vi.fn(),
    },
    new IntegrationReader(new CelExpressionEngine(), operationsContaining()),
  );

  it('names each integration of the workspace that wears the secret', async () => {
    expect(
      await uses.usesOf({ workspaceId: 'ws_1', name: 'LINEAR_API_KEY' }),
    ).toEqual(['integration core/linear']);
  });

  it('names nothing for a secret no integration wears', async () => {
    expect(
      await uses.usesOf({
        workspaceId: WorkspaceId.of('ws_1').value,
        name: 'SENTRY_TOKEN',
      }),
    ).toEqual([]);
  });
});

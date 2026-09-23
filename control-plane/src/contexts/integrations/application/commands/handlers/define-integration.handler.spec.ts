import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { DefineIntegrationCommand } from '@integrations/application/commands/define-integration.command';
import { DefineIntegrationHandler } from '@integrations/application/commands/handlers/define-integration.handler';
import type {
  CompiledIntegration,
  IntegrationCompilerPort,
} from '@integrations/application/ports/integration-compiler.port';
import { IntegrationDefinition } from '@integrations/domain/aggregates/integration-definition.aggregate';
import { Integration } from '@integrations/domain/entities/integration.entity';
import type { IntegrationDefinitionRepository } from '@integrations/domain/repositories/integration-definition.repository';
import { DefinedActions } from '@integrations/domain/value-objects/defined-actions.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { DefinitionDocument } from '@shared-kernel/domain/value-objects/definition-document.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const TEAM = TeamId.of('team_1');

const LINEAR = { integration: 'linear', name: 'Linear' };

const compiler: IntegrationCompilerPort = {
  compile: (held): CompiledIntegration =>
    held === LINEAR
      ? {
          ok: true,
          integration: Integration.of({
            source: SourceKey.of('linear'),
            actions: DefinedActions.of(['comment']),
          }),
          document: DefinitionDocument.of(LINEAR),
          warnings: [],
        }
      : {
          ok: false,
          problems: [
            ConfigurationProblem.of({
              path: 'integrations/linear',
              at: 'the integration',
              reason: 'must do something',
            }),
          ],
        },
};

const defining = (
  over: { administers?: boolean; standing?: IntegrationDefinition } = {},
) => {
  const save = vi.fn(async (_: IntegrationDefinition) => {});
  const handler = new DefineIntegrationHandler(
    {
      onTeam: vi.fn(async () => ({
        workspaceId: WorkspaceId.of('ws_1'),
        teamId: TEAM,
        slug: 'acme',
        viewer: UserId.of('user_1'),
        administers: over.administers ?? true,
      })),
    } as unknown as WorkspaceAccessPort,
    compiler,
    {
      of: vi.fn(async () => over.standing ?? null),
      save,
    } satisfies IntegrationDefinitionRepository,
    { run: (work) => work() } satisfies TransactionPort,
  );

  return {
    define: (definition: unknown) =>
      handler.execute(
        new DefineIntegrationCommand(TEAM.value, 'user_1', definition),
      ),
    save,
  };
};

describe('DefineIntegrationHandler', () => {
  it('defines an integration the team does not have yet', async () => {
    const { define, save } = defining();

    expect(await define(LINEAR)).toMatchObject({
      ok: true,
      integration: { source: 'linear', definition: { name: 'Linear' } },
    });

    const [kept] = save.mock.calls[0] as [IntegrationDefinition];

    expect(kept.isNew).toBe(true);
    expect(kept.teamId).toEqual(TEAM);
  });

  it('redefines the one the team already has for that host', async () => {
    const standing = IntegrationDefinition.rehydrate({
      teamId: TEAM,
      source: SourceKey.of('linear'),
      document: DefinitionDocument.of({ integration: 'linear' }),
      version: 2,
    });
    const { define, save } = defining({ standing });

    await define(LINEAR);

    const [kept] = save.mock.calls[0] as [IntegrationDefinition];

    expect(kept.version).toBe(2);
    expect(kept.document.says('name', 'Linear')).toBe(true);
  });

  it('says what is wrong with one that will not compile, and keeps nothing', async () => {
    const { define, save } = defining();

    expect(await define({ integration: 'linear' })).toMatchObject({
      ok: false,
      problems: [{ path: 'integrations/linear' }],
    });
    expect(save).not.toHaveBeenCalled();
  });

  it('defines nothing for someone who does not administer the team', async () => {
    const { define, save } = defining({ administers: false });

    expect(await define(LINEAR)).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });
});

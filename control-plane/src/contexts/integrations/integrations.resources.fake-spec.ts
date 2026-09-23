import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type {
  CompiledIntegration,
  IntegrationCompilerPort,
} from '@integrations/application/ports/integration-compiler.port';
import type { ToolsGiven } from '@integrations/application/services/tools-given.service';
import { IntegrationDefinition } from '@integrations/domain/aggregates/integration-definition.aggregate';
import { Integration } from '@integrations/domain/entities/integration.entity';
import type { IntegrationDefinitionRepository } from '@integrations/domain/repositories/integration-definition.repository';
import { DefinedActions } from '@integrations/domain/value-objects/defined-actions.vo';
import { IntegrationDefinitionId } from '@integrations/domain/value-objects/integration-definition-id.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { ToolUses } from '@integrations/domain/value-objects/tool-uses.vo';
import type {
  IdempotentClaim,
  IdempotentCreatesPort,
} from '@shared-kernel/application/ports/idempotent-creates.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { DefinitionDocument } from '@shared-kernel/domain/value-objects/definition-document.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { vi } from 'vitest';

export const TEAM = TeamId.of('team_1');

export const LINEAR = { integration: 'linear', name: 'Linear' };

export const SLACK = { integration: 'slack', name: 'Slack' };

const compiledFor = (source: string, held: object): CompiledIntegration => ({
  ok: true,
  integration: Integration.of({
    source: SourceKey.of(source),
    actions: DefinedActions.of(['comment']),
  }),
  document: DefinitionDocument.of(held),
  warnings: [],
});

export const compiler: IntegrationCompilerPort = {
  compile: (held): CompiledIntegration =>
    held === LINEAR
      ? compiledFor('linear', held)
      : held === SLACK
        ? compiledFor('slack', held)
        : {
            ok: false,
            problems: [
              ConfigurationProblem.of({
                path: 'integrations/linear',
                at: 'actions.comment.request.url',
                reason: 'is required',
              }),
            ],
          },
};

export const standingAt = (
  version: number,
  offers: string[] = [],
): IntegrationDefinition =>
  IntegrationDefinition.rehydrate({
    id: IntegrationDefinitionId.of('integration_1'),
    teamId: TEAM,
    source: SourceKey.of('linear'),
    document: DefinitionDocument.of({ integration: 'linear' }),
    offers,
    version,
  });

export const access = (administers = true): WorkspaceAccessPort =>
  ({
    onTeam: vi.fn(async () => ({
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TEAM,
      slug: 'acme',
      viewer: UserId.of('user_1'),
      administers,
    })),
  }) as unknown as WorkspaceAccessPort;

export const teams = (): TeamDirectoryPort => ({
  find: vi.fn(async () => ({
    id: TEAM,
    workspaceId: WorkspaceId.of('ws_1'),
    key: 'core',
    name: 'Core',
    members: [],
  })),
  inWorkspace: vi.fn(async () => []),
});

export const creates = (claim: IdempotentClaim = { kind: 'fresh' }) =>
  ({
    claim: vi.fn(async () => claim),
    created: vi.fn(async () => {}),
  }) satisfies IdempotentCreatesPort;

export const toolsGiven = (given = ToolUses.none()): ToolsGiven =>
  ({ onTeam: vi.fn(async () => given) }) as unknown as ToolsGiven;

export const transaction: TransactionPort = { run: (work) => work() };

export const definitions = (
  over: {
    standing?: IntegrationDefinition | null;
    refusing?: Error;
    thenAt?: IntegrationDefinition | null;
  } = {},
) => {
  const read = vi.fn(async () => over.standing ?? null);

  return {
    withId: read,
    of: read,
    ofTeam: vi.fn(async () => (over.standing ? [over.standing] : [])),
    save: vi.fn(async (_: IntegrationDefinition) => {
      if (over.refusing) {
        read.mockResolvedValue(over.thenAt ?? null);
        throw over.refusing;
      }
    }),
  } satisfies IntegrationDefinitionRepository;
};

import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import { teamAccess } from '@identity/application/ports/workspace-access.fake-spec';
import type {
  IntegrationCompilerPort,
  ParsedIntegration,
} from '@integrations/application/ports/integration-compiler.port';
import type { CallAuthResolver } from '@integrations/application/services/call-auth-resolver.service';
import type { EnabledTools } from '@integrations/application/services/enabled-tools.service';
import { IntegrationSources } from '@integrations/application/services/integration-sources.service';
import { IntegrationDefinition } from '@integrations/domain/aggregates/integration-definition.aggregate';
import { Integration } from '@integrations/domain/entities/integration.entity';
import type { IntegrationDefinitionRepository } from '@integrations/domain/repositories/integration-definition.repository';
import { DefinedActions } from '@integrations/domain/value-objects/defined-actions.vo';
import { DefinitionDocument } from '@integrations/domain/value-objects/definition-document.vo';
import { IntegrationDefinitionId } from '@integrations/domain/value-objects/integration-definition-id.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { ToolUses } from '@integrations/domain/value-objects/tool-uses.vo';
import { documentsContaining } from '@integrations/integrations.documents.fake-spec';
import type {
  IdempotentClaim,
  IdempotentCreatesPort,
} from '@shared-kernel/application/ports/idempotent-creates.port';
import type {
  IdempotentRecall,
  IdempotentRecallsPort,
} from '@shared-kernel/application/ports/idempotent-recalls.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { vi } from 'vitest';

export const TEAM = TeamId.of('team_1');

export const LINEAR = { integration: 'linear', name: 'Linear' };

export const SLACK = { integration: 'slack', name: 'Slack' };

const compiledFor = (source: string, raw: object): ParsedIntegration => ({
  ok: true,
  integration: Integration.of({
    source: SourceKey.of(source),
    actions: DefinedActions.of(['comment']),
  }),
  document: DefinitionDocument.of(raw),
  source: null,
  passedOver: [],
  warnings: [],
});

const compiler: IntegrationCompilerPort = {
  compile: (raw): ParsedIntegration =>
    raw === LINEAR
      ? compiledFor('linear', raw)
      : raw === SLACK
        ? compiledFor('slack', raw)
        : {
            ok: false,
            problems: [
              ConfigurationProblem.of({
                path: 'integrations/linear',
                at: FieldPath.dotted('actions.comment.request.url'),
                reason: 'is required',
              }),
            ],
          },
};

export const storedAt = (
  version: number,
  offers: string[] = [],
): IntegrationDefinition =>
  IntegrationDefinition.rehydrate({
    id: IntegrationDefinitionId.of('integration_1'),
    teamId: TEAM,
    source: SourceKey.of('linear'),
    document: DefinitionDocument.of({ integration: 'linear' }),
    offers,
    reading: null,
    version,
  });

export const access = (administers = true) => teamAccess(TEAM, administers);

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

export const sources = new IntegrationSources(
  compiler,
  documentsContaining(),
  {
    read: vi.fn(async () => ({ kind: 'unread' as const, problem: 'unread' })),
  },
  {} as CallAuthResolver,
  { now: () => new Date('2026-10-05T12:00:00.000Z'), sleep: async () => {} },
);

export const creates = (claim: IdempotentClaim = { kind: 'fresh' }) =>
  ({
    claim: vi.fn(async () => claim),
    created: vi.fn(async () => {}),
  }) satisfies IdempotentCreatesPort;

export const recalls = (recall: IdempotentRecall = { kind: 'unseen' }) =>
  ({
    recall: vi.fn(async () => recall),
  }) satisfies IdempotentRecallsPort;

export const enabledTools = (enabled = ToolUses.none()): EnabledTools =>
  ({ onTeam: vi.fn(async () => enabled) }) as unknown as EnabledTools;

export const transaction: TransactionPort = { inTransaction: (work) => work() };

export const definitions = (
  over: {
    stored?: IntegrationDefinition | null;
    failing?: Error;
    thenAt?: IntegrationDefinition | null;
  } = {},
) => {
  const read = vi.fn(async () => over.stored ?? null);

  return {
    withId: read,
    of: read,
    ofTeam: vi.fn(async () => (over.stored ? [over.stored] : [])),
    save: vi.fn(async (_: IntegrationDefinition) => {
      if (over.failing) {
        read.mockResolvedValue(over.thenAt ?? null);
        throw over.failing;
      }
    }),
  } satisfies IntegrationDefinitionRepository;
};

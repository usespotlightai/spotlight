import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import { teamAccess } from '@identity/application/ports/workspace-access.fake-spec';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type {
  IntegrationCompilerPort,
  ParsedIntegration,
} from '@integrations/application/ports/integration-compiler.port';
import type { CallAuthResolver } from '@integrations/application/services/call-auth-resolver.service';
import type { EnabledTools } from '@integrations/application/services/enabled-tools.service';
import { IntegrationSpecs } from '@integrations/application/services/integration-specs.service';
import { IntegrationDefinition } from '@integrations/domain/aggregates/integration-definition.aggregate';
import type { IntegrationDefinitionRepository } from '@integrations/domain/repositories/integration-definition.repository';
import { actionNamed } from '@integrations/domain/value-objects/action.fake-spec';
import { DefinedActions } from '@integrations/domain/value-objects/defined-actions.vo';
import { DefinitionDocument } from '@integrations/domain/value-objects/definition-document.vo';
import { IntegrationDefinitionId } from '@integrations/domain/value-objects/integration-definition-id.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { Integration } from '@integrations/domain/value-objects/integration.vo';
import { OfferedTools } from '@integrations/domain/value-objects/offered-tools.vo';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { ToolUses } from '@integrations/domain/value-objects/tool-uses.vo';
import { documentsContaining } from '@integrations/integrations.documents.fake-spec';
import type {
  IdempotentCreatesPort,
  IdempotentReservation,
} from '@shared-kernel/application/ports/idempotent-creates.port';
import type {
  IdempotentLookup,
  IdempotentLookupsPort,
} from '@shared-kernel/application/ports/idempotent-lookups.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { type Mock, type Mocked, vi } from 'vitest';

export const TEAM = TeamId.of('team_1');

export const LINEAR = { integration: 'linear', name: 'Linear' };

export const SLACK = { integration: 'slack', name: 'Slack' };

const compiledFor = (integration: string, raw: object): ParsedIntegration => {
  const compiled = Integration.of({
    key: IntegrationKey.of(integration),
    actions: DefinedActions.of([actionNamed('comment')]),
  });

  return {
    ok: true,
    integration: compiled,
    offered: OfferedTools.generatedFor(compiled, []),
    document: DefinitionDocument.of(raw),
    spec: null,
    skipped: [],
    warnings: [],
  };
};

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
  tools: string[] = [],
): IntegrationDefinition =>
  IntegrationDefinition.rehydrate({
    id: IntegrationDefinitionId.of('integration_1'),
    teamId: TEAM,
    integration: IntegrationKey.of('linear'),
    document: DefinitionDocument.of({ integration: 'linear' }),
    tools: tools.map((tool) => ToolName.of(tool)),
    reading: null,
    relistsTools: false,
    version,
  });

export const access = (isAdmin = true): WorkspaceAccessPort =>
  teamAccess(TEAM, isAdmin);

export const teams = (): TeamDirectoryPort => ({
  find: vi.fn(() =>
    Promise.resolve({
      id: TEAM,
      workspaceId: WorkspaceId.of('ws_1'),
      key: 'core',
      name: 'Core',
      members: [],
    }),
  ),
  inWorkspace: vi.fn(() => Promise.resolve([])),
});

export const specs = new IntegrationSpecs(
  compiler,
  documentsContaining(),
  {
    read: vi.fn(() =>
      Promise.resolve({ kind: 'unread' as const, problem: 'unread' }),
    ),
  },
  partial<CallAuthResolver>({}),
  { now: () => new Date('2026-10-05T12:00:00.000Z'), sleep: async () => {} },
);

export const creates = (
  reservation: IdempotentReservation = { kind: 'new' },
): Mocked<IdempotentCreatesPort> =>
  ({
    reserve: vi.fn<IdempotentCreatesPort['reserve']>(() =>
      Promise.resolve(reservation),
    ),
    recordCreated: vi.fn<IdempotentCreatesPort['recordCreated']>(() =>
      Promise.resolve(),
    ),
  }) satisfies IdempotentCreatesPort;

export const lookups = (
  lookup: IdempotentLookup = { kind: 'new' },
): Mocked<IdempotentLookupsPort> =>
  ({
    lookup: vi.fn<IdempotentLookupsPort['lookup']>(() =>
      Promise.resolve(lookup),
    ),
  }) satisfies IdempotentLookupsPort;

export const enabledTools = (enabled = ToolUses.none()): EnabledTools =>
  partial<EnabledTools>({
    onTeam: vi.fn(() => Promise.resolve(enabled)),
  });

export const transaction: TransactionPort = { inTransaction: (work) => work() };

export const definitions = (
  over: {
    stored?: IntegrationDefinition | null;
    failing?: Error;
    thenAt?: IntegrationDefinition | null;
  } = {},
): {
  readonly withId: Mock<() => Promise<IntegrationDefinition | null>>;
  readonly of: Mock<() => Promise<IntegrationDefinition | null>>;
  readonly ofTeam: Mock<() => Promise<IntegrationDefinition[]>>;
  readonly save: Mock<IntegrationDefinitionRepository['save']>;
} => {
  const read = vi.fn(() => Promise.resolve(over.stored ?? null));

  return {
    withId: read,
    of: read,
    ofTeam: vi.fn(() => Promise.resolve(over.stored ? [over.stored] : [])),
    save: vi.fn<IntegrationDefinitionRepository['save']>(() => {
      if (over.failing) {
        read.mockResolvedValue(over.thenAt ?? null);
        return Promise.reject(over.failing);
      }

      return Promise.resolve();
    }),
  } satisfies IntegrationDefinitionRepository;
};

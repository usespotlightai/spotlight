import type { RefreshIntegrationSpecCommand } from '@integrations/application/commands/refresh-integration-spec.command';
import { RelistServers } from '@integrations/application/services/relist-servers.service';
import { IntegrationDefinition } from '@integrations/domain/aggregates/integration-definition.aggregate';
import { IntegrationDefinitionVersionConflictError } from '@integrations/domain/exceptions/integration-definition-version-conflict.error';
import type { IntegrationDefinitionRepository } from '@integrations/domain/repositories/integration-definition.repository';
import { ApiSpec } from '@integrations/domain/value-objects/api-spec.vo';
import { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import { DefinitionDocument } from '@integrations/domain/value-objects/definition-document.vo';
import { IntegrationDefinitionId } from '@integrations/domain/value-objects/integration-definition-id.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { SpecFetchResult } from '@integrations/domain/value-objects/spec-fetch-result.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it, vi } from 'vitest';

const TEN_MINUTES = 10 * 60_000;

const NOW = new Date('2026-10-05T10:00:00.000Z');

const DUE = new Date('2026-10-05T09:50:00.000Z');

const server = (integration: string) => ({
  teamId: TeamId.of('team_1'),
  integration: IntegrationKey.of(integration),
});

const listed = (integration: string, readAt: Date) =>
  IntegrationDefinition.rehydrate({
    id: IntegrationDefinitionId.of(`${integration}_id`),
    teamId: TeamId.of('team_1'),
    integration: IntegrationKey.of(integration),
    document: DefinitionDocument.of({ integration }),
    tools: [],
    reading: SpecFetchResult.read({
      spec: ApiSpec.of({
        kind: 'mcp',
        url: 'https://mcp.example.com',
        fingerprint: integration,
      }),
      hash: ContentHash.of('a'.repeat(64)),
      readAt,
    }),
    relistsTools: true,
    version: 1,
  });

const relisting = (
  candidates: readonly ReturnType<typeof server>[],
  stored: readonly IntegrationDefinition[] = candidates.map((each) =>
    listed(each.integration.value, new Date('2026-10-05T09:00:00.000Z')),
  ),
) => {
  const listedBefore = vi.fn(async () => candidates);
  const saved: IntegrationDefinition[] = [];
  const definitions = {
    of: vi.fn(
      async (_teamId: TeamId, integration: IntegrationKey) =>
        stored.find((each) => each.integration.equals(integration)) ?? null,
    ),
    save: vi.fn(async (definition: IntegrationDefinition) => {
      saved.push(definition);
    }),
  } as unknown as IntegrationDefinitionRepository;
  const execute = vi.fn(async (_command: RefreshIntegrationSpecCommand) => {});
  const log = { error: vi.fn() } as unknown as LoggerPort;
  const servers = new RelistServers(
    { listedBefore },
    definitions,
    { execute },
    { inTransaction: (work) => work() },
    { now: () => NOW } as ClockPort,
    log,
    TEN_MINUTES,
  );

  return { servers, listedBefore, definitions, saved, execute, log };
};

describe('RelistServers', () => {
  it('looks for the servers listed longer ago than the interval', async () => {
    const { servers, listedBefore } = relisting([]);

    await servers.processDue();

    expect(listedBefore).toHaveBeenCalledWith(DUE);
  });

  it('claims each due server through its definition, then lists it again', async () => {
    const { servers, execute, saved } = relisting([
      server('tracker'),
      server('notes'),
    ]);

    await servers.processDue();

    expect(saved.map((each) => each.reading?.readAt)).toEqual([NOW, NOW]);
    expect(execute.mock.calls.map(([command]) => command.integration)).toEqual([
      'tracker',
      'notes',
    ]);
  });

  it('leaves a server another worker listed meanwhile', async () => {
    const { servers, execute } = relisting(
      [server('tracker')],
      [listed('tracker', new Date('2026-10-05T09:55:00.000Z'))],
    );

    await servers.processDue();

    expect(execute).not.toHaveBeenCalled();
  });

  it('leaves a server whose claim lost to another worker', async () => {
    const { servers, definitions, execute } = relisting([server('tracker')]);
    vi.mocked(definitions.save).mockRejectedValueOnce(
      new IntegrationDefinitionVersionConflictError('tracker'),
    );

    await servers.processDue();

    expect(execute).not.toHaveBeenCalled();
  });

  it('goes on to the next server when one cannot be listed', async () => {
    const { servers, execute, log } = relisting([
      server('tracker'),
      server('notes'),
    ]);
    execute.mockRejectedValueOnce(new Error('moved on'));

    await expect(servers.processDue()).resolves.toBeUndefined();
    expect(execute).toHaveBeenCalledTimes(2);
    expect(log.error).toHaveBeenCalledOnce();
  });
});

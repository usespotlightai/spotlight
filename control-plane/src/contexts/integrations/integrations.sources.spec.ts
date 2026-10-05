import type { SourceRead } from '@integrations/application/ports/source-reader.port';
import { IntegrationSources } from '@integrations/application/services/integration-sources.service';
import { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import { DescribedOperation } from '@integrations/domain/value-objects/described-operation.vo';
import { IntegrationCompiler } from '@integrations/infrastructure/integrations/integration.compile';
import { documentsHolding } from '@integrations/integrations.documents.fake-spec';
import { reachFor } from '@integrations/integrations.secrets.fake-spec';
import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it, vi } from 'vitest';

const TEAM = TeamId.of('team_1');

const NOW = new Date('2026-10-05T12:00:00.000Z');

const HASH = ContentHash.of('e'.repeat(64));

const PETSTORE = {
  integration: 'petstore',
  openapi: { url: 'https://petstore3.swagger.io/api/v3/openapi.json' },
};

const FIND = DescribedOperation.of({
  name: 'find-pets',
  upstream: 'findPets',
  description: 'Find pets.',
  inputs: [],
  writes: false,
  call: {
    kind: 'http',
    method: 'GET',
    server: 'https://petstore3.swagger.io/api/v3',
    path: '/pet',
    params: [],
    body: null,
  },
});

const sourcing = (
  answer: SourceRead = {
    kind: 'read',
    hash: HASH,
    operations: [FIND],
    passedOver: [
      'passes over uploadFile, because it sends a body that is not JSON',
    ],
  },
) => {
  const documents = documentsHolding();
  const reader = { read: vi.fn(async (): Promise<SourceRead> => answer) };
  const sources = new IntegrationSources(
    new IntegrationCompiler(new CelExpressionEngine()),
    documents,
    reader,
    reachFor(),
    { now: () => NOW, sleep: async () => {} },
  );

  return { sources, reader, documents };
};

describe('IntegrationSources', () => {
  it('compiles a definition naming no description without reading anything', async () => {
    const { sources, reader } = sourcing();
    const sourced = await sources.compiled({
      definition: {
        integration: 'linear',
        actions: { ping: { request: { url: 'https://api.linear.app' } } },
      },
      teamId: TEAM,
      standing: null,
    });

    expect(sourced.compiled.ok).toBe(true);
    expect(sourced.reading).toBeNull();
    expect(reader.read).not.toHaveBeenCalled();
  });

  it('reads a description, keeps what it read, and offers its operations', async () => {
    const { sources, documents } = sourcing();
    const { compiled, reading } = await sources.compiled({
      definition: PETSTORE,
      teamId: TEAM,
      standing: null,
    });

    expect(
      compiled.ok && compiled.integration.offers.map((each) => each.tool),
    ).toEqual(['petstore.find-pets']);
    expect(reading?.hash).toEqual(HASH);
    expect(reading?.readAt).toEqual(NOW);
    expect(reading?.passedOver).toEqual([
      'passes over uploadFile, because it sends a body that is not JSON',
    ]);
    expect(documents.kept.map((each) => each.hash)).toEqual([HASH]);
  });

  it('reuses what it read while the description is read from the same place', async () => {
    const first = sourcing();
    const { reading: standing } = await first.sources.compiled({
      definition: PETSTORE,
      teamId: TEAM,
      standing: null,
    });

    first.reader.read.mockClear();

    const again = await first.sources.compiled({
      definition: { ...PETSTORE, name: 'Pets' },
      teamId: TEAM,
      standing,
    });

    expect(first.reader.read).not.toHaveBeenCalled();
    expect(again.reading?.hash).toEqual(HASH);
    expect(
      again.compiled.ok &&
        again.compiled.integration.offers.map((each) => each.tool),
    ).toEqual(['petstore.find-pets']);

    await first.sources.compiled({
      definition: {
        ...PETSTORE,
        openapi: { ...PETSTORE.openapi, revision: '2' },
      },
      teamId: TEAM,
      standing,
    });

    expect(first.reader.read).toHaveBeenCalledTimes(1);

    await first.sources.compiled({
      definition: PETSTORE,
      teamId: TEAM,
      standing,
      rereading: true,
    });

    expect(first.reader.read).toHaveBeenCalledTimes(2);
  });

  it('keeps offering what it read before when reading again fails, saying why', async () => {
    const { sources, reader } = sourcing();
    const { reading: standing } = await sources.compiled({
      definition: PETSTORE,
      teamId: TEAM,
      standing: null,
    });

    reader.read.mockResolvedValue({
      kind: 'unread',
      problem: 'could not be read: petstore3.swagger.io: ECONNREFUSED',
    });

    const reread = await sources.compiled({
      definition: PETSTORE,
      teamId: TEAM,
      standing,
      rereading: true,
    });

    expect(
      reread.compiled.ok &&
        reread.compiled.integration.offers.map((each) => each.tool),
    ).toEqual(['petstore.find-pets']);
    expect(reread.reading?.hash).toEqual(HASH);
    expect(reread.reading?.problem).toBe(
      'could not be read: petstore3.swagger.io: ECONNREFUSED',
    );

    reader.read.mockClear();
    reader.read.mockResolvedValue({
      kind: 'read',
      hash: HASH,
      operations: [FIND],
      passedOver: [],
    });

    const updated = await sources.compiled({
      definition: { ...PETSTORE, name: 'Pets' },
      teamId: TEAM,
      standing: reread.reading,
    });

    expect(reader.read).toHaveBeenCalledTimes(1);
    expect(updated.reading?.problem).toBeNull();
  });

  it('keeps a definition whose description could not be read, saying why, offering nothing from it', async () => {
    const { sources } = sourcing({
      kind: 'unread',
      problem: 'could not be read: petstore3.swagger.io answered 503',
    });
    const { compiled, reading } = await sources.compiled({
      definition: PETSTORE,
      teamId: TEAM,
      standing: null,
    });

    expect(compiled.ok && compiled.integration.offers).toEqual([]);
    expect(reading?.problem).toBe(
      'could not be read: petstore3.swagger.io answered 503',
    );
    expect(reading?.hash).toBeNull();
  });
});

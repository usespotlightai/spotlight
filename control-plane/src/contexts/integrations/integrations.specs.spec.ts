import type { SpecRead } from '@integrations/application/ports/spec-reader.port';
import { IntegrationSpecs } from '@integrations/application/services/integration-specs.service';
import { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import { SpecOperation } from '@integrations/domain/value-objects/spec-operation.vo';
import { IntegrationCompiler } from '@integrations/infrastructure/integrations/integration.compile';
import { documentsContaining } from '@integrations/integrations.documents.fake-spec';
import { callAuthFor } from '@integrations/integrations.secrets.fake-spec';
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

const FIND = SpecOperation.of({
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

const fetching = (
  answer: SpecRead = {
    kind: 'read',
    hash: HASH,
    operations: [FIND],
    skipped: ['skips uploadFile, because it sends a body that is not JSON'],
  },
) => {
  const documents = documentsContaining();
  const reader = { read: vi.fn(async (): Promise<SpecRead> => answer) };
  const specs = new IntegrationSpecs(
    new IntegrationCompiler(new CelExpressionEngine()),
    documents,
    reader,
    callAuthFor(),
    { now: () => NOW, sleep: async () => {} },
  );

  return { specs, reader, documents };
};

describe('IntegrationSpecs', () => {
  it('compiles a definition that names no API spec without fetching anything', async () => {
    const { specs, reader } = fetching();
    const fetched = await specs.compiled({
      definition: {
        integration: 'linear',
        actions: { ping: { request: { url: 'https://api.linear.app' } } },
      },
      teamId: TEAM,
      current: null,
    });

    expect(fetched.compiled.ok).toBe(true);
    expect(fetched.reading).toBeNull();
    expect(reader.read).not.toHaveBeenCalled();
  });

  it('fetches an API spec, stores it, and provides its operations', async () => {
    const { specs, documents } = fetching();
    const { compiled, reading } = await specs.compiled({
      definition: PETSTORE,
      teamId: TEAM,
      current: null,
    });

    expect(
      compiled.ok && compiled.integration.tools.map((each) => each.tool),
    ).toEqual(['petstore.find-pets']);
    expect(reading?.hash).toEqual(HASH);
    expect(reading?.readAt).toEqual(NOW);
    expect(reading?.skipped).toEqual([
      'skips uploadFile, because it sends a body that is not JSON',
    ]);
    expect(documents.stored.map((each) => each.hash)).toEqual([HASH]);
  });

  it('reuses the stored spec while the spec comes from the same place', async () => {
    const first = fetching();
    const { reading: current } = await first.specs.compiled({
      definition: PETSTORE,
      teamId: TEAM,
      current: null,
    });

    first.reader.read.mockClear();

    const again = await first.specs.compiled({
      definition: { ...PETSTORE, name: 'Pets' },
      teamId: TEAM,
      current,
    });

    expect(first.reader.read).not.toHaveBeenCalled();
    expect(again.reading?.hash).toEqual(HASH);
    expect(
      again.compiled.ok &&
        again.compiled.integration.tools.map((each) => each.tool),
    ).toEqual(['petstore.find-pets']);

    await first.specs.compiled({
      definition: {
        ...PETSTORE,
        openapi: { ...PETSTORE.openapi, revision: '2' },
      },
      teamId: TEAM,
      current,
    });

    expect(first.reader.read).toHaveBeenCalledTimes(1);

    await first.specs.compiled({
      definition: PETSTORE,
      teamId: TEAM,
      current,
      refreshingSpec: true,
    });

    expect(first.reader.read).toHaveBeenCalledTimes(2);
  });

  it('keeps the tools of the last spec when a refresh fails, and says why', async () => {
    const { specs, reader } = fetching();
    const { reading: current } = await specs.compiled({
      definition: PETSTORE,
      teamId: TEAM,
      current: null,
    });

    reader.read.mockResolvedValue({
      kind: 'unread',
      problem: 'could not be read: petstore3.swagger.io: ECONNREFUSED',
    });

    const refreshed = await specs.compiled({
      definition: PETSTORE,
      teamId: TEAM,
      current,
      refreshingSpec: true,
    });

    expect(
      refreshed.compiled.ok &&
        refreshed.compiled.integration.tools.map((each) => each.tool),
    ).toEqual(['petstore.find-pets']);
    expect(refreshed.reading?.hash).toEqual(HASH);
    expect(refreshed.reading?.problem).toBe(
      'could not be read: petstore3.swagger.io: ECONNREFUSED',
    );

    reader.read.mockClear();
    reader.read.mockResolvedValue({
      kind: 'read',
      hash: HASH,
      operations: [FIND],
      skipped: [],
    });

    const updated = await specs.compiled({
      definition: { ...PETSTORE, name: 'Pets' },
      teamId: TEAM,
      current: refreshed.reading,
    });

    expect(reader.read).toHaveBeenCalledTimes(1);
    expect(updated.reading?.problem).toBeNull();
  });

  it('stores a definition whose API spec could not be fetched, says why, and provides nothing from it', async () => {
    const { specs } = fetching({
      kind: 'unread',
      problem: 'could not be read: petstore3.swagger.io answered 503',
    });
    const { compiled, reading } = await specs.compiled({
      definition: PETSTORE,
      teamId: TEAM,
      current: null,
    });

    expect(compiled.ok && compiled.integration.tools).toEqual([]);
    expect(reading?.problem).toBe(
      'could not be read: petstore3.swagger.io answered 503',
    );
    expect(reading?.hash).toBeNull();
  });
});

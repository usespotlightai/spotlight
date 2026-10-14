import type { Reach } from '@integrations/application/ports/integration-runtime.port';
import { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import { ConnectionHolder } from '@integrations/domain/value-objects/connection-holder.vo';
import { DescribedSource } from '@integrations/domain/value-objects/described-source.vo';
import { LINEAR_SDL } from '@integrations/infrastructure/sources/graphql/linear.fake-spec';
import { PETSTORE } from '@integrations/infrastructure/sources/openapi/petstore.fake-spec';
import {
  DescriptionUnauthorized,
  type SourceFetch,
  type SourceWearing,
} from '@integrations/infrastructure/sources/source-fetch';
import { ThreadedSourceReader } from '@integrations/infrastructure/sources/threaded-source-reader';
import { credentialsFor } from '@integrations/integrations.secrets.fake-spec';
import { describe, expect, it, vi } from 'vitest';
import { stringify as yamlOf } from 'yaml';

const REACH: Reach = { connection: null, credentials: credentialsFor() };

const fetchingNothing = {
  text: vi.fn(async () => {
    throw new Error('nothing is fetched for a document written out');
  }),
} as unknown as SourceFetch;

const openapi = (document: string, baseUrl: string | null = null) =>
  DescribedSource.of({
    kind: 'openapi',
    document,
    baseUrl: baseUrl ?? 'https://petstore3.swagger.io/api/v3',
    fingerprint: 'petstore',
  });

describe('ThreadedSourceReader', () => {
  it('reads an OpenAPI description in YAML on a thread of its own', async () => {
    const read = await new ThreadedSourceReader(fetchingNothing).read(
      openapi(yamlOf(PETSTORE)),
      REACH,
    );

    expect(read.kind).toBe('read');
    expect(
      read.kind === 'read' && read.operations.map((each) => each.name),
    ).toContain('find-pets-by-status');
    expect(read.kind === 'read' && read.hash.value).toMatch(/^[0-9a-f]{64}$/);
  }, 30_000);

  it('hashes what it read together with how it reads it', async () => {
    const reader = new ThreadedSourceReader(fetchingNothing);
    const text = JSON.stringify(PETSTORE);
    const [one, again, elsewhere] = await Promise.all([
      reader.read(openapi(text), REACH),
      reader.read(openapi(text), REACH),
      reader.read(openapi(text, 'https://pets.example'), REACH),
    ]);

    expect(one.kind === 'read' && one.hash).toEqual(
      again.kind === 'read' && again.hash,
    );
    expect(one.kind === 'read' && one.hash).not.toEqual(
      elsewhere.kind === 'read' && elsewhere.hash,
    );
  }, 30_000);

  it('introspects a GraphQL endpoint it fetches from', async () => {
    const fetching = {
      text: vi.fn(async () => LINEAR_SDL),
    } as unknown as SourceFetch;
    const read = await new ThreadedSourceReader(fetching).read(
      DescribedSource.of({
        kind: 'graphql',
        url: 'https://api.linear.app/graphql',
        fingerprint: 'linear',
      }),
      REACH,
    );

    expect(fetching.text).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST' }),
      expect.objectContaining({ apiHost: 'api.linear.app' }),
    );
    expect(
      read.kind === 'read' && read.operations.map((each) => each.name),
    ).toContain('issue-create');
  }, 30_000);

  it('says why a description could not be read', async () => {
    expect(
      await new ThreadedSourceReader(fetchingNothing).read(
        openapi('swagger: "2.0"\npaths: {}\n'),
        REACH,
      ),
    ).toEqual({
      kind: 'unread',
      problem:
        'is a Swagger 2 description. Spotlight reads only OpenAPI 3. Please convert it to OpenAPI 3',
    });
  }, 30_000);

  describe('with the team’s connection', () => {
    const graphql = (connected: boolean) =>
      DescribedSource.of({
        kind: 'graphql',
        url: 'https://api.linear.app/graphql',
        fingerprint: 'linear',
        connected,
      });

    const holding = (renewed: string | null) => {
      const refused = vi.fn(async () =>
        renewed ? AccessToken.of(renewed) : null,
      );
      const reach: Reach = {
        connection: {
          token: AccessToken.of('lin-old'),
          holder: ConnectionHolder.team(),
          handle: null,
          refused,
        },
        credentials: credentialsFor(),
      };

      return { reach, refused };
    };

    const connectionsSent = (fetching: SourceFetch) =>
      (fetching.text as ReturnType<typeof vi.fn>).mock.calls.map(
        (call) => (call[1] as SourceWearing).connection,
      );

    it('sends it only where the description authenticates by oauth2', async () => {
      const fetching = {
        text: vi.fn(async () => LINEAR_SDL),
      } as unknown as SourceFetch;
      const { reach } = holding(null);
      const reader = new ThreadedSourceReader(fetching);

      await reader.read(graphql(false), reach);
      await reader.read(graphql(true), reach);

      expect(connectionsSent(fetching)).toEqual([null, 'lin-old']);
    }, 30_000);

    it('renews it once when the host refuses it, and reads with the new token', async () => {
      const fetching = {
        text: vi
          .fn()
          .mockRejectedValueOnce(
            new DescriptionUnauthorized(
              'could not be read: api.linear.app answered 401',
            ),
          )
          .mockResolvedValueOnce(LINEAR_SDL),
      } as unknown as SourceFetch;
      const { reach, refused } = holding('lin-new');

      const read = await new ThreadedSourceReader(fetching).read(
        graphql(true),
        reach,
      );

      expect(read.kind).toBe('read');
      expect(refused).toHaveBeenCalledOnce();
      expect(connectionsSent(fetching)).toEqual(['lin-old', 'lin-new']);
    }, 30_000);

    it('says it could not be read when renewing does not help', async () => {
      const fetching = {
        text: vi
          .fn()
          .mockRejectedValue(
            new DescriptionUnauthorized(
              'could not be read: api.linear.app answered 401',
            ),
          ),
      } as unknown as SourceFetch;
      const { reach } = holding(null);

      expect(
        await new ThreadedSourceReader(fetching).read(graphql(true), reach),
      ).toEqual({
        kind: 'unread',
        problem: 'could not be read: api.linear.app answered 401',
      });
      expect(fetching.text).toHaveBeenCalledOnce();
    }, 30_000);
  });
});

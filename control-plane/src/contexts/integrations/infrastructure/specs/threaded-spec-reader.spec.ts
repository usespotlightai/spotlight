import type { CallAuth } from '@integrations/application/ports/integration-runtime.port';
import { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import { ApiSpec } from '@integrations/domain/value-objects/api-spec.vo';
import { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import { LINEAR_SDL } from '@integrations/infrastructure/specs/graphql/linear.fake-spec';
import { PETSTORE } from '@integrations/infrastructure/specs/openapi/petstore.fake-spec';
import {
  type SpecFetch,
  type SpecInjection,
  SpecUnauthorized,
} from '@integrations/infrastructure/specs/spec-fetch';
import { ThreadedSpecReader } from '@integrations/infrastructure/specs/threaded-spec-reader';
import { credentialsFor } from '@integrations/integrations.secrets.fake-spec';
import { describe, expect, it, vi } from 'vitest';
import { stringify as yamlOf } from 'yaml';

const CALL_AUTH: CallAuth = {
  workspace: async () => 'ws_1',
  connection: null,
  credentials: credentialsFor(),
};

const fetchingNothing = {
  text: vi.fn(async () => {
    throw new Error('nothing is fetched for a document written out');
  }),
} as unknown as SpecFetch;

const openapi = (document: string, baseUrl: string | null = null) =>
  ApiSpec.of({
    kind: 'openapi',
    document,
    baseUrl: baseUrl ?? 'https://petstore3.swagger.io/api/v3',
    fingerprint: 'petstore',
  });

describe('ThreadedSpecReader', () => {
  it('reads an OpenAPI spec in YAML on a thread of its own', async () => {
    const read = await new ThreadedSpecReader(fetchingNothing).read(
      openapi(yamlOf(PETSTORE)),
      CALL_AUTH,
    );

    expect(read.kind).toBe('read');
    expect(
      read.kind === 'read' && read.operations.map((each) => each.name),
    ).toContain('find-pets-by-status');
    expect(read.kind === 'read' && read.hash.value).toMatch(/^[0-9a-f]{64}$/);
  }, 30_000);

  it('hashes what it read together with how it reads it', async () => {
    const reader = new ThreadedSpecReader(fetchingNothing);
    const text = JSON.stringify(PETSTORE);
    const [one, again, elsewhere] = await Promise.all([
      reader.read(openapi(text), CALL_AUTH),
      reader.read(openapi(text), CALL_AUTH),
      reader.read(openapi(text, 'https://pets.example'), CALL_AUTH),
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
    } as unknown as SpecFetch;
    const read = await new ThreadedSpecReader(fetching).read(
      ApiSpec.of({
        kind: 'graphql',
        url: 'https://api.linear.app/graphql',
        fingerprint: 'linear',
      }),
      CALL_AUTH,
    );

    expect(fetching.text).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST' }),
      expect.objectContaining({ apiHost: 'api.linear.app' }),
    );
    expect(
      read.kind === 'read' && read.operations.map((each) => each.name),
    ).toContain('issue-create');
  }, 30_000);

  it('says why a spec could not be parsed', async () => {
    expect(
      await new ThreadedSpecReader(fetchingNothing).read(
        openapi('swagger: "2.0"\npaths: {}\n'),
        CALL_AUTH,
      ),
    ).toEqual({
      kind: 'unread',
      problem:
        'is a Swagger 2 spec. Spotlight reads only OpenAPI 3. Please convert it to OpenAPI 3',
    });
  }, 30_000);

  describe('with the team’s connection', () => {
    const graphql = (connected: boolean) =>
      ApiSpec.of({
        kind: 'graphql',
        url: 'https://api.linear.app/graphql',
        fingerprint: 'linear',
        connected,
      });

    const callAuthWith = (refreshed: string | null) => {
      const unauthorized = vi.fn(async () =>
        refreshed ? AccessToken.of(refreshed) : null,
      );
      const callAuth: CallAuth = {
        workspace: async () => 'ws_1',
        connection: {
          token: AccessToken.of('lin-old'),
          owner: ConnectionOwner.team(),
          linkedAccount: null,
          unauthorized,
        },
        credentials: credentialsFor(),
      };

      return { callAuth, unauthorized };
    };

    const connectionsSent = (fetching: SpecFetch) =>
      (fetching.text as ReturnType<typeof vi.fn>).mock.calls.map(
        (call) => (call[1] as SpecInjection).connection,
      );

    it('sends it only where the spec authenticates by oauth2', async () => {
      const fetching = {
        text: vi.fn(async () => LINEAR_SDL),
      } as unknown as SpecFetch;
      const { callAuth } = callAuthWith(null);
      const reader = new ThreadedSpecReader(fetching);

      await reader.read(graphql(false), callAuth);
      await reader.read(graphql(true), callAuth);

      expect(connectionsSent(fetching)).toEqual([null, 'lin-old']);
    }, 30_000);

    it('refreshes it once when the service does not accept it, and reads with the new token', async () => {
      const fetching = {
        text: vi
          .fn()
          .mockRejectedValueOnce(
            new SpecUnauthorized(
              'could not be read: api.linear.app answered 401',
            ),
          )
          .mockResolvedValueOnce(LINEAR_SDL),
      } as unknown as SpecFetch;
      const { callAuth, unauthorized } = callAuthWith('lin-new');

      const read = await new ThreadedSpecReader(fetching).read(
        graphql(true),
        callAuth,
      );

      expect(read.kind).toBe('read');
      expect(unauthorized).toHaveBeenCalledOnce();
      expect(connectionsSent(fetching)).toEqual(['lin-old', 'lin-new']);
    }, 30_000);

    it('says it could not be read when a refresh does not help', async () => {
      const fetching = {
        text: vi
          .fn()
          .mockRejectedValue(
            new SpecUnauthorized(
              'could not be read: api.linear.app answered 401',
            ),
          ),
      } as unknown as SpecFetch;
      const { callAuth } = callAuthWith(null);

      expect(
        await new ThreadedSpecReader(fetching).read(graphql(true), callAuth),
      ).toEqual({
        kind: 'unread',
        problem: 'could not be read: api.linear.app answered 401',
      });
      expect(fetching.text).toHaveBeenCalledOnce();
    }, 30_000);
  });
});

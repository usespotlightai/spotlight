import { createHash } from 'node:crypto';
import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type {
  TeamMembership,
  WorkspaceAccessPort,
} from '@identity/application/ports/workspace-access.port';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import { ConnectionRenewal } from '@integrations/application/services/connection-renewal.service';
import { HostReach } from '@integrations/application/services/host-reach.service';
import { OAuth2ClientResolution } from '@integrations/application/services/oauth2-client-resolution.service';
import { DescribedDocument } from '@integrations/domain/aggregates/described-document.aggregate';
import { HostConnection } from '@integrations/domain/aggregates/host-connection.aggregate';
import { OAuth2ClientRegistration } from '@integrations/domain/aggregates/oauth2-client-registration.aggregate';
import { PersonToolPolicy } from '@integrations/domain/aggregates/person-tool-policy.aggregate';
import { OAuth2ClientRegistrationVersionConflictError } from '@integrations/domain/exceptions/oauth2-client-registration-version-conflict.error';
import type { OAuth2ClientRegistrationRepository } from '@integrations/domain/repositories/oauth2-client-registration.repository';
import { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import { ConnectionHolder } from '@integrations/domain/value-objects/connection-holder.vo';
import { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import { DescribedOperation } from '@integrations/domain/value-objects/described-operation.vo';
import { HostGrant } from '@integrations/domain/value-objects/host-grant.vo';
import { PersonToolRule } from '@integrations/domain/value-objects/person-tool-rule.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { IntegrationToolCalls } from '@integrations/infrastructure/acl/integration-tool-calls.adapter';
import { CompiledIntegrationRuntime } from '@integrations/infrastructure/integrations/compiled-integration.runtime';
import { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import { OAuth2Clients } from '@integrations/infrastructure/integrations/oauth2-clients';
import { OAuth2Exchange } from '@integrations/infrastructure/integrations/oauth2-exchange';
import { OAuth2Linking } from '@integrations/infrastructure/integrations/oauth2-linking';
import { OAuth2Registrar } from '@integrations/infrastructure/integrations/oauth2-registrar';
import { OAuth2State } from '@integrations/infrastructure/integrations/oauth2-state';
import { HttpOutbound } from '@integrations/infrastructure/outbound/http-outbound';
import { OutboundPolicy } from '@integrations/infrastructure/outbound/outbound-policy';
import { InMemoryHostConnections } from '@integrations/integrations.connections.fake-spec';
import { defined } from '@integrations/integrations.definitions.fake-spec';
import { operationsContaining } from '@integrations/integrations.documents.fake-spec';
import { learningInto } from '@integrations/integrations.learned.fake-spec';
import {
  discoveringNothing,
  reachingNoServer,
} from '@integrations/integrations.mcp.fake-spec';
import {
  InMemoryPersonToolPolicies,
  personRulesFrom,
} from '@integrations/integrations.policies.fake-spec';
import { injecting } from '@integrations/integrations.secrets.fake-spec';
import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { InputSchema } from '@shared-kernel/domain/value-objects/input-schema.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { BoundTaskDto } from '@work/application/dto/bound-task.dto';
import type { IntegrationTool } from '@work/application/ports/integration-tool-calls.port';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-05T10:00:00.000Z');
const TEAM = TeamId.of('team_1');
const LINEAR = SourceKey.of('linear');
const ALICE = UserId.of('user_alice');
const CALLBACK = 'https://app.example/api/integrations/oauth/callback';

const DEFINITION = `integration: linear
name: Linear
connection:
  holder: requester
  oauth2:
    authorize: https://linear.app/oauth/authorize
    token: https://api.linear.app/oauth/token
    registration: https://linear.app/oauth/register
    identity: '\${{ response.handle }}'
actions:
  comment:
    request:
      method: POST
      url: https://api.linear.app/graphql
      body:
        body: '\${{ inputs.body }}'
      auth:
        oauth2:
          connection: true
      capture:
        url: '\${{ response.url }}'
tools:
  comment:
    does: comment
    description: Comment on the Linear issue as the person who started the task.
    inputs:
      body:
        required: true
    output: '\${{ capture.url }}'
`;

const asJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const formOf = (init?: RequestInit) =>
  new URLSearchParams(String(init?.body ?? ''));

class FakeLinear {
  issued = 1;
  access = 'at-1';
  refresh = 'rt-1';
  tokenCalls = 0;
  apiCalls = 0;
  registrations = 0;
  answersUnauthorized = false;
  readonly challenges = new Map<string, string>();
  readonly verifiers: string[] = [];
  whileRenewing: () => void = () => {};
  answersAfter: Promise<void> = Promise.resolve();

  readonly fetch = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = String(input);

    if (url === 'https://linear.app/oauth/register') {
      this.registrations++;
      const asked = JSON.parse(String(init?.body ?? '{}'));
      expect(asked.redirect_uris).toEqual([CALLBACK]);
      return asJson({ client_id: 'dcr-client', client_secret: 'dcr-secret' });
    }

    if (url === 'https://api.linear.app/oauth/token') {
      return this.token(formOf(init));
    }

    if (url === 'https://api.linear.app/graphql') {
      this.apiCalls++;
      const authorization = new Headers(init?.headers).get('authorization');

      return !this.answersUnauthorized &&
        authorization === `Bearer ${this.access}`
        ? asJson({ url: `https://linear.app/acme/issue/ENG-12#${this.access}` })
        : asJson({ error: 'not authenticated' }, 401);
    }

    throw new Error(`the fake Linear knows nothing at ${url}`);
  };

  revoke(): void {
    this.access = 'at-revoked-elsewhere';
  }

  private async token(form: URLSearchParams): Promise<Response> {
    this.tokenCalls++;

    if (
      form.get('client_id') !== 'dcr-client' ||
      form.get('client_secret') !== 'dcr-secret'
    ) {
      return asJson({ error: 'invalid_client' }, 401);
    }

    if (form.get('grant_type') === 'authorization_code') {
      const challenge = this.challenges.get(form.get('code') ?? '');
      const verifier = form.get('code_verifier') ?? '';
      this.verifiers.push(verifier);

      if (
        !challenge ||
        createHash('sha256').update(verifier).digest('base64url') !== challenge
      ) {
        return asJson({ error: 'invalid_grant' }, 400);
      }

      return this.rotated();
    }

    if (form.get('refresh_token') !== this.refresh) {
      return asJson({ error: 'invalid_grant' }, 400);
    }

    await this.answersAfter;
    this.whileRenewing();

    return this.rotated();
  }

  private rotated(): Response {
    this.issued++;
    this.access = `at-${this.issued}`;
    this.refresh = `rt-${this.issued}`;

    return asJson({
      access_token: this.access,
      refresh_token: this.refresh,
      expires_in: 3600,
      handle: '@alice',
    });
  }
}

class InMemoryRegistrations implements OAuth2ClientRegistrationRepository {
  stored: OAuth2ClientRegistration | null = null;

  async of(): Promise<OAuth2ClientRegistration | null> {
    return this.stored;
  }

  async save(registration: OAuth2ClientRegistration): Promise<void> {
    if (registration.isNew && this.stored) {
      throw new OAuth2ClientRegistrationVersionConflictError(
        registration.source.value,
      );
    }

    this.stored = registration;
  }

  async deleteForTeam(): Promise<void> {
    this.stored = null;
  }
}

const TASK: BoundTaskDto = {
  taskId: 'task_1',
  workspaceId: 'ws_1',
  teamId: 'team_1',
  line: 'delivery',
  station: 'Implementation',
  stationKey: 'implementation',
  marks: {},
  waiting: null,
};

const TEAMS = {
  find: async (id: TeamId) => ({
    id,
    workspaceId: WorkspaceId.of('ws_1'),
    key: 'platform',
    name: 'Platform',
    members: [],
  }),
  inWorkspace: async () => [],
} satisfies TeamDirectoryPort;

const HASH = ContentHash.of('e'.repeat(64));

const ISSUE = DescribedOperation.of({
  name: 'issue',
  upstream: 'issue',
  description: 'Find one issue as the person who started the task.',
  inputs: [
    {
      name: 'id',
      schema: InputSchema.ofType('string'),
      required: true,
      description: null,
    },
  ],
  writes: false,
  call: {
    kind: 'graphql',
    endpoint: 'https://api.linear.app/graphql',
    operation: 'query',
    field: 'issue',
    document: 'query issue($id: String!) { issue(id: $id) { id } }',
    variables: ['id'],
  },
});

const GENERATED = `integration: linear
name: Linear
connection:
  holder: requester
  oauth2:
    authorize: https://linear.app/oauth/authorize
    token: https://api.linear.app/oauth/token
    registration: https://linear.app/oauth/register
graphql:
  url: https://api.linear.app/graphql
  auth:
    oauth2:
      connection: true
`;

const settingUp = ({
  registered = true,
  generated = false,
  policies = new InMemoryPersonToolPolicies(),
} = {}) => {
  const linear = new FakeLinear();
  const clock = { now: () => NOW } as ClockPort;
  const connections = new InMemoryHostConnections();
  const registrations = new InMemoryRegistrations();
  if (registered) {
    registrations.stored = OAuth2ClientRegistration.rehydrate({
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TEAM,
      source: LINEAR,
      registrationEndpoint: 'https://linear.app/oauth/register',
      redirectUri: CALLBACK,
      server: null,
      clientId: 'dcr-client',
      clientSecret: AccessToken.of('dcr-secret'),
      secretExpiresAt: null,
      version: 1,
    });
  }
  const definitions = {
    ofTeam: async () => [
      generated
        ? defined(GENERATED, { hash: HASH.value, offers: ['linear.issue'] })
        : defined(DEFINITION),
    ],
  };
  const operations = operationsContaining(
    DescribedDocument.read({
      hash: HASH,
      kind: 'graphql',
      operations: [ISSUE],
      passedOver: [],
      readAt: NOW,
    }),
  );
  const expressions = new CelExpressionEngine();
  const policy = new OutboundPolicy(['linear.app', 'api.linear.app']);
  const clients = new OAuth2ClientResolution(
    OAuth2Clients.from('{}'),
    registrations,
    new OAuth2Registrar(policy, linear.fetch),
    TEAMS,
    clock,
    CALLBACK,
  );
  const exchange = new OAuth2Exchange(policy, clock, linear.fetch);
  const runtime = new CompiledIntegrationRuntime(
    new IntegrationReader(expressions, operations),
    new HttpOutbound(['linear.app', 'api.linear.app'], linear.fetch),
    clients,
    exchange,
    discoveringNothing(),
    reachingNoServer(),
  );
  const renewal = new ConnectionRenewal(
    connections,
    definitions as unknown as DefinedIntegrationsPort,
    runtime,
    clock,
    () => new Promise((resolve) => setTimeout(resolve, 1)),
  );
  const tools = new IntegrationToolCalls(
    definitions as unknown as DefinedIntegrationsPort,
    runtime,
    new HostReach(
      connections,
      TEAMS,
      {
        onTeam: async () => ({}) as TeamMembership,
      } as unknown as WorkspaceAccessPort,
      injecting().injection,
      renewal,
    ),
    learningInto(),
    personRulesFrom(policies, { [ALICE.value]: 'Alice' }),
  );
  const linking = new OAuth2Linking(
    definitions as unknown as DefinedIntegrationsPort,
    new IntegrationReader(expressions, operations),
    discoveringNothing(),
    clients,
    exchange,
    TEAMS,
    { slugOf: async () => 'acme' } as unknown as WorkspaceReaderPort,
    new OAuth2State('a-secret'),
    { spend: async () => true },
    clock,
    'https://app.example',
    CALLBACK,
  );

  const connectedAs = (accessToken: string, refreshToken = 'rt-1') =>
    connections.add(
      HostConnection.rehydrate({
        workspaceId: WorkspaceId.of('ws_1'),
        teamId: TEAM,
        source: LINEAR,
        holder: ConnectionHolder.person(ALICE),
        accessToken: HostGrant.of({ accessToken }).accessToken,
        refreshToken: HostGrant.of({ accessToken, refreshToken }).refreshToken,
        expiresAt: new Date('2026-10-05T11:00:00.000Z'),
        scopes: [],
        handle: '@alice',
        refreshFailedAt: null,
        renewalClaim: null,
        version: 1,
      }),
    );

  const storedConnection = () =>
    connections.of(TEAM, LINEAR, ConnectionHolder.person(ALICE));

  const issue = async () => {
    const reached = (await tools.reach(
      'linear.issue',
      TASK,
      { runId: 'run_1', attempt: 1 },
      ALICE.value,
    )) as IntegrationTool;

    return reached.call({ id: 'ENG-12' });
  };

  const comment = async (body = 'Fixed.') => {
    const reached = (await tools.reach(
      'linear.comment',
      TASK,
      { runId: 'run_1', attempt: 1 },
      ALICE.value,
    )) as IntegrationTool;

    return reached.call({ body });
  };

  return {
    linear,
    connections,
    registrations,
    connectedAs,
    storedConnection,
    comment,
    issue,
    tools,
    linking,
  };
};

describe('OAuth that recovers from a token the host does not accept', () => {
  it('renews a token the host did not accept, then sends the call once more, and keeps the rotated tokens', async () => {
    const { linear, connectedAs, storedConnection, comment } = settingUp();
    connectedAs('at-1');
    linear.revoke();

    await expect(comment()).resolves.toBe(
      'https://linear.app/acme/issue/ENG-12#at-2',
    );

    const kept = await storedConnection();
    expect(linear.tokenCalls).toBe(1);
    expect(linear.apiCalls).toBe(2);
    expect(kept?.accessToken.value).toBe('at-2');
    expect(kept?.refreshToken?.value).toBe('rt-2');
    expect(kept?.renewalClaim).toBeNull();
  });

  it('renews and sends once more for a tool generated from the API description too', async () => {
    const { linear, connectedAs, storedConnection, issue } = settingUp({
      generated: true,
    });
    connectedAs('at-1');
    linear.revoke();

    await expect(issue()).resolves.toBeNull();

    expect(linear.tokenCalls).toBe(1);
    expect(linear.apiCalls).toBe(2);
    expect((await storedConnection())?.accessToken.value).toBe('at-2');
  });

  it('does not send a third time a call that fails with 401 again after renewal', async () => {
    const { linear, connectedAs, comment } = settingUp();
    connectedAs('at-1');
    linear.answersUnauthorized = true;

    await expect(comment()).rejects.toThrow(/answered 401/);

    expect(linear.apiCalls).toBe(2);
    expect(linear.tokenCalls).toBe(1);
  });

  it('renews once for two calls that fail with 401 at the same time, and both go through', async () => {
    const { linear, connectedAs, comment } = settingUp();
    connectedAs('at-1');
    linear.revoke();
    let release: () => void = () => {};
    linear.answersAfter = new Promise((resolve) => {
      release = resolve;
    });

    const both = Promise.all([comment('One.'), comment('Two.')]);
    setTimeout(() => release(), 20);

    await expect(both).resolves.toEqual([
      'https://linear.app/acme/issue/ENG-12#at-2',
      'https://linear.app/acme/issue/ENG-12#at-2',
    ]);
    expect(linear.tokenCalls).toBe(1);
    expect(linear.apiCalls).toBe(4);
  });

  it('keeps the rotated refresh token even when the connection changed while it renewed', async () => {
    const { linear, connections, connectedAs, storedConnection, comment } =
      settingUp();
    connectedAs('at-1');
    linear.revoke();
    linear.whileRenewing = () =>
      connections.bump(TEAM, LINEAR, ConnectionHolder.person(ALICE));

    await expect(comment()).resolves.toBe(
      'https://linear.app/acme/issue/ENG-12#at-2',
    );

    expect((await storedConnection())?.refreshToken?.value).toBe('rt-2');

    linear.whileRenewing = () => {};
    linear.revoke();

    await expect(comment()).resolves.toBe(
      'https://linear.app/acme/issue/ENG-12#at-3',
    );
    expect(linear.tokenCalls).toBe(2);
  });

  it('marks the refresh failed when the host will not renew the connection, and asks the person to connect again', async () => {
    const { linear, connectedAs, storedConnection, comment, tools } =
      settingUp();
    connectedAs('at-1', 'rt-stale');
    linear.revoke();

    await expect(comment()).rejects.toThrow(/answered 401/);

    expect((await storedConnection())?.refreshFailedAt).toEqual(NOW);
    expect(
      (
        await tools.reach(
          'linear.comment',
          TASK,
          { runId: 'run_1', attempt: 1 },
          ALICE.value,
        )
      )?.wants,
    ).toEqual({
      source: 'linear',
      integration: 'Linear',
      personId: ALICE.value,
      because: 'refresh-failed',
    });
  });

  it('acts as the person who started the task, never as the team', async () => {
    const { connectedAs, tools } = settingUp();
    connectedAs('at-1');

    const reached = await tools.reach(
      'linear.comment',
      TASK,
      { runId: 'run_1', attempt: 1 },
      ALICE.value,
    );
    const nobody = await tools.reach(
      'linear.comment',
      TASK,
      { runId: 'run_1', attempt: 1 },
      null,
    );

    expect(reached?.actingAs).toEqual({
      holder: 'person',
      personId: ALICE.value,
      handle: '@alice',
    });
    expect(nobody?.wants?.because).toBe('no-requester');
  });

  it('carries the rule the person set for calls made with their own connection', async () => {
    const policies = new InMemoryPersonToolPolicies();
    await policies.save(
      PersonToolPolicy.none({
        teamId: TEAM,
        personId: ALICE,
        source: LINEAR,
      }).set(
        ToolName.of('linear.comment'),
        PersonToolRule.of('needs-approval'),
      ),
    );
    const { connectedAs, tools } = settingUp({ policies });
    connectedAs('at-1');

    const reached = await tools.reach(
      'linear.comment',
      TASK,
      { runId: 'run_1', attempt: 1 },
      ALICE.value,
    );

    expect(reached?.personRule).toEqual({
      rule: 'needs-approval',
      personId: ALICE.value,
      personName: 'Alice',
    });
  });

  it('registers a client with the host once when someone connects, and renews with it', async () => {
    const { linear, registrations, connectedAs, comment, linking } = settingUp({
      registered: false,
    });
    const asked = {
      teamId: 'team_1',
      source: 'linear',
      by: ALICE.value,
      holder: 'person' as const,
      back: null,
    };

    await linking.begin(asked);
    await linking.begin(asked);
    connectedAs('at-1');
    linear.revoke();
    await comment();

    expect(linear.registrations).toBe(1);
    expect(linear.tokenCalls).toBe(1);
    expect(registrations.stored?.clientId).toBe('dcr-client');
  });

  it('never registers a client while it renews', async () => {
    const { linear, connectedAs, comment } = settingUp({ registered: false });
    connectedAs('at-1');
    linear.revoke();

    await expect(comment()).rejects.toThrow(/answered 401/);

    expect(linear.registrations).toBe(0);
    expect(linear.tokenCalls).toBe(0);
  });

  it('proves the code it exchanges with the PKCE verifier its challenge was made from', async () => {
    const { linear, linking } = settingUp();

    const begun = await linking.begin({
      teamId: 'team_1',
      source: 'linear',
      by: ALICE.value,
      holder: 'person',
      back: '/w/acme/inbox/task_1',
    });
    const url = new URL(begun?.url ?? '');
    linear.challenges.set(
      'the-code',
      url.searchParams.get('code_challenge') ?? '',
    );

    const authorized = await linking.authorized({
      state: url.searchParams.get('state') ?? '',
      code: 'the-code',
      nonce: begun?.nonce ?? null,
      viewerId: ALICE.value,
    });

    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('client_id')).toBe('dcr-client');
    expect(authorized?.grant.accessToken.value).toBe('at-2');
    expect(authorized?.grant.handle).toBe('@alice');
    expect(authorized?.holder).toBe('person');
    expect(linear.verifiers).toHaveLength(1);
  });
});

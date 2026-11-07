import type { WorkspaceOutboundScopePort } from '@identity/application/ports/workspace-outbound-scope.port';
import type { CallAuth } from '@integrations/application/ports/integration-runtime.port';
import { noFiles } from '@integrations/application/ports/notice-file-reader.fake-spec';
import type { OAuth2ClientsPort } from '@integrations/application/ports/oauth2-clients.port';
import type { OutboundLimitsPort } from '@integrations/application/ports/outbound-limits.port';
import type { TaskView } from '@integrations/application/ports/tasks-for-hooks.port';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { SpotlightCredentials } from '@integrations/infrastructure/acl/spotlight-credentials.adapter';
import { CompiledIntegrationRuntime } from '@integrations/infrastructure/integrations/compiled-integration.runtime';
import { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import type { OAuth2Exchange } from '@integrations/infrastructure/integrations/oauth2-exchange';
import type { HttpOutbound } from '@integrations/infrastructure/outbound/http-outbound';
import { HttpOutbound as RealHttpOutbound } from '@integrations/infrastructure/outbound/http-outbound';
import { NetworkOutbound } from '@integrations/infrastructure/outbound/network-outbound';
import { allowingOutbound } from '@integrations/infrastructure/outbound/outbound-policy.fake-spec';
import { clientsFrom } from '@integrations/integrations.clients.fake-spec';
import { defined } from '@integrations/integrations.definitions.fake-spec';
import { operationsContaining } from '@integrations/integrations.documents.fake-spec';
import {
  callingNoServer,
  discoveringNothing,
} from '@integrations/integrations.mcp.fake-spec';
import { injecting } from '@integrations/integrations.secrets.fake-spec';
import { answerOf } from '@integrations/integrations.tool-answers.fake-spec';
import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import type {
  NetworkCallState,
  NetworkCallsPort,
  NetworkRequest,
} from '@runs/application/ports/network-calls.port';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-11-01T09:00:00.000Z');

const AUDIT = `integration: audit
actions:
  record:
    from: network
    timeoutSeconds: 20
    request:
      method: POST
      url: https://audit.internal/records
      query:
        team: \${{ task.line }}
      auth:
        secrets: [secret.AUDIT_TOKEN]
      body:
        text: \${{ inputs.text }}
      expect:
        status: [201]
      capture:
        id: \${{ response.id }}
tools:
  record:
    action: record
    description: Record what the agent did.
    inputs:
      text:
        required: true
    output: \${{ capture.id }}
`;

const TASK: TaskView = {
  taskId: TaskId.of('task_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  title: 'Drain the queue',
  url: null,
  pullRequest: null,
  line: LineKey.of('delivery'),
  station: StationName.of('Implementation'),
  stationKey: StationKey.of('implementation'),
  marks: {},
  repositories: [],
  runId: null,
  waiting: null,
};

const answering = (state: NetworkCallState) => {
  const queued: { request: NetworkRequest; expiresAt: Date }[] = [];
  const calls: NetworkCallsPort = {
    queue: vi.fn(async (_workspace, request, expiresAt) => {
      queued.push({ request, expiresAt });
      return 'call_1';
    }),
    stateOf: vi.fn(async () => state),
    answered: vi.fn(async () => state),
  };

  return { calls, queued };
};

const answered = (status: number, body: string): NetworkCallState => ({
  kind: 'answered',
  response: {
    status,
    headers: {},
    body: new TextEncoder().encode(body),
    ms: 12,
    error: null,
  },
});

const sending = (
  state: NetworkCallState,
  over: { limits?: OutboundLimitsPort; file?: string } = {},
) => {
  const { calls, queued } = answering(state);
  const secrets = injecting({
    AUDIT_TOKEN: {
      host: 'audit.internal',
      prefix: 'Bearer ',
      value: 'audit-value',
    },
  });
  const run = vi.fn();
  const within = vi.fn(async (_workspace: string, work: () => unknown) =>
    work(),
  );
  const take = vi.fn(async () => true);
  const limits = over.limits ?? { perSecond: 50, take };
  const runtime = new CompiledIntegrationRuntime(
    new IntegrationReader(new CelExpressionEngine(), operationsContaining()),
    { run } as unknown as HttpOutbound,
    clientsFrom() as OAuth2ClientsPort,
    {} as OAuth2Exchange,
    discoveringNothing(),
    callingNoServer(),
    limits,
    { within } as unknown as WorkspaceOutboundScopePort,
    new NetworkOutbound(
      new RealHttpOutbound(allowingOutbound(['audit.internal'])),
      calls,
      { now: () => NOW, sleep: async () => {} },
    ),
    noFiles,
  );
  const callAuth: CallAuth = {
    workspace: async () => WorkspaceId.of('ws_1'),
    connection: null,
    credentials: new SpotlightCredentials(secrets.injection, async () =>
      WorkspaceId.of('ws_1'),
    ),
  };

  const call = async (text: string) => {
    const resolved = await runtime.tool(
      [defined(over.file ?? AUDIT)],
      ToolName.of('audit.record'),
      TASK,
    );

    return resolved && answerOf(resolved.attempt({ text }, callAuth, null));
  };

  return { call, calls, queued, secrets, run, within, take };
};

describe('an action sent from the network', () => {
  it('queues the request for a host with stand-ins and the secret names, and reads no value', async () => {
    const { call, queued, secrets, run } = sending(
      answered(201, '{"id":"rec_1"}'),
    );

    await call('deployed');

    const [{ request, expiresAt }] = queued as [(typeof queued)[number]];
    expect(request).toMatchObject({
      method: 'POST',
      url: 'https://audit.internal/records?team=delivery',
      headers: {
        authorization: 'Bearer spotlight-egress:AUDIT_TOKEN',
        'content-type': 'application/json',
      },
      timeoutMs: 20_000,
      secrets: ['AUDIT_TOKEN'],
    });
    expect(new TextDecoder().decode(request.body)).toBe('{"text":"deployed"}');
    expect(JSON.stringify(queued)).not.toContain('audit-value');
    expect(expiresAt).toEqual(new Date(NOW.getTime() + 20_000));
    expect(secrets.forSpotlight).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it('waits for the answer as long as the action says', async () => {
    const { call, calls } = sending(answered(201, '{"id":"rec_1"}'));

    await call('deployed');

    expect(calls.answered).toHaveBeenCalledWith(
      'call_1',
      new Date(NOW.getTime() + 20_000),
    );
  });

  it('reads the answer as a request sent from Spotlight: expect, then capture', async () => {
    expect(
      await sending(answered(201, '{"id":"rec_1"}')).call('deployed'),
    ).toBe('rec_1');
    await expect(
      sending(answered(200, '{"id":"rec_1"}')).call('deployed'),
    ).rejects.toThrow(/answered 200/);
  });

  it('fails with the host’s error when nothing answered', async () => {
    await expect(
      sending({
        kind: 'answered',
        response: {
          status: 0,
          headers: {},
          body: new Uint8Array(),
          ms: 3,
          error:
            "Egress couldn't redeem the call's secrets, so it didn't send the call.",
        },
      }).call('deployed'),
    ).rejects.toThrow(/couldn't redeem the call's secrets/);
  });

  it('fails with the host’s error when it answered with one', async () => {
    await expect(
      sending({
        kind: 'answered',
        response: {
          status: 201,
          headers: {},
          body: new Uint8Array(),
          ms: 3,
          error: "The response was compressed, so egress couldn't redact it.",
        },
      }).call('deployed'),
    ).rejects.toThrow(/compressed, so egress couldn't redact it/);
  });

  it('fails when no host sent it in time', async () => {
    await expect(
      sending({ kind: 'expired', claimed: false }).call('deployed'),
    ).rejects.toThrow('no host of the workspace sent it within 20 seconds');
  });

  it('says a host claimed it when that host did not answer in time', async () => {
    await expect(
      sending({ kind: 'expired', claimed: true }).call('deployed'),
    ).rejects.toThrow('a host claimed it but didn’t answer within 20 seconds');
  });

  it('takes a token from the workspace’s rate limit, and is not held to its host scope', async () => {
    const { call, take, within } = sending(answered(201, '{"id":"rec_1"}'));

    await call('deployed');

    expect(take).toHaveBeenCalledWith('ws_1');
    expect(within).not.toHaveBeenCalled();
  });

  it('queues nothing when the workspace is over its rate limit', async () => {
    const { call, calls } = sending(answered(201, '{"id":"rec_1"}'), {
      limits: { perSecond: 50, take: async () => false },
    });

    await expect(call('deployed')).rejects.toThrow(/more than 50 requests/);
    expect(calls.queue).not.toHaveBeenCalled();
  });

  it('queues nothing for a secret that is not bound to the host', async () => {
    const { call, calls } = sending(answered(201, '{"id":"rec_1"}'), {
      file: AUDIT.replace('https://audit.internal', 'https://other.internal'),
    });

    await expect(call('deployed')).rejects.toThrow(
      /not bound to other.internal/,
    );
    expect(calls.queue).not.toHaveBeenCalled();
  });
});

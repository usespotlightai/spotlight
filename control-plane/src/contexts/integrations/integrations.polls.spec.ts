import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type {
  DefinedIntegrationsPort,
  TeamDefinedIntegrations,
} from '@integrations/application/ports/defined-integrations.port';
import type { PollState } from '@integrations/application/ports/integration-cursors.port';
import type { Credentials } from '@integrations/application/ports/integration-runtime.port';
import type { OAuth2ClientsPort } from '@integrations/application/ports/oauth2-clients.port';
import { ProcessDuePolls } from '@integrations/application/services/process-due-polls.service';
import { CompiledIntegrationRuntime } from '@integrations/infrastructure/integrations/compiled-integration.runtime';
import { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import type { OAuth2Exchange } from '@integrations/infrastructure/integrations/oauth2-exchange';
import type {
  HttpOutbound,
  OutboundResult,
} from '@integrations/infrastructure/outbound/http-outbound';
import { clientsFrom } from '@integrations/integrations.clients.fake-spec';
import { FakeIntegrationCursors } from '@integrations/integrations.cursors.fake-spec';
import { defined } from '@integrations/integrations.definitions.fake-spec';
import { operationsContaining } from '@integrations/integrations.documents.fake-spec';
import {
  discoveringNothing,
  reachingNoServer,
} from '@integrations/integrations.mcp.fake-spec';
import {
  injecting,
  reachFor,
} from '@integrations/integrations.secrets.fake-spec';
import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import type { SecretInjectionPort } from '@secrets/application/ports/secret-injection.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { Happened } from '@work/application/contracts/happenings.contract';
import type { HappeningReactionsPort } from '@work/application/ports/happening-reactions.port';
import { describe, expect, it, vi } from 'vitest';

const expressions = new CelExpressionEngine();

const runtimeWith = (
  outbound: unknown,
  exchange: unknown = {},
  clients: OAuth2ClientsPort = clientsFrom(),
) =>
  new CompiledIntegrationRuntime(
    new IntegrationReader(expressions, operationsContaining()),
    outbound as HttpOutbound,
    clients,
    exchange as OAuth2Exchange,
    discoveringNothing(),
    reachingNoServer(),
  );

const NOW = new Date('2026-09-07T10:00:00.000Z');
const TEAM = TeamId.of('team_1');

const poll = (headers = '') => `
integration: linear
poll:
  every: 60s
  request:
    method: GET
    url: https://api.linear.app/issues
${headers}  cursor: '\${{ body.lastId }}'
  events:
    - forEach: '\${{ body.issues }}'
      when: '\${{ item.done }}'
      raise:
        happening: linear.issue.completed
        label: Done
        told: Done.
        marks:
          - kind: linear.issue
            value: '\${{ item.id }}'
`;

const READS_A_SECRET = `    auth:
      secrets: [secret.LINEAR_TOKEN]
`;

const config = (file: string): TeamDefinedIntegrations => ({
  teamId: TEAM,
  integrations: [defined(file)],
});

const REPLY: OutboundResult = {
  ok: true,
  status: 200,
  response: {
    issues: [
      { id: 'ENG-1', done: true },
      { id: 'ENG-2', done: false },
    ],
    lastId: 'ENG-2',
  },
  capture: {},
};

const polling = (
  cursors: FakeIntegrationCursors,
  run: (
    request: unknown,
    against: { cursor: string },
    credentials?: Credentials,
  ) => Promise<OutboundResult>,
  react: HappeningReactionsPort['react'],
  file = poll(),
  injection: SecretInjectionPort = injecting().injection,
) =>
  new ProcessDuePolls(
    {
      everywhere: async () => [config(file)],
    } as unknown as DefinedIntegrationsPort,
    runtimeWith({ run } as unknown as HttpOutbound),
    {
      find: async () => ({
        id: TEAM,
        workspaceId: WorkspaceId.of('ws_1'),
        name: 'Platform',
        members: [],
      }),
    } as unknown as TeamDirectoryPort,
    reachFor(injection),
    cursors,
    { react } as HappeningReactionsPort,
    { now: () => NOW } as ClockPort,
    { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
  );

const working = (state: PollState = { cursor: null, ranAt: null }) => {
  const run = vi.fn(
    async (_request: unknown, _against: { cursor: string }) => REPLY,
  );
  const react = vi.fn(
    async (
      _workspaceId: unknown,
      _teamId: unknown,
      _happenings: Happened[],
      _heardAs: string | null,
    ) => undefined,
  );
  const cursors = new FakeIntegrationCursors();

  if (state.ranAt || state.cursor) {
    cursors.keep(TEAM, 'linear', state);
  }

  return { polls: polling(cursors, run, react), run, react, cursors };
};

describe('ProcessDuePolls', () => {
  it('polls the host with the cursor it last kept', async () => {
    const { polls, run } = working({ cursor: 'ENG-0', ranAt: null });

    await polls.processDue();

    const against = run.mock.calls[0]?.[1];
    expect(against?.cursor).toBe('ENG-0');
  });

  it('raises one word per matching item in the response', async () => {
    const { polls, react } = working();

    await polls.processDue();

    const raised = react.mock.calls[0]?.[2];
    expect(raised).toHaveLength(1);
    expect(raised?.[0]?.concerns.marks.map((each) => each.value)).toEqual([
      'ENG-1',
    ]);
  });

  it('names what it heard by the cursor it polled from, so a poll taken again acts once', async () => {
    const { polls, react } = working({ cursor: 'ENG-0', ranAt: null });

    await polls.processDue();

    expect(react.mock.calls[0]?.[3]).toBe('poll:linear:team_1:ENG-0');
  });

  it('keeps the cursor the response named, and marks it run', async () => {
    const { polls, cursors } = working();

    await polls.processDue();

    expect(cursors.kept(TEAM, 'linear')).toEqual({
      cursor: 'ENG-2',
      ranAt: NOW,
    });
  });

  it('does not poll one that is not yet due', async () => {
    const { polls, run } = working({
      cursor: 'ENG-0',
      ranAt: new Date(NOW.getTime() - 30_000),
    });

    await polls.processDue();

    expect(run).not.toHaveBeenCalled();
  });

  it('polls one due again after its interval', async () => {
    const { polls, run } = working({
      cursor: 'ENG-0',
      ranAt: new Date(NOW.getTime() - 61_000),
    });

    await polls.processDue();

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('keeps its cursor and does not react when a host refuses', async () => {
    const react = vi.fn(async () => undefined);
    const cursors = new FakeIntegrationCursors();
    cursors.keep(TEAM, 'linear', { cursor: 'ENG-0', ranAt: null });

    await polling(
      cursors,
      async () => ({ ok: false, status: 500, response: null, capture: {} }),
      react,
    ).processDue();

    expect(react).not.toHaveBeenCalled();
    expect(cursors.kept(TEAM, 'linear')).toEqual({
      cursor: 'ENG-0',
      ranAt: NOW,
    });
  });

  it('lets the call inject the workspace’s secrets as Spotlight’s own', async () => {
    const { injection, forSpotlight } = injecting({
      LINEAR_TOKEN: { host: 'api.linear.app', value: 'lin-1' },
    });
    const run = vi.fn(
      async (
        _request: unknown,
        _against: unknown,
        _credentials?: Credentials,
      ) => REPLY,
    );

    await polling(
      new FakeIntegrationCursors(),
      run,
      vi.fn(async () => undefined),
      poll(READS_A_SECRET),
      injection,
    ).processDue();

    const credentials = run.mock.calls[0]?.[2] as Credentials;
    await credentials.injectedFor('https://api.linear.app/issues', [
      'LINEAR_TOKEN',
    ]);

    expect(forSpotlight).toHaveBeenCalledWith({
      workspaceId: 'ws_1',
      secrets: ['LINEAR_TOKEN'],
      url: 'https://api.linear.app/issues',
    });
  });

  it('polls a slot once when two workers reach it together', async () => {
    let reads = 0;
    let bothRead: () => void = () => {};
    const together = new Promise<void>((settle) => {
      bothRead = settle;
    });
    const cursors = new FakeIntegrationCursors(async () => {
      reads += 1;
      if (reads === 2) {
        bothRead();
      }
      await together;
    });
    const run = vi.fn(async () => REPLY);
    const react = vi.fn(async () => undefined);

    await Promise.all([
      polling(cursors, run, react).processDue(),
      polling(cursors, run, react).processDue(),
    ]);

    expect(run).toHaveBeenCalledTimes(1);
    expect(react).toHaveBeenCalledTimes(1);
  });

  it('will not move the cursor back when a later poll took the turn', async () => {
    const cursors = new FakeIntegrationCursors();
    const later = new Date(NOW.getTime() + 90_000);
    const react = vi.fn(async () => undefined);
    const run = vi.fn(async () => {
      cursors.keep(TEAM, 'linear', { cursor: 'ENG-9', ranAt: later });
      return REPLY;
    });

    await polling(cursors, run, react).processDue();

    expect(cursors.kept(TEAM, 'linear')).toEqual({
      cursor: 'ENG-9',
      ranAt: later,
    });
  });
});

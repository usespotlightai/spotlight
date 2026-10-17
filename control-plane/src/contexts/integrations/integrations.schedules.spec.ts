import type {
  DefinedIntegrationsPort,
  TeamDefinedIntegrations,
} from '@integrations/application/ports/defined-integrations.port';
import type { PollState } from '@integrations/application/ports/integration-cursors.port';
import type { Credentials } from '@integrations/application/ports/integration-runtime.port';
import type { OAuth2ClientsPort } from '@integrations/application/ports/oauth2-clients.port';
import { RunSchedules } from '@integrations/application/services/run-schedules.service';
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

const NOW = new Date('2026-09-07T09:00:00.000Z');
const TEAM = TeamId.of('team_1');

const schedule = (headers = '') => `
integration: linear
schedule:
  cron: 0 * * * *
  do: digest
actions:
  digest:
    request:
      method: POST
      url: https://api.linear.app/digest
${headers}`;

const READS_A_SECRET = `      auth:
        secrets: [secret.LINEAR_TOKEN]
`;

const config = (file: string): TeamDefinedIntegrations => ({
  teamId: TEAM,
  integrations: [defined(file)],
});

const OK: OutboundResult = { ok: true, status: 200, response: {}, capture: {} };

const KEY = 'linear:schedule';

const scheduling = (
  cursors: FakeIntegrationCursors,
  run: (
    request: unknown,
    against?: unknown,
    credentials?: Credentials,
  ) => Promise<OutboundResult>,
  now: Date = NOW,
  file = schedule(),
  injection: SecretInjectionPort = injecting().injection,
) =>
  new RunSchedules(
    {
      everywhere: async () => [config(file)],
    } as unknown as DefinedIntegrationsPort,
    runtimeWith({ run } as unknown as HttpOutbound),
    reachFor(injection),
    cursors,
    { now: () => now } as ClockPort,
    { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
  );

const working = (state: PollState, now: Date = NOW, file = schedule()) => {
  const run = vi.fn(async (_request: unknown) => OK);
  const cursors = new FakeIntegrationCursors();

  if (state.ranAt) {
    cursors.keep(TEAM, KEY, state);
  }

  return { schedules: scheduling(cursors, run, now, file), run, cursors };
};

describe('RunSchedules', () => {
  it('sets a clock going without firing when it first sees a schedule', async () => {
    const { schedules, run, cursors } = working({ cursor: null, ranAt: null });

    await schedules.runDue();

    expect(run).not.toHaveBeenCalled();
    expect(cursors.kept(TEAM, KEY)?.ranAt).toEqual(NOW);
  });

  it('runs the action when the cron has come round', async () => {
    const { schedules, run, cursors } = working({
      cursor: null,
      ranAt: new Date('2026-09-07T08:00:00.000Z'),
    });

    await schedules.runDue();

    expect(run).toHaveBeenCalledTimes(1);
    expect(cursors.kept(TEAM, KEY)?.ranAt).toEqual(NOW);
  });

  it('leaves a schedule alone until its cron comes round', async () => {
    const { schedules, run, cursors } = working(
      { cursor: null, ranAt: new Date('2026-09-07T09:00:00.000Z') },
      new Date('2026-09-07T09:30:00.000Z'),
    );

    await schedules.runDue();

    expect(run).not.toHaveBeenCalled();
    expect(cursors.kept(TEAM, KEY)?.ranAt).toEqual(
      new Date('2026-09-07T09:00:00.000Z'),
    );
  });

  it('fires once for a schedule that fell behind, not once per missed hour', async () => {
    const { schedules, run } = working({
      cursor: null,
      ranAt: new Date('2026-09-06T08:00:00.000Z'),
    });

    await schedules.runDue();

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('lets the call wear the workspace’s secrets as Spotlight’s own', async () => {
    const { injection, forSpotlight } = injecting({
      LINEAR_TOKEN: { host: 'api.linear.app', value: 'lin-1' },
    });
    const run = vi.fn(
      async (
        _request: unknown,
        _against: unknown,
        _credentials?: Credentials,
      ) => OK,
    );

    const cursors = new FakeIntegrationCursors();
    cursors.keep(TEAM, KEY, {
      cursor: null,
      ranAt: new Date('2026-09-07T08:00:00.000Z'),
    });

    await scheduling(
      cursors,
      run,
      NOW,
      schedule(READS_A_SECRET),
      injection,
    ).runDue();

    const credentials = run.mock.calls[0]?.[2] as Credentials;
    await credentials.wornToward('https://api.linear.app/digest', [
      'LINEAR_TOKEN',
    ]);

    expect(forSpotlight).toHaveBeenCalledWith({
      workspaceId: 'ws_1',
      secrets: ['LINEAR_TOKEN'],
      url: 'https://api.linear.app/digest',
    });
  });

  it('runs the action once when two workers reach the slot together', async () => {
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
    cursors.keep(TEAM, KEY, {
      cursor: null,
      ranAt: new Date('2026-09-07T08:00:00.000Z'),
    });
    const run = vi.fn(async () => OK);

    await Promise.all([
      scheduling(cursors, run).runDue(),
      scheduling(cursors, run).runDue(),
    ]);

    expect(run).toHaveBeenCalledTimes(1);
  });
});

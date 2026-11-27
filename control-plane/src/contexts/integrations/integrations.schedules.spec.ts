import { unscoped } from '@identity/application/ports/workspace-outbound-scope.fake-spec';
import type {
  DefinedIntegrationsPort,
  TeamDefinedIntegrations,
} from '@integrations/application/ports/defined-integrations.port';
import type { Credentials } from '@integrations/application/ports/integration-runtime.port';
import { noFiles } from '@integrations/application/ports/notice-file-reader.fake-spec';
import type { OAuth2ClientsPort } from '@integrations/application/ports/oauth2-clients.port';
import { RunSchedules } from '@integrations/application/services/run-schedules.service';
import { CompiledIntegrationRuntime } from '@integrations/infrastructure/integrations/compiled-integration.runtime';
import { cronCalendar } from '@integrations/infrastructure/integrations/cron-calendar';
import { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import type { OAuth2Exchange } from '@integrations/infrastructure/integrations/oauth2-exchange';
import type {
  HttpOutbound,
  OutboundResult,
} from '@integrations/infrastructure/outbound/http-outbound';
import { noNetwork } from '@integrations/infrastructure/outbound/network-outbound.fake-spec';
import { unlimited } from '@integrations/infrastructure/outbound/outbound-limits.fake-spec';
import { clientsFrom } from '@integrations/integrations.clients.fake-spec';
import { FakeScheduleCursors } from '@integrations/integrations.cursors.fake-spec';
import { defined } from '@integrations/integrations.definitions.fake-spec';
import { operationsContaining } from '@integrations/integrations.documents.fake-spec';
import {
  callingNoServer,
  discoveringNothing,
} from '@integrations/integrations.mcp.fake-spec';
import {
  callAuthFor,
  injecting,
} from '@integrations/integrations.secrets.fake-spec';
import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import type { SecretInjectionPort } from '@secrets/application/ports/secret-injection.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { firstOf } from '@shared-kernel/domain/item-at';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { present } from '@shared-kernel/domain/present.fake-spec';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it, vi } from 'vitest';

const expressions = new CelExpressionEngine();

const runtimeWith = (
  outbound: Partial<HttpOutbound>,
  exchange: Partial<OAuth2Exchange> = {},
  clients: OAuth2ClientsPort = clientsFrom(),
) =>
  new CompiledIntegrationRuntime(
    new IntegrationReader(expressions, operationsContaining()),
    partial<HttpOutbound>(outbound),
    clients,
    partial<OAuth2Exchange>(exchange),
    discoveringNothing(),
    callingNoServer(),
    unlimited,
    unscoped,
    noNetwork,
    noFiles,
  );

const NOW = new Date('2026-09-07T09:00:00.000Z');
const TEAM = TeamId.of('team_1');

const schedule = (headers = '') => `
integration: linear
schedule:
  cron: 0 * * * *
  action: digest
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

const KEY = 'linear';

const scheduling = (
  cursors: FakeScheduleCursors,
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
    partial<DefinedIntegrationsPort>({
      everywhere: () => Promise.resolve([config(file)]),
    }),
    runtimeWith({ run }),
    callAuthFor(injection),
    cursors,
    cronCalendar,
    partial<ClockPort>({ now: () => now }),
    { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
  );

const working = (
  state: { ranAt: Date | null },
  now: Date = NOW,
  file = schedule(),
) => {
  const run = vi.fn((_request: unknown) => Promise.resolve(OK));
  const cursors = new FakeScheduleCursors();

  if (state.ranAt) {
    cursors.setState(TEAM, KEY, { ranAt: state.ranAt });
  }

  return { schedules: scheduling(cursors, run, now, file), run, cursors };
};

describe('RunSchedules', () => {
  it('sets a clock going without firing when it first sees a schedule', async () => {
    const { schedules, run, cursors } = working({ ranAt: null });

    await schedules.runDue();

    expect(run).not.toHaveBeenCalled();
    expect(cursors.stateOf(TEAM, KEY)?.ranAt).toEqual(NOW);
  });

  it('runs the action when the cron has come round', async () => {
    const { schedules, run, cursors } = working({
      ranAt: new Date('2026-09-07T08:00:00.000Z'),
    });

    await schedules.runDue();

    expect(run).toHaveBeenCalledTimes(1);
    expect(cursors.stateOf(TEAM, KEY)?.ranAt).toEqual(NOW);
  });

  it('leaves a schedule alone until its cron comes round', async () => {
    const { schedules, run, cursors } = working(
      { ranAt: new Date('2026-09-07T09:00:00.000Z') },
      new Date('2026-09-07T09:30:00.000Z'),
    );

    await schedules.runDue();

    expect(run).not.toHaveBeenCalled();
    expect(cursors.stateOf(TEAM, KEY)?.ranAt).toEqual(
      new Date('2026-09-07T09:00:00.000Z'),
    );
  });

  it('fires once for a schedule that fell behind, not once per missed hour', async () => {
    const { schedules, run } = working({
      ranAt: new Date('2026-09-06T08:00:00.000Z'),
    });

    await schedules.runDue();

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('lets the call inject the workspace’s secrets as Spotlight’s own', async () => {
    const { injection, forSpotlight } = injecting({
      LINEAR_TOKEN: { host: 'api.linear.app', value: 'lin-1' },
    });
    const run = vi.fn(
      (_request: unknown, _against: unknown, _credentials?: Credentials) =>
        Promise.resolve(OK),
    );

    const cursors = new FakeScheduleCursors();
    cursors.setState(TEAM, KEY, {
      ranAt: new Date('2026-09-07T08:00:00.000Z'),
    });

    await scheduling(
      cursors,
      run,
      NOW,
      schedule(READS_A_SECRET),
      injection,
    ).runDue();

    const credentials = present(firstOf(run.mock.calls)?.[2]);
    await credentials.injectedFor('https://api.linear.app/digest', [
      SecretName.of('LINEAR_TOKEN'),
    ]);

    expect(forSpotlight).toHaveBeenCalledWith({
      workspaceId: 'ws_1',
      secrets: ['LINEAR_TOKEN'],
      url: 'https://api.linear.app/digest',
    });
  });

  it('runs the action once when two workers claim the slot together', async () => {
    let reads = 0;
    let bothRead: () => void = () => {};
    const together = new Promise<void>((resolve) => {
      bothRead = resolve;
    });
    const cursors = new FakeScheduleCursors(async () => {
      reads += 1;
      if (reads === 2) {
        bothRead();
      }
      await together;
    });
    cursors.setState(TEAM, KEY, {
      ranAt: new Date('2026-09-07T08:00:00.000Z'),
    });
    const run = vi.fn(() => Promise.resolve(OK));

    await Promise.all([
      scheduling(cursors, run).runDue(),
      scheduling(cursors, run).runDue(),
    ]);

    expect(run).toHaveBeenCalledTimes(1);
  });
});
